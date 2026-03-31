"""Execute validated actions by calling the Finance API."""

from __future__ import annotations

from .finance_client import create_budget, create_category, create_transaction
from .models import ActionPayload, ActionType, FinanceContext


async def execute_action(
    action: ActionPayload,
    token: str,
    ctx: FinanceContext,
    currency: str,
) -> str:
    """Call the Finance API and return a human-readable confirmation string."""

    if action.action == ActionType.CREATE_TRANSACTION:
        result = await create_transaction(token, action.data)
        cat_name = _lookup_category(ctx, result.get("categoryId"))
        amount = float(result.get("amount", 0))
        return (
            f'Transaction logged: {result.get("type")} '
            f'{amount:,.0f} {currency} — "{result.get("description", "")}" [{cat_name}]'
        )

    if action.action == ActionType.CREATE_BUDGET:
        result = await create_budget(token, action.data)
        cat_name = _lookup_category(ctx, result.get("categoryId")) or "Overall"
        amount = float(result.get("amountLimit", 0))
        return (
            f"Budget created: {cat_name} — limit {amount:,.0f} {currency} "
            f'({result.get("period", "MONTHLY")})'
        )

    if action.action == ActionType.CREATE_CATEGORY:
        result = await create_category(token, action.data)
        return f'Category created: "{result.get("name")}" ({result.get("type")})'

    return "Unknown action"


def _lookup_category(ctx: FinanceContext, cat_id: str | None) -> str:
    if not cat_id:
        return "Uncategorized"
    return next(
        (c.name for c in ctx.categories if c.id == cat_id),
        "Uncategorized",
    )
