"""Deterministic fallback actions for clear write intents."""

from __future__ import annotations

import calendar
from datetime import date, timedelta

from .models import ActionPayload, ActionType, FinanceContext
from .query_classifier import ClassificationResult, Intent


_DESCRIPTION_KEYWORDS = [
    "coffee",
    "lunch",
    "dinner",
    "breakfast",
    "snack",
    "groceries",
    "grocery",
    "salary",
    "rent",
    "shopping",
]


def build_fallback_action(
    prompt: str,
    classification: ClassificationResult,
    ctx: FinanceContext,
) -> ActionPayload | None:
    """Build an action when intent/entities are clear but the model omitted JSON."""
    if classification.intent == Intent.LOG_TRANSACTION:
        return _build_transaction(prompt, classification, ctx)
    if classification.intent == Intent.CREATE_BUDGET:
        return _build_budget(prompt, classification, ctx)
    return None


def _build_transaction(
    prompt: str,
    classification: ClassificationResult,
    ctx: FinanceContext,
) -> ActionPayload | None:
    if not classification.extracted_amount:
        return None

    tx_type = _transaction_type(prompt)
    category_id = None if tx_type == "INCOME" else _match_category_id(
        ctx,
        classification.extracted_categories,
    )

    return ActionPayload(
        action=ActionType.CREATE_TRANSACTION,
        data={
            "type": tx_type,
            "amount": classification.extracted_amount,
            "description": _description(prompt, classification),
            "categoryId": category_id,
            "occurredAt": _date_for_timeframe(classification.extracted_timeframe),
        },
    )


def _build_budget(
    prompt: str,
    classification: ClassificationResult,
    ctx: FinanceContext,
) -> ActionPayload | None:
    if not classification.extracted_amount or not ctx.accounts:
        return None

    today = date.today()
    if "week" in (classification.extracted_timeframe or prompt).lower():
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
        period = "WEEKLY"
    else:
        start = today.replace(day=1)
        end = today.replace(day=calendar.monthrange(today.year, today.month)[1])
        period = "MONTHLY"

    return ActionPayload(
        action=ActionType.CREATE_BUDGET,
        data={
            "accountId": ctx.accounts[0].id,
            "categoryId": _match_category_id(ctx, classification.extracted_categories),
            "amountLimit": classification.extracted_amount,
            "period": period,
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
        },
    )


def _transaction_type(prompt: str) -> str:
    lowered = prompt.lower()
    if any(word in lowered for word in ["received", "earned", "salary", "income", "lương", "nhận"]):
        return "INCOME"
    return "EXPENSE"


def _match_category_id(ctx: FinanceContext, categories: list[str]) -> str | None:
    wanted = {cat.lower() for cat in categories}
    for category in ctx.categories:
        if category.name.lower() in wanted:
            return category.id
    for category in ctx.categories:
        if any(cat in category.name.lower() or category.name.lower() in cat for cat in wanted):
            return category.id
    return None


def _description(prompt: str, classification: ClassificationResult) -> str:
    lowered = prompt.lower()
    for keyword in _DESCRIPTION_KEYWORDS:
        if keyword in lowered:
            return keyword.title()
    if classification.extracted_categories:
        return classification.extracted_categories[0].title()
    return "Transaction"


def _date_for_timeframe(timeframe: str | None) -> str:
    today = date.today()
    if timeframe == "yesterday" or timeframe == "hôm qua":
        return (today - timedelta(days=1)).isoformat()
    return today.isoformat()
