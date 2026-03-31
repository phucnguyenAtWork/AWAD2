"""Unit tests for finance_client — mock HTTP calls with respx."""

import pytest
import respx
from httpx import Response

from rag_pipeline.config import settings
from rag_pipeline.finance_client import fetch_context, create_transaction


BASE = settings.FINANCE_API_URL


@pytest.fixture(autouse=True)
def _reset_client():
    """Reset the global httpx client between tests."""
    import rag_pipeline.finance_client as fc
    fc._client = None
    yield
    fc._client = None


@respx.mock
@pytest.mark.asyncio
async def test_fetch_context_success():
    respx.get(f"{BASE}/accounts").mock(
        return_value=Response(200, json=[{"id": "a1", "name": "Main", "type": "CHECKING", "currency": "VND"}])
    )
    respx.get(f"{BASE}/categories").mock(
        return_value=Response(200, json=[{"id": "c1", "name": "Food", "type": "EXPENSE"}])
    )
    respx.get(f"{BASE}/transactions").mock(
        return_value=Response(200, json=[])
    )
    respx.get(f"{BASE}/budgets").mock(
        return_value=Response(200, json=[])
    )

    ctx = await fetch_context("fake-token")
    assert len(ctx.accounts) == 1
    assert ctx.accounts[0].name == "Main"
    assert len(ctx.categories) == 1
    assert ctx.transactions == []
    assert ctx.budgets == []


@respx.mock
@pytest.mark.asyncio
async def test_fetch_context_partial_failure():
    """If one endpoint fails, the rest still return data."""
    respx.get(f"{BASE}/accounts").mock(
        return_value=Response(200, json=[{"id": "a1", "name": "Main", "type": "CHECKING", "currency": "VND"}])
    )
    respx.get(f"{BASE}/categories").mock(return_value=Response(500))
    respx.get(f"{BASE}/transactions").mock(return_value=Response(500))
    respx.get(f"{BASE}/budgets").mock(return_value=Response(500))

    ctx = await fetch_context("fake-token")
    assert len(ctx.accounts) == 1
    assert ctx.categories == []
    assert ctx.transactions == []


@respx.mock
@pytest.mark.asyncio
async def test_fetch_context_401_propagates():
    """401 from finance API should raise, not silently return []."""
    respx.get(f"{BASE}/accounts").mock(return_value=Response(401))
    respx.get(f"{BASE}/categories").mock(return_value=Response(200, json=[]))
    respx.get(f"{BASE}/transactions").mock(return_value=Response(200, json=[]))
    respx.get(f"{BASE}/budgets").mock(return_value=Response(200, json=[]))

    with pytest.raises(Exception):
        await fetch_context("bad-token")


@respx.mock
@pytest.mark.asyncio
async def test_create_transaction():
    respx.post(f"{BASE}/transactions").mock(
        return_value=Response(200, json={"id": "tx-1", "type": "EXPENSE", "amount": "50000", "description": "Coffee", "categoryId": "c1"})
    )
    result = await create_transaction("token", {"type": "EXPENSE", "amount": 50000, "description": "Coffee"})
    assert result["id"] == "tx-1"
