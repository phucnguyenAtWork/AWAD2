"""FastAPI application — HTTP layer for the Python RAG pipeline."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import database
from .auth import extract_raw_token, verify_token
from .chat_service import chat
from .config import settings
from .finance_client import close_client as close_finance_client
from .model_client import close_client as close_model_client
from .models import ChatLogRow, ChatRequest, ChatResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: verify DB connection. Shutdown: close pools."""
    await database.check_connection()
    print(f"[RAG] Database connected, ready on :{settings.RAG_PORT}")
    yield
    await close_finance_client()
    await close_model_client()
    await database.close_pool()


app = FastAPI(
    title="Insights RAG Pipeline",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "engine": "python-rag"}


# ─── Chat ──────────────────────────────────────────────────────────────

@app.post("/insights/chat", response_model=ChatResponse)
async def chat_endpoint(
    body: ChatRequest,
    user_id: str = Depends(verify_token),
    authorization: str = Header(...),
):
    token = extract_raw_token(authorization)
    try:
        return await chat(
            user_id=user_id,
            token=token,
            prompt=body.prompt,
            display_currency=body.displayCurrency,
        )
    except RuntimeError as exc:
        msg = str(exc)
        is_rate_limit = "429" in msg or "quota" in msg
        raise HTTPException(
            status_code=429 if is_rate_limit else 500,
            detail="AI rate limit exceeded. Please wait a moment and try again."
            if is_rate_limit
            else msg,
        )


# ─── Logs ──────────────────────────────────────────────────────────────

@app.get("/insights/logs", response_model=list[ChatLogRow])
async def list_logs(
    user_id: str = Depends(verify_token),
    accountId: Optional[str] = Query(None),
    limit: int = Query(default=100, ge=1, le=500),
):
    target = accountId or user_id
    return await database.list_logs(target, limit)


@app.get("/insights/logs/{log_id}", response_model=ChatLogRow)
async def get_log(log_id: int, _user_id: str = Depends(verify_token)):
    log = await database.get_log(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    return log


@app.delete("/insights/logs/{log_id}")
async def delete_log(log_id: int, _user_id: str = Depends(verify_token)):
    log = await database.delete_log(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    return {"success": True}


# ─── Entrypoint ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "rag_pipeline.main:app",
        host="0.0.0.0",
        port=settings.RAG_PORT,
        reload=True,
    )
