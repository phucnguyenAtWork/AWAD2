"""Async MySQL connection pool and chat-log repository."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import aiomysql

from .config import settings
from .models import ChatLogRow

_pool: aiomysql.Pool | None = None


async def get_pool() -> aiomysql.Pool:
    global _pool
    if _pool is None:
        _pool = await aiomysql.create_pool(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            db=settings.INSIGHTS_DATABASE,
            maxsize=settings.DB_POOL_SIZE,
            autocommit=True,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None


async def check_connection() -> None:
    """Verify the DB pool connects and the chat_logs table exists."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT 1 FROM chat_logs LIMIT 0")


# ─── Repository helpers ───────────────────────────────────────────────

def _row_to_log(row: tuple) -> ChatLogRow:
    return ChatLogRow(
        id=row[0],
        account_id=row[1],
        user_query=row[2],
        ai_response=row[3],
        context_snapshot=json.loads(row[4]) if row[4] else None,
        action=json.loads(row[5]) if row[5] else None,
        model_name=row[6],
        latency_ms=row[7],
        prompt_tokens=row[8],
        response_tokens=row[9],
        request_id=row[10],
        timestamp=row[11],
    )


_SELECT_COLS = (
    "id, account_id, user_query, ai_response, context_snapshot, "
    "action, model_name, latency_ms, prompt_tokens, response_tokens, request_id, timestamp"
)


async def create_log(
    *,
    account_id: str,
    user_query: str,
    ai_response: str,
    context_snapshot: Any | None = None,
    action: Any | None = None,
    model_name: str | None = None,
    latency_ms: int | None = None,
    prompt_tokens: int | None = None,
    response_tokens: int | None = None,
    request_id: str | None = None,
) -> ChatLogRow:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """INSERT INTO chat_logs
                   (account_id, user_query, ai_response, context_snapshot,
                    action, model_name, latency_ms, prompt_tokens, response_tokens, request_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    account_id,
                    user_query,
                    ai_response,
                    json.dumps(context_snapshot) if context_snapshot else None,
                    json.dumps(action) if action else None,
                    model_name,
                    latency_ms,
                    prompt_tokens,
                    response_tokens,
                    request_id,
                ),
            )
            last_id = cur.lastrowid
            await cur.execute(
                f"SELECT {_SELECT_COLS} FROM chat_logs WHERE id = %s",
                (last_id,),
            )
            row = await cur.fetchone()
            return _row_to_log(row)


async def list_logs(account_id: str, limit: int = 100) -> list[ChatLogRow]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"SELECT {_SELECT_COLS} FROM chat_logs WHERE account_id = %s ORDER BY timestamp DESC LIMIT %s",
                (account_id, limit),
            )
            rows = await cur.fetchall()
            return [_row_to_log(r) for r in rows]


async def get_log(log_id: int) -> ChatLogRow | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"SELECT {_SELECT_COLS} FROM chat_logs WHERE id = %s",
                (log_id,),
            )
            row = await cur.fetchone()
            return _row_to_log(row) if row else None


async def delete_log(log_id: int) -> ChatLogRow | None:
    existing = await get_log(log_id)
    if not existing:
        return None
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM chat_logs WHERE id = %s", (log_id,))
    return existing
