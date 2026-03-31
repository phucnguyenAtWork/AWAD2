"""Unit tests for context_builder — analytics computation and capping."""

import pytest

from rag_pipeline.context_builder import cap_context, compute_analytics
from rag_pipeline.models import (
    Account,
    Budget,
    Category,
    FinanceContext,
    Transaction,
)


def _make_ctx(
    transactions: list[Transaction] | None = None,
    categories: list[Category] | None = None,
) -> FinanceContext:
    return FinanceContext(
        accounts=[Account(id="a1", name="Main", type="CHECKING", currency="VND")],
        categories=categories
        or [
            Category(id="c1", name="Food", type="EXPENSE"),
            Category(id="c2", name="Transport", type="EXPENSE"),
        ],
        transactions=transactions or [],
        budgets=[
            Budget(
                id="b1",
                accountId="a1",
                categoryId="c1",
                amountLimit="1000000",
                period="MONTHLY",
                startDate="2026-03-01",
                endDate="2026-03-31",
            )
        ],
    )


class TestComputeAnalytics:
    def test_empty_transactions(self):
        ctx = _make_ctx(transactions=[])
        a = compute_analytics(ctx, "VND")
        assert a.total_income == 0
        assert a.total_expense == 0
        assert a.transaction_count == 0

    def test_income_and_expense(self):
        txs = [
            Transaction(
                id="t1",
                type="INCOME",
                amount="5000000",
                occurredAt="2026-03-15",
                currency="VND",
            ),
            Transaction(
                id="t2",
                type="EXPENSE",
                amount="200000",
                description="Lunch",
                categoryId="c1",
                occurredAt="2026-03-20",
                currency="VND",
            ),
        ]
        ctx = _make_ctx(transactions=txs)
        a = compute_analytics(ctx, "VND")
        assert a.total_income == 5_000_000
        assert a.total_expense == 200_000
        assert a.net_balance == 4_800_000
        assert a.transaction_count == 2

    def test_category_spending_sorted(self):
        txs = [
            Transaction(
                id="t1",
                type="EXPENSE",
                amount="300000",
                categoryId="c1",
                occurredAt="2026-03-10",
                currency="VND",
            ),
            Transaction(
                id="t2",
                type="EXPENSE",
                amount="100000",
                categoryId="c2",
                occurredAt="2026-03-11",
                currency="VND",
            ),
        ]
        ctx = _make_ctx(transactions=txs)
        a = compute_analytics(ctx, "VND")
        # Food (300k) should appear before Transport (100k)
        assert "Food" in a.top_categories
        lines = a.top_categories.strip().split("\n")
        assert "Food" in lines[0]


class TestCapContext:
    def test_caps_transactions(self):
        txs = [
            Transaction(
                id=f"t{i}",
                type="EXPENSE",
                amount="1000",
                occurredAt="2026-03-01",
                currency="VND",
            )
            for i in range(50)
        ]
        ctx = _make_ctx(transactions=txs)
        capped = cap_context(ctx)
        assert len(capped.transactions) <= 20  # MAX_TRANSACTIONS default
        assert len(capped.accounts) == 1  # accounts preserved
