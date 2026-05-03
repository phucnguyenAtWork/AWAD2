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

_ACTION_RE = re.compile(r"```(?:action|json)?\s*([\s\S]*?)```", re.IGNORECASE)
_JSON_ACTION_RE = re.compile(r"(\{\s*\"action\"\s*:\s*\"[^\"]+\"\s*,\s*\"data\"\s*:\s*\{[\s\S]*?\}\s*\})")


def parse_action(text: str) -> ActionPayload | None:
    """Extract and validate the first ```action``` block from model output.

    Returns None if no block found or validation fails.
    """
    raw = _extract_action_json(text)
    if raw is None:
        return None

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
        payload.data = _validate_action_data(payload)
    except (ValidationError, ValueError):
        return None

    return payload


def _extract_action_json(text: str) -> str | None:
    """Extract action JSON from an action/json fence or a bare JSON object."""
    for match in _ACTION_RE.finditer(text):
        raw = match.group(1).strip()
        if '"action"' in raw and '"data"' in raw:
            return raw

    match = _JSON_ACTION_RE.search(text)
    return match.group(1).strip() if match else None


def _validate_action_data(payload: ActionPayload) -> dict:
    """Type-check and normalize the data dict against the specific action schema."""
    if payload.action == ActionType.CREATE_TRANSACTION:
        return TransactionActionData(**payload.data).model_dump(exclude_none=True)
    elif payload.action == ActionType.CREATE_BUDGET:
        return BudgetActionData(**payload.data).model_dump(exclude_none=True)
    elif payload.action == ActionType.CREATE_CATEGORY:
        return CategoryActionData(**payload.data).model_dump(exclude_none=True)
    else:
        raise ValueError(f"Unknown action: {payload.action}")


def strip_action_blocks(text: str) -> str:
    """Remove all ```action ... ``` blocks from model output."""
    stripped = _ACTION_RE.sub("", text)
    stripped = _JSON_ACTION_RE.sub("", stripped)
    return stripped.strip()
