"""Parse and validate action blocks from AI responses using Pydantic."""

from __future__ import annotations

import json
import re

from pydantic import ValidationError

from .models import (
    ActionPayload,
    ActionType,
    BudgetActionData,
    CategoryActionData,
    TransactionActionData,
)

_ACTION_RE = re.compile(r"```action\s*([\s\S]*?)```")


def parse_action(text: str) -> ActionPayload | None:
    """Extract and validate the first ```action``` block from model output.

    Returns None if no block found or validation fails.
    """
    match = _ACTION_RE.search(text)
    if not match:
        return None

    raw = match.group(1).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None

    try:
        payload = ActionPayload(**data)
    except (ValidationError, ValueError):
        return None

    # Validate the nested data against the correct schema
    try:
        _validate_action_data(payload)
    except (ValidationError, ValueError):
        return None

    return payload


def _validate_action_data(payload: ActionPayload) -> None:
    """Type-check the data dict against the specific action schema."""
    if payload.action == ActionType.CREATE_TRANSACTION:
        TransactionActionData(**payload.data)
    elif payload.action == ActionType.CREATE_BUDGET:
        BudgetActionData(**payload.data)
    elif payload.action == ActionType.CREATE_CATEGORY:
        CategoryActionData(**payload.data)
    else:
        raise ValueError(f"Unknown action: {payload.action}")


def strip_action_blocks(text: str) -> str:
    """Remove all ```action ... ``` blocks from model output."""
    return _ACTION_RE.sub("", text).strip()
