"""Pydantic models for the RAG pipeline — request/response shapes, DB rows, actions."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ─── Finance API shapes ───────────────────────────────────────────────

class Account(BaseModel):
    id: str
    name: str
    type: str
    currency: str


class Category(BaseModel):
    id: str
    name: str
    icon: str | None = None
    type: str
    accountId: str | None = None


class Transaction(BaseModel):
    id: str
    type: str  # "INCOME" | "EXPENSE"
    amount: str
    description: str | None = None
    categoryId: str | None = None
    occurredAt: str
    currency: str


class Budget(BaseModel):
    id: str
    accountId: str
    categoryId: str | None = None
    amountLimit: str
    period: str
    startDate: str
    endDate: str


class FinanceContext(BaseModel):
    accounts: list[Account] = []
    categories: list[Category] = []
    transactions: list[Transaction] = []
    budgets: list[Budget] = []


# ─── Analytics ─────────────────────────────────────────────────────────

class Analytics(BaseModel):
    total_income: float = 0
    total_expense: float = 0
    net_balance: float = 0
    month_income: float = 0
    month_expense: float = 0
    month_net: float = 0
    top_categories: str = ""
    sorted_months: str = ""
    transaction_count: int = 0


# ─── Actions ───────────────────────────────────────────────────────────

class ActionType(str, Enum):
    CREATE_TRANSACTION = "create_transaction"
    CREATE_BUDGET = "create_budget"
    CREATE_CATEGORY = "create_category"


class TransactionActionData(BaseModel):
    type: str = Field(pattern=r"^(INCOME|EXPENSE)$")
    amount: float = Field(gt=0)
    description: str
    categoryId: str | None = None
    occurredAt: str | None = None
    essential: bool | None = None


class BudgetActionData(BaseModel):
    accountId: str
    categoryId: str | None = None
    amountLimit: float = Field(gt=0)
    period: str | None = "MONTHLY"
    startDate: str
    endDate: str


class CategoryActionData(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: str = Field(pattern=r"^(INCOME|EXPENSE)$")
    icon: str | None = None


class ActionPayload(BaseModel):
    action: ActionType
    data: dict[str, Any]  # validated further by action_parser


# ─── Chat request / response ──────────────────────────────────────────

class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    displayCurrency: str | None = None


class ChatLogRow(BaseModel):
    id: int
    account_id: str
    user_query: str | None = None
    ai_response: str | None = None
    context_snapshot: Any | None = None
    action: Any | None = None
    model_name: str | None = None
    latency_ms: int | None = None
    prompt_tokens: int | None = None
    response_tokens: int | None = None
    request_id: str | None = None
    timestamp: datetime | None = None


class ChatResponse(BaseModel):
    response: str
    log: ChatLogRow
    request_id: str
