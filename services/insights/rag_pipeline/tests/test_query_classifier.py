"""Unit tests for query intent classification."""

from rag_pipeline.query_classifier import Intent, classify


def test_log_amount_item_today_is_transaction_intent():
    result = classify("Well i log 50k coffee today")

    assert result.intent == Intent.LOG_TRANSACTION
    assert result.extracted_amount == 50000
    assert result.extracted_categories == ["food"]
    assert result.extracted_timeframe == "today"


def test_add_budget_with_amount_stays_budget_intent():
    result = classify("add budget 1M for shopping this month")

    assert result.intent == Intent.CREATE_BUDGET
    assert result.extracted_amount == 1_000_000
    assert result.extracted_categories == ["shopping"]
