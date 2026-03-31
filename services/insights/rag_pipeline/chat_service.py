"""Main chat orchestrator — ties together context, prompting, model, actions, and logging."""

from __future__ import annotations

import time
import uuid

from . import database, model_client
from .action_executor import execute_action
from .action_parser import parse_action, strip_action_blocks
from .config import settings
from .context_builder import build_context
from .models import ChatLogRow, ChatResponse
from .prompt_template import build_system_prompt


async def chat(
    *,
    user_id: str,
    token: str,
    prompt: str,
    display_currency: str | None = None,
) -> ChatResponse:
    """Full RAG chat pipeline:

    1. Fetch & cache financial context
    2. Build system prompt with analytics
    3. Load recent conversation history
    4. Call Gemini
    5. Parse & execute any action block
    6. Log everything
    """
    request_id = str(uuid.uuid4())
    t0 = time.monotonic()

    # 1. Context retrieval (cached per account)
    ctx, analytics, db_currency = await build_context(token, user_id)
    currency = display_currency or db_currency
    print(
        f"[RAG:{request_id[:8]}] Context: {len(ctx.accounts)} accounts, "
        f"{len(ctx.categories)} categories, {len(ctx.transactions)} transactions, "
        f"{len(ctx.budgets)} budgets"
    )

    # 2. System prompt
    system_prompt = build_system_prompt(ctx, analytics, db_currency, display_currency)

    # 3. Conversation history
    recent_logs = await database.list_logs(user_id, settings.MAX_HISTORY)
    history: list[dict] = []
    for log in reversed(recent_logs):
        if log.user_query:
            history.append({"role": "user", "parts": [{"text": log.user_query}]})
        if log.ai_response:
            history.append({"role": "model", "parts": [{"text": log.ai_response}]})
    history.append({"role": "user", "parts": [{"text": prompt}]})

    # 4. Call model
    model_resp = await model_client.chat(system_prompt, history)
    ai_text = model_resp.text

    # 5. Parse and execute action
    action_payload = parse_action(ai_text)
    executed_action = None
    if action_payload:
        print(f"[RAG:{request_id[:8]}] Detected action: {action_payload.action.value}")
        try:
            action_result = await execute_action(action_payload, token, ctx, currency)
            ai_text = strip_action_blocks(ai_text)
            ai_text = f"{ai_text}\n\n✅ {action_result}"
            executed_action = action_payload.model_dump()
        except Exception as exc:
            print(f"[RAG:{request_id[:8]}] Action failed: {exc}")
            ai_text = strip_action_blocks(ai_text)
            ai_text = f"{ai_text}\n\n❌ Action failed: {exc}"

    latency_ms = int((time.monotonic() - t0) * 1000)

    # 6. Log
    context_snapshot = {
        "accountCount": len(ctx.accounts),
        "categoryCount": len(ctx.categories),
        "transactionCount": len(ctx.transactions),
        "budgetCount": len(ctx.budgets),
        "accounts": [a.name for a in ctx.accounts],
        "categories": [c.name for c in ctx.categories],
    }

    saved = await database.create_log(
        account_id=user_id,
        user_query=prompt,
        ai_response=ai_text,
        context_snapshot=context_snapshot,
        action=executed_action,
        model_name=settings.MODEL_NAME,
        latency_ms=latency_ms,
        prompt_tokens=model_resp.prompt_tokens,
        response_tokens=model_resp.response_tokens,
        request_id=request_id,
    )

    return ChatResponse(response=ai_text, log=saved, request_id=request_id)
