"""Gemini API client for the RAG pipeline."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from .config import settings

_GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{settings.MODEL_NAME}:generateContent?key={settings.GEMINI_API_KEY}"
)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=60.0)
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


@dataclass
class ModelResponse:
    text: str
    prompt_tokens: int | None = None
    response_tokens: int | None = None


async def chat(
    system_instruction: str,
    messages: list[dict],
) -> ModelResponse:
    """Call Gemini with system instruction + conversation history.

    `messages` should be a list of {"role": "user"|"model", "parts": [{"text": "..."}]}.
    """
    body = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": messages,
    }

    resp = await _get_client().post(
        _GEMINI_URL,
        json=body,
        headers={"Content-Type": "application/json"},
    )

    if not resp.is_success:
        raise RuntimeError(f"Gemini API error {resp.status_code}: {resp.text}")

    data = resp.json()
    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )

    # Extract token counts if available
    usage = data.get("usageMetadata", {})
    prompt_tokens = usage.get("promptTokenCount")
    response_tokens = usage.get("candidatesTokenCount")

    return ModelResponse(
        text=text,
        prompt_tokens=prompt_tokens,
        response_tokens=response_tokens,
    )
