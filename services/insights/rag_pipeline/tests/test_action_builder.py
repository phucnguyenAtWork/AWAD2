"""Unit tests for deterministic fallback actions."""

from rag_pipeline.action_builder import build_fallback_action
from rag_pipeline.models import Account, Category, FinanceContext
from rag_pipeline.query_classifier import classify


def test_builds_transaction_for_log_amount_item_today():
    ctx = FinanceContext(
        accounts=[Account(id="acc-1", name="Main", type="CASH", currency="VND")],
        categories=[Category(id="cat-food", name="Food", type="EXPENSE")],
    )
    classification = classify("Well i log 50k coffee today")

    action = build_fallback_action("Well i log 50k coffee today", classification, ctx)

    assert action is not None
    assert action.action.value == "create_transaction"
    assert action.data["type"] == "EXPENSE"
    assert action.data["amount"] == 50000
    assert action.data["description"] == "Coffee"
    assert action.data["categoryId"] == "cat-food"


def test_builds_budget_for_add_budget_amount_category():
    ctx = FinanceContext(
        accounts=[Account(id="acc-1", name="Main", type="CASH", currency="VND")],
        categories=[Category(id="cat-shopping", name="Shopping", type="EXPENSE")],
    )
    classification = classify("add budget 1M for shopping this month")

    action = build_fallback_action("add budget 1M for shopping this month", classification, ctx)

    assert action is not None
    assert action.action.value == "create_budget"
    assert action.data["accountId"] == "acc-1"
    assert action.data["categoryId"] == "cat-shopping"
    assert action.data["amountLimit"] == 1_000_000
    assert action.data["period"] == "MONTHLY"
