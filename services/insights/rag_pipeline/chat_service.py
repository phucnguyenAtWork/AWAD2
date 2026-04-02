"""Main chat orchestrator — ties together classification, context, prompting, model, actions, and logging."""

from __future__ import annotations

import time
import uuid

from . import database, model_client
from .action_executor import execute_action
from .action_parser import parse_action, strip_action_blocks
from .config import settings
from .context_builder import build_context
from .context_filter import filter_context
from .models import ChatResponse
from .prompt_template import build_system_prompt
from .query_classifier import classify


async def chat(
    *,
    user_id: str,
    token: str,
    prompt: str,
    display_currency: str | None = None,
) -> ChatResponse:
    """Full RAG chat pipeline:

    1. Classify query intent (NEW — query understanding)
    2. Apply topic guardrail (NEW — reject off-topic)
    3. Fetch & cache financial context
    4. Filter context by intent (NEW — relevant retrieval)
    5. Build system prompt with analytics
    6. Load recent conversation history
    7. Call Gemini
    8. Parse & execute any action block
    9. Log everything (including classification metadata)
    """
    request_id = str(uuid.uuid4())
    t0 = time.monotonic()

    # 1. Query intent classification
    classification = classify(prompt)
    print(
        f"[RAG:{request_id[:8]}] Intent: {classification.intent.value} "
        f"(confidence: {classification.confidence:.0%}), "
        f"categories: {classification.extracted_categories}, "
        f"amount: {classification.extracted_amount}, "
        f"timeframe: {classification.extracted_timeframe}"
    )

    # 2. Topic guardrail — block off-topic before calling LLM
    if classification.is_blocked:
        print(f"[RAG:{request_id[:8]}] BLOCKED — off-topic or injection attempt")
        latency_ms = int((time.monotonic() - t0) * 1000)

        saved = await database.create_log(
            account_id=user_id,
            user_query=prompt,
            ai_response=classification.redirect_message,
            context_snapshot={"blocked": True, "intent": classification.intent.value},
            action=None,
            model_name="guardrail",  # No LLM call — handled locally
            latency_ms=latency_ms,
            prompt_tokens=0,
            response_tokens=0,
            request_id=request_id,
        )

        return ChatResponse(
            response=classification.redirect_message or "Please ask a finance-related question.",
            log=saved,
            request_id=request_id,
        )

    # 3. Context retrieval (cached per account)
    ctx, analytics, db_currency = await build_context(token, user_id)
    currency = display_currency or db_currency

    # 4. Filter context based on intent (relevant retrieval)
    filtered_ctx = filter_context(ctx, classification)
    print(
        f"[RAG:{request_id[:8]}] Context: {len(ctx.transactions)} total tx → "
        f"{len(filtered_ctx.transactions)} relevant tx "
        f"(filtered by {classification.intent.value})"
    )

    # 5. System prompt
    system_prompt = build_system_prompt(filtered_ctx, analytics, db_currency, display_currency)

    # 6. Conversation history
    recent_logs = await database.list_logs(user_id, settings.MAX_HISTORY)
    history: list[dict] = []
    for log in reversed(recent_logs):
        if log.user_query:
            history.append({"role": "user", "parts": [{"text": log.user_query}]})
        if log.ai_response:
            history.append({"role": "model", "parts": [{"text": log.ai_response}]})
    history.append({"role": "user", "parts": [{"text": prompt}]})

    # 7. Call model
    model_resp = await model_client.chat(system_prompt, history)
    ai_text = model_resp.text

    # 8. Parse and execute action
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

    # 9. Log with classification metadata
    context_snapshot = {
        "accountCount": len(ctx.accounts),
        "categoryCount": len(ctx.categories),
        "transactionCount": len(ctx.transactions),
        "filteredTransactionCount": len(filtered_ctx.transactions),
        "budgetCount": len(ctx.budgets),
        "accounts": [a.name for a in ctx.accounts],
        "categories": [c.name for c in ctx.categories],
        "classification": {
            "intent": classification.intent.value,
            "confidence": classification.confidence,
            "extracted_categories": classification.extracted_categories,
            "extracted_amount": classification.extracted_amount,
            "extracted_timeframe": classification.extracted_timeframe,
        },
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
