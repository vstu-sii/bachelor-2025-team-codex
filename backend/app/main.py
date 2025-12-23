# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import init_db
from .routers import ai, decks, review, stats
from .exceptions import init_exception_handlers

app = FastAPI(
    title="Auto-Flashcards API",
    description="MVP прототип backend-сервиса для проекта Auto-Flashcards (роль: Fullstack)",
    version="0.1.0",
)

# ✅ CORS: لا تستخدم "*" مع allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
)

init_exception_handlers(app)

@app.on_event("startup")
def on_startup() -> None:
    init_db()

@app.get("/health", tags=["system"])
async def health_check() -> dict:
    return {"status": "ok"}

app.include_router(ai.router, prefix="/ai", tags=["ai"])
app.include_router(decks.router, prefix="/decks", tags=["decks"])
app.include_router(review.router, prefix="/review", tags=["review"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])
