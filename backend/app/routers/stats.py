from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from backend.db import get_db, Deck, Card, CardSRS
from backend.app.auth import get_current_user_id  # <-- عدّل المسار إذا ملفك بمكان مختلف

router = APIRouter()


class StatsOverview(BaseModel):
    """
    Сводная статистика по обучению (UC-4) — per user.
    """
    total_decks: int
    total_cards: int
    due_today: int
    learned_cards: int
    reviewed_cards: int


@router.get("/overview", response_model=StatsOverview)
def get_stats_overview(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),  # <-- حماية + نجيب uid الحالي
) -> StatsOverview:
    today = date.today()

    # 1) Totals (ONLY user decks)
    total_decks = db.query(Deck).filter(Deck.owner_uid == user_id).count()

    total_cards = (
        db.query(Card)
        .join(Deck, Deck.id == Card.deck_id)
        .filter(Deck.owner_uid == user_id)
        .count()
    )

    # 2) Due today (ONLY cards in user decks)
    due_today = (
        db.query(Card)
        .join(Deck, Deck.id == Card.deck_id)
        .outerjoin(CardSRS, CardSRS.card_id == Card.id)
        .filter(Deck.owner_uid == user_id)
        .filter(
            or_(
                CardSRS.id.is_(None),
                CardSRS.next_review.is_(None),
                CardSRS.next_review <= today,
            )
        )
        .count()
    )

    # 3) Learned (ONLY user cards)
    learned_cards = (
        db.query(CardSRS)
        .join(Card, Card.id == CardSRS.card_id)
        .join(Deck, Deck.id == Card.deck_id)
        .filter(Deck.owner_uid == user_id)
        .filter(CardSRS.repetitions >= 3)
        .count()
    )

    # 4) Reviewed cards (ONLY user cards)
    # نعتمد SQL لأن review_answers غالبًا جدول بدون ORM model عندك
    reviewed_cards = int(
        db.execute(
            text(
                """
                SELECT COUNT(DISTINCT ra.card_id)
                FROM review_answers ra
                JOIN cards c ON c.id = ra.card_id
                JOIN decks d ON d.id = c.deck_id
                WHERE d.owner_uid = :uid
                """
            ),
            {"uid": user_id},
        ).scalar()
        or 0
    )

    return StatsOverview(
        total_decks=total_decks,
        total_cards=total_cards,
        due_today=due_today,
        learned_cards=learned_cards,
        reviewed_cards=reviewed_cards,
    )
