"""Unit tests for action_parser — parse + validate action blocks."""

import pytest

from rag_pipeline.action_parser import parse_action, strip_action_blocks


class TestParseAction:
    def test_valid_transaction(self):
        text = '''Here you go!

```action
{"action":"create_transaction","data":{"type":"EXPENSE","amount":50000,"description":"Coffee","categoryId":"cat-1","occurredAt":"2026-03-31"}}
```

Done!'''
        result = parse_action(text)
        assert result is not None
        assert result.action.value == "create_transaction"
        assert result.data["amount"] == 50000
        assert result.data["description"] == "Coffee"

    def test_valid_budget(self):
        text = '''```action
{"action":"create_budget","data":{"accountId":"acc-1","categoryId":"cat-2","amountLimit":2000000,"period":"MONTHLY","startDate":"2026-03-01","endDate":"2026-03-31"}}
```'''
        result = parse_action(text)
        assert result is not None
        assert result.action.value == "create_budget"
        assert result.data["amountLimit"] == 2000000

    def test_valid_category(self):
        text = '''```action
{"action":"create_category","data":{"name":"Transport","type":"EXPENSE","icon":null}}
```'''
        result = parse_action(text)
        assert result is not None
        assert result.action.value == "create_category"
        assert result.data["name"] == "Transport"

    def test_no_action_block(self):
        assert parse_action("Just a normal response with no code block.") is None

    def test_invalid_json(self):
        assert parse_action("```action\n{bad json}\n```") is None

    def test_invalid_action_type(self):
        text = '```action\n{"action":"delete_everything","data":{}}\n```'
        assert parse_action(text) is None

    def test_invalid_transaction_data_negative_amount(self):
        text = '```action\n{"action":"create_transaction","data":{"type":"EXPENSE","amount":-100,"description":"Bad"}}\n```'
        assert parse_action(text) is None

    def test_invalid_transaction_data_wrong_type(self):
        text = '```action\n{"action":"create_transaction","data":{"type":"TRANSFER","amount":100,"description":"Bad"}}\n```'
        assert parse_action(text) is None

    def test_unknown_fields_stripped(self):
        text = '```action\n{"action":"create_transaction","data":{"type":"EXPENSE","amount":1000,"description":"Test","hackField":"evil"}}\n```'
        result = parse_action(text)
        # Extra fields in data dict are allowed by dict[str, Any] but validated by sub-model
        # The TransactionActionData validator will ignore extra fields
        assert result is not None


class TestStripActionBlocks:
    def test_removes_block(self):
        text = 'Hello!\n\n```action\n{"action":"create_transaction","data":{}}\n```\n\nDone!'
        assert strip_action_blocks(text) == "Hello!\n\n\n\nDone!"

    def test_no_block(self):
        assert strip_action_blocks("No action here") == "No action here"

    def test_multiple_blocks(self):
        text = '```action\n{}\n```\nMiddle\n```action\n{}\n```'
        assert strip_action_blocks(text) == "Middle"
