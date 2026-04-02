"""Query intent classification and topic guardrail for the RAG pipeline.

Classifies user prompts into intents BEFORE calling the LLM, enabling:
- Smart context selection (only retrieve relevant data)
- Topic guardrails (reject/redirect off-topic queries)
- Pipeline routing (different handling per intent)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum


class Intent(str, Enum):
    """Recognized user intents for the finance assistant."""
    SPENDING_QUERY = "spending_query"        # "How much did I spend on food?"
    INCOME_QUERY = "income_query"            # "What's my income this month?"
    BALANCE_QUERY = "balance_query"          # "What's my balance?"
    BUDGET_QUERY = "budget_query"            # "Am I over budget?"
    TREND_QUERY = "trend_query"             # "Show my spending trend"
    LOG_TRANSACTION = "log_transaction"      # "I spent 50k on coffee"
    CREATE_BUDGET = "create_budget"          # "Budget 2M for food"
    CREATE_CATEGORY = "create_category"      # "Create a Transport category"
    FINANCIAL_ADVICE = "financial_advice"    # "Should I save more?"
    GREETING = "greeting"                    # "Hi", "Hello"
    OFF_TOPIC = "off_topic"                 # "What's the weather?"


@dataclass
class ClassificationResult:
    """Output of the query classifier."""
    intent: Intent
    confidence: float                        # 0.0 – 1.0
    extracted_categories: list[str] = field(default_factory=list)
    extracted_amount: float | None = None
    extracted_timeframe: str | None = None   # "this month", "last week", etc.
    is_blocked: bool = False                 # True if topic guardrail triggered
    redirect_message: str | None = None      # Message to show if blocked


# ─── Pattern definitions ──────────────────────────────────────────────

_AMOUNT_RE = re.compile(
    r"(\d+[\.,]?\d*)\s*(k|m|tr|triệu|nghìn|million|thousand)?",
    re.IGNORECASE,
)

_TIMEFRAME_RE = re.compile(
    r"(this month|last month|this week|last week|today|yesterday|"
    r"this year|last year|in (?:january|february|march|april|may|june|"
    r"july|august|september|october|november|december)"
    r"|tháng này|tháng trước|hôm nay|hôm qua)",
    re.IGNORECASE,
)

# Keywords mapped to intents (checked in order, first match wins)
_INTENT_PATTERNS: list[tuple[Intent, list[str]]] = [
    (Intent.LOG_TRANSACTION, [
        r"\b(i\s+)?(spent|paid|bought|purchased|received|got paid|earned|income of)\b",
        r"\b(log|record|add)\s+(a\s+)?(transaction|expense|income|spending|payment)\b",
        r"\b(chi|tiêu|mua|nhận|lương)\b",
    ]),
    (Intent.CREATE_BUDGET, [
        r"\b(create|set|make|add)\s+(a\s+)?budget\b",
        r"\bbudget\s+\d",
        r"\b(tạo|đặt)\s+ngân\s*sách\b",
    ]),
    (Intent.CREATE_CATEGORY, [
        r"\b(create|add|make|new)\s+(a\s+)?category\b",
        r"\b(tạo|thêm)\s+(danh\s*mục|loại)\b",
    ]),
    (Intent.BUDGET_QUERY, [
        r"\b(budget|over\s*budget|under\s*budget|budget\s*left|remaining\s*budget)\b",
        r"\bngân\s*sách\b",
    ]),
    (Intent.TREND_QUERY, [
        r"\b(trends?|pattern|over\s*time|month\s*over|compare|comparison|growth|change)\b",
        r"\b(xu\s*hướng|so\s*sánh)\b",
    ]),
    (Intent.SPENDING_QUERY, [
        r"\b(how\s+much|what).{0,20}(spend|spent|spending|expense|cost)\b",
        r"\b(total|sum|breakdown).{0,15}(spend|expense|cost)\b",
        r"\b(spending|expenses?)\s+(on|for|in|by|this|last)\b",
        r"\b(chi\s*tiêu|đã\s*chi)\b",
    ]),
    (Intent.INCOME_QUERY, [
        r"\b(how\s+much|what).{0,20}(income|earn|salary|revenue)\b",
        r"\b(total|sum).{0,15}(income|earn)\b",
        r"\b(income|earnings?|salary)\s+(this|last|in|for)\b",
        r"\b(thu\s*nhập|lương)\b",
    ]),
    (Intent.BALANCE_QUERY, [
        r"\b(balance|net|how\s+much\s+do\s+i\s+have|account\s+summary|overview)\b",
        r"\b(số\s*dư|tổng\s*quan)\b",
    ]),
    (Intent.FINANCIAL_ADVICE, [
        r"\b(should\s+i|advice|suggest|recommend|help\s+me\s+save|can\s+i\s+afford|tips)\b",
        r"\b(how\s+(can|do|should)\s+i).{0,30}(save|reduce|cut|improve)\b",
        r"\b(tư\s*vấn|nên|gợi\s*ý)\b",
    ]),
    (Intent.GREETING, [
        r"^(hi|hello|hey|good\s+(morning|afternoon|evening)|xin\s+chào|chào)(\s+there)?\s*[!?.]*$",
    ]),
]

# Off-topic detection patterns
_OFF_TOPIC_PATTERNS: list[str] = [
    r"\b(weather|forecast|temperature|rain|sunny)\b",
    r"\b(recipe|cook|cooking|ingredient)\b",
    r"\b(movie|film|tv\s*show|series|watch|netflix)\b",
    r"\b(sports?|football|soccer|basketball|game\s+score)\b",
    r"\b(politics|election|president|government|vote)\b",
    r"\b(celebrity|gossip|entertainment)\b",
    r"\b(write\s+me\s+a|compose|poem|story|essay|joke)\b",
    r"\b(translate|translation)\b",
    r"\b(code|programming|python|javascript|html)\b(?!.*(cost|price|budget|spend))",
    r"\b(medical|health|symptom|doctor|disease)\b(?!.*(cost|price|insurance|bill|spend))",
    r"\b(dating|relationship|love)\b",
    r"\b(homework|assignment|school)\b(?!.*(cost|fee|tuition|spend))",
    r"\b(ignore|forget|disregard)\s+(all|previous|above|your)\s+(instructions?|rules?|prompt)\b",
    r"\b(pretend|act\s+as|you\s+are\s+now|new\s+role)\b",
]

# Financial topic keywords — if these appear alongside off-topic patterns, it's probably financial
_FINANCIAL_OVERRIDE: list[str] = [
    r"\b(cost|price|spend|spent|budget|afford|expense|income|money|pay|payment|fee|bill|save|invest)\b",
    r"\b(how\s+much|can\s+i\s+afford)\b",
]

# Category keywords for entity extraction
_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "food": ["food", "coffee", "lunch", "dinner", "breakfast", "snack", "restaurant", "eat", "meal", "grocery", "groceries", "ăn", "cà phê", "cơm"],
    "shopping": ["shopping", "clothes", "electronics", "amazon", "online", "buy", "purchase", "mua sắm"],
    "transport": ["transport", "uber", "grab", "taxi", "bus", "gas", "fuel", "petrol", "parking", "xăng", "xe"],
    "bill": ["bill", "utility", "electricity", "water", "internet", "phone", "rent", "subscription", "netflix", "spotify", "hoá đơn", "điện", "nước"],
    "entertainment": ["entertainment", "game", "movie", "cinema", "concert", "giải trí"],
    "health": ["health", "gym", "medicine", "hospital", "doctor", "pharmacy", "sức khoẻ"],
    "education": ["education", "course", "book", "school", "tuition", "học"],
}


def _extract_amount(text: str) -> float | None:
    """Extract monetary amount from text, handling shorthand (50k, 2M, 1tr)."""
    match = _AMOUNT_RE.search(text)
    if not match:
        return None
    num = float(match.group(1).replace(",", "."))
    suffix = (match.group(2) or "").lower()
    multipliers = {"k": 1_000, "nghìn": 1_000, "thousand": 1_000,
                   "m": 1_000_000, "triệu": 1_000_000, "million": 1_000_000,
                   "tr": 1_000_000}
    return num * multipliers.get(suffix, 1)


def _extract_timeframe(text: str) -> str | None:
    match = _TIMEFRAME_RE.search(text)
    return match.group(0).lower() if match else None


def _extract_categories(text: str) -> list[str]:
    """Extract mentioned category keywords from the query."""
    text_lower = text.lower()
    found = []
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            found.append(cat)
    return found


def _matches_any(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def classify(prompt: str) -> ClassificationResult:
    """Classify user prompt into an intent with extracted entities.

    Pipeline:
    1. Check for prompt injection attempts
    2. Check greeting (exact match)
    3. Check off-topic with financial override
    4. Match against intent patterns
    5. Default to financial_advice (benefit of the doubt)
    """
    text = prompt.strip()
    if not text:
        return ClassificationResult(intent=Intent.OFF_TOPIC, confidence=1.0,
                                    is_blocked=True, redirect_message="Please enter a message.")

    # Extract entities regardless of intent
    categories = _extract_categories(text)
    amount = _extract_amount(text)
    timeframe = _extract_timeframe(text)

    # 1. Prompt injection detection
    injection_patterns = [
        r"\b(ignore|forget|disregard)\s+(all\s+)?(previous\s+|above\s+|your\s+)?(instructions?|rules?|prompts?)\b",
        r"\b(pretend|act\s+as|you\s+are\s+now|new\s+role|system\s*prompt)\b",
        r"\b(do\s+not|don'?t)\s+follow\s+(your|the|any)\s+(rules?|instructions?|guidelines?)\b",
    ]
    if _matches_any(text, injection_patterns):
        return ClassificationResult(
            intent=Intent.OFF_TOPIC, confidence=0.95,
            is_blocked=True,
            redirect_message="I'm your personal finance assistant. I can help with spending analysis, "
                           "logging transactions, budgets, and financial advice. How can I help?",
        )

    # 2. Check intent patterns (ordered by specificity)
    for intent, patterns in _INTENT_PATTERNS:
        if _matches_any(text, patterns):
            return ClassificationResult(
                intent=intent, confidence=0.85,
                extracted_categories=categories,
                extracted_amount=amount,
                extracted_timeframe=timeframe,
            )

    # 3. Off-topic detection (only if no intent matched)
    is_off_topic = _matches_any(text, _OFF_TOPIC_PATTERNS)
    has_financial_context = _matches_any(text, _FINANCIAL_OVERRIDE)

    if is_off_topic and not has_financial_context:
        return ClassificationResult(
            intent=Intent.OFF_TOPIC, confidence=0.75,
            is_blocked=True,
            redirect_message="I'm specialized in personal finance. I can help you track spending, "
                           "log transactions, manage budgets, or give financial advice. "
                           "What would you like to know about your finances?",
        )

    # 4. Default — assume financial query (benefit of the doubt)
    return ClassificationResult(
        intent=Intent.FINANCIAL_ADVICE, confidence=0.5,
        extracted_categories=categories,
        extracted_amount=amount,
        extracted_timeframe=timeframe,
    )
