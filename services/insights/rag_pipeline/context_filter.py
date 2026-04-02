"""Relevant context selection — filter financial data based on query intent.

Instead of dumping ALL transactions/budgets/categories into the prompt every time,
this module selects only the relevant subset based on the classified intent and
extracted entities. This is what makes the pipeline *actual* retrieval.
"""

from __future__ import annotations

from .models import FinanceContext, Transaction, Budget
from .query_classifier import ClassificationResult, Intent


def filter_context(ctx: FinanceContext, classification: ClassificationResult) -> FinanceContext:
    """Return a filtered FinanceContext based on query intent and extracted entities.

    Rules:
    - LOG_TRANSACTION / CREATE_BUDGET / CREATE_CATEGORY: full context (model needs IDs)
    - SPENDING_QUERY with category mention: only transactions in that category
    - INCOME_QUERY: only INCOME transactions
    - BUDGET_QUERY: only budgets + related transactions
    - TREND_QUERY: all transactions (needed for time series)
    - BALANCE_QUERY: all (overview needs everything)
    - GREETING / FINANCIAL_ADVICE: minimal context (summary only)
    """
    intent = classification.intent
    mentioned_cats = classification.extracted_categories

    # Action intents need full context for ID lookup
    if intent in (Intent.LOG_TRANSACTION, Intent.CREATE_BUDGET, Intent.CREATE_CATEGORY):
        return ctx

    # Balance and trend queries need full picture
    if intent in (Intent.BALANCE_QUERY, Intent.TREND_QUERY):
        return ctx

    # Greeting — minimal context, just accounts
    if intent == Intent.GREETING:
        return FinanceContext(
            accounts=ctx.accounts,
            categories=[],
            transactions=[],
            budgets=[],
        )

    # Spending query — filter by mentioned categories if any
    if intent == Intent.SPENDING_QUERY and mentioned_cats:
        filtered_tx = _filter_transactions_by_category(ctx, mentioned_cats)
        filtered_budgets = _filter_budgets_by_category(ctx, mentioned_cats)
        return FinanceContext(
            accounts=ctx.accounts,
            categories=ctx.categories,
            transactions=filtered_tx if filtered_tx else ctx.transactions,
            budgets=filtered_budgets if filtered_budgets else ctx.budgets,
        )

    # Income query — only INCOME transactions
    if intent == Intent.INCOME_QUERY:
        income_tx = [t for t in ctx.transactions if t.type == "INCOME"]
        return FinanceContext(
            accounts=ctx.accounts,
            categories=ctx.categories,
            transactions=income_tx if income_tx else ctx.transactions,
            budgets=[],
        )

    # Budget query — budgets + their related transactions
    if intent == Intent.BUDGET_QUERY:
        budget_cat_ids = {b.categoryId for b in ctx.budgets if b.categoryId}
        related_tx = [t for t in ctx.transactions if t.categoryId in budget_cat_ids]
        return FinanceContext(
            accounts=ctx.accounts,
            categories=ctx.categories,
            transactions=related_tx if related_tx else ctx.transactions,
            budgets=ctx.budgets,
        )

    # Default: return full context
    return ctx


def _filter_transactions_by_category(
    ctx: FinanceContext, mentioned_cats: list[str]
) -> list[Transaction]:
    """Match mentioned category keywords against actual category names."""
    # Build a set of category IDs that match the mentioned keywords
    matching_cat_ids: set[str] = set()
    for cat in ctx.categories:
        cat_lower = cat.name.lower()
        for mentioned in mentioned_cats:
            if mentioned in cat_lower or cat_lower in mentioned:
                matching_cat_ids.add(cat.id)
                break

    if not matching_cat_ids:
        return []

    return [t for t in ctx.transactions if t.categoryId in matching_cat_ids]


def _filter_budgets_by_category(
    ctx: FinanceContext, mentioned_cats: list[str]
) -> list[Budget]:
    """Filter budgets matching mentioned categories."""
    matching_cat_ids: set[str] = set()
    for cat in ctx.categories:
        cat_lower = cat.name.lower()
        for mentioned in mentioned_cats:
            if mentioned in cat_lower or cat_lower in mentioned:
                matching_cat_ids.add(cat.id)
                break

    if not matching_cat_ids:
        return []

    return [b for b in ctx.budgets if b.categoryId in matching_cat_ids]
