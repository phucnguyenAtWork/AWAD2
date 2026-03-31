"""Auth-aware async client for the Finance API."""

from __future__ import annotations

import httpx

from .config import settings
from .models import Account, Budget, Category, FinanceContext, Transaction


_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=settings.FINANCE_API_URL,
            timeout=10.0,
        )
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _safe_get(token: str, path: str, label: str) -> list[dict]:
    """GET with graceful degradation — returns [] on failure."""
    try:
        resp = await _get_client().get(path, headers=_headers(token))
        if resp.status_code == 401:
            raise httpx.HTTPStatusError(
                "Unauthorized", request=resp.request, response=resp
            )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise  # propagate auth failures
        print(f"[RAG] Failed to fetch {label}: {exc.response.status_code}")
        return []
    except Exception as exc:
        print(f"[RAG] Failed to fetch {label}: {exc}")
        return []


async def fetch_context(token: str) -> FinanceContext:
    """Fetch the authenticated user's full finance context."""
    accounts_raw, categories_raw, transactions_raw, budgets_raw = (
        await _safe_get(token, "/accounts", "accounts"),
        await _safe_get(token, "/categories", "categories"),
        await _safe_get(token, "/transactions", "transactions"),
        await _safe_get(token, "/budgets", "budgets"),
    )
    return FinanceContext(
        accounts=[Account(**a) for a in accounts_raw],
        categories=[Category(**c) for c in categories_raw],
        transactions=[Transaction(**t) for t in transactions_raw],
        budgets=[Budget(**b) for b in budgets_raw],
    )


# ─── Write operations (used by action executor) ──────────────────────

async def create_transaction(token: str, data: dict) -> dict:
    resp = await _get_client().post(
        "/transactions", headers=_headers(token), json=data
    )
    resp.raise_for_status()
    return resp.json()


async def create_budget(token: str, data: dict) -> dict:
    resp = await _get_client().post(
        "/budgets", headers=_headers(token), json=data
    )
    resp.raise_for_status()
    return resp.json()


async def create_category(token: str, data: dict) -> dict:
    resp = await _get_client().post(
        "/categories", headers=_headers(token), json=data
    )
    resp.raise_for_status()
    return resp.json()
