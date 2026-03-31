"""Retrieval layer — build and cache FinanceContext with lightweight aggregates."""

from __future__ import annotations

import time
from datetime import datetime

from cachetools import TTLCache

from .config import settings
from .finance_client import fetch_context
from .models import Analytics, FinanceContext

# Per-account TTL cache: key=accountId, value=(FinanceContext, Analytics)
_cache: TTLCache[str, tuple[FinanceContext, Analytics]] = TTLCache(
    maxsize=256,
    ttl=settings.CONTEXT_CACHE_TTL,
)


def compute_analytics(ctx: FinanceContext, currency: str) -> Analytics:
    """Compute lightweight aggregates from the raw finance context."""
    now = datetime.now()
    current_month = now.month
    current_year = now.year

    total_income = 0.0
    total_expense = 0.0
    month_income = 0.0
    month_expense = 0.0
    category_spending: dict[str, float] = {}
    monthly_spending: dict[str, dict[str, float]] = {}

    cat_lookup = {c.id: c.name for c in ctx.categories}

    for tx in ctx.transactions:
        amount = float(tx.amount)
        try:
            tx_date = datetime.fromisoformat(tx.occurredAt.replace("Z", "+00:00"))
        except ValueError:
            continue
        month_key = f"{tx_date.year}-{tx_date.month:02d}"
        is_current = tx_date.month == current_month and tx_date.year == current_year

        if month_key not in monthly_spending:
            monthly_spending[month_key] = {"income": 0, "expense": 0}
        month_data = monthly_spending[month_key]

        if tx.type == "INCOME":
            total_income += amount
            month_data["income"] += amount
            if is_current:
                month_income += amount
        else:
            total_expense += amount
            month_data["expense"] += amount
            if is_current:
                month_expense += amount

            cat_name = cat_lookup.get(tx.categoryId or "", "Uncategorized")
            category_spending[cat_name] = category_spending.get(cat_name, 0) + amount

    # Top N categories descending
    top_cats = sorted(category_spending.items(), key=lambda x: x[1], reverse=True)[
        : settings.MAX_CATEGORIES
    ]
    top_categories = "\n".join(
        f"  - {name}: {amount:,.0f} {currency}" for name, amount in top_cats
    )

    # Last 3 months
    sorted_months_list = sorted(monthly_spending.items(), key=lambda x: x[0], reverse=True)[:3]
    sorted_months = "\n".join(
        f"  - {m}: Income {d['income']:,.0f} {currency}, Expense {d['expense']:,.0f} {currency}, Net {d['income'] - d['expense']:,.0f} {currency}"
        for m, d in sorted_months_list
    )

    return Analytics(
        total_income=total_income,
        total_expense=total_expense,
        net_balance=total_income - total_expense,
        month_income=month_income,
        month_expense=month_expense,
        month_net=month_income - month_expense,
        top_categories=top_categories,
        sorted_months=sorted_months,
        transaction_count=len(ctx.transactions),
    )


def cap_context(ctx: FinanceContext) -> FinanceContext:
    """Trim context to configured max sizes for cost control."""
    return FinanceContext(
        accounts=ctx.accounts,
        categories=ctx.categories,
        transactions=ctx.transactions[: settings.MAX_TRANSACTIONS],
        budgets=ctx.budgets[: settings.MAX_BUDGETS],
    )


async def build_context(
    token: str, account_id: str
) -> tuple[FinanceContext, Analytics, str]:
    """Fetch (or cache) finance context and compute analytics.

    Returns (capped_context, analytics, currency).
    """
    cached = _cache.get(account_id)
    if cached is not None:
        ctx, analytics = cached
        currency = ctx.accounts[0].currency if ctx.accounts else "VND"
        return ctx, analytics, currency

    raw_ctx = await fetch_context(token)
    capped = cap_context(raw_ctx)
    currency = capped.accounts[0].currency if capped.accounts else "VND"
    analytics = compute_analytics(raw_ctx, currency)  # compute on full data

    _cache[account_id] = (capped, analytics)
    return capped, analytics, currency
