# backend/app/routers/review.py

from datetime import datetime, date, timedelta
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, conint
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.db import (
    get_db,
    Deck,
    Card,
    CardSRS,
    ReviewSession,
    ReviewAnswer,
)

router = APIRouter()


# --------- Pydantic схемы для ответа ---------

class CardSRSModel(BaseModel):
    interval: int
    repetitions: int
    ease_factor: float
    next_review: Optional[date]      # ✅ DB: date
    last_grade: Optional[int]

    class Config:
        from_attributes = True


class ReviewCard(BaseModel):
    id: int
    question: str
    answer: str
    srs: Optional[CardSRSModel]

    class Config:
        from_attributes = True


class DeckShort(BaseModel):
    id: int
    title: str

    class Config:
        from_attributes = True


class NextCardResponse(BaseModel):
    card: Optional[ReviewCard]
    deck: DeckShort


class AnswerRequest(BaseModel):
    deck_id: int
    card_id: int
    grade: conint(ge=0, le=5)  # ✅ SM-2 quality 0..5


class AnswerResponse(BaseModel):
    success: bool
    next_card: Optional[ReviewCard]


# --------- SM-2 update ---------
def sm2_update(srs: CardSRS, grade: int) -> CardSRS:
    """
    SM-2:
    - quality: 0..5
    - grade < 3 => fail, repetitions reset
    - intervals: 1, 6, then prev * EF (round up)
    - EF update formula, min 1.3
    :contentReference[oaicite:4]{index=4}
    """
    today = datetime.utcnow().date()

    if grade < 3:
        srs.repetitions = 0
        srs.interval = 1
    else:
        srs.repetitions += 1
        if srs.repetitions == 1:
            srs.interval = 1
        elif srs.repetitions == 2:
            srs.interval = 6
        else:
            srs.interval = max(1, int(ceil(srs.interval * srs.ease_factor)))

    srs.ease_factor = max(
        1.3,
        srs.ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
    )

    srs.next_review = today + timedelta(days=srs.interval)
    srs.last_grade = grade
    return srs


def get_or_create_open_session(db: Session, deck_id: int) -> ReviewSession:
    """
    Get the latest open session (finished_at IS NULL) for a deck,
    or create a new one.
    """
    session = (
        db.query(ReviewSession)
        .filter(ReviewSession.deck_id == deck_id, ReviewSession.finished_at == None)  # noqa: E711
        .order_by(ReviewSession.started_at.desc())
        .first()
    )
    if session:
        return session

    session = ReviewSession(
        deck_id=deck_id,
        started_at=datetime.utcnow(),
        finished_at=None,
    )
    db.add(session)
    db.flush()  # to get session.id
    return session


# --------- Endpoints ---------

@router.get("/next", response_model=NextCardResponse)
def get_next_card(deck_id: int = Query(...), db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    q = (
        db.query(Card, CardSRS)
        .outerjoin(CardSRS, CardSRS.card_id == Card.id)
        .filter(Card.deck_id == deck_id)
    )

    today = datetime.utcnow().date()

    # 1) Due cards (next_review <= today)
    candidates = (
        q.filter(
            CardSRS.next_review != None,  # noqa: E711
            CardSRS.next_review <= today,
        )
        .order_by(CardSRS.next_review.asc(), Card.id.asc())
        .all()
    )

    # 2) New/unscheduled cards (no SRS row OR next_review is NULL)
    if not candidates:
        new_cards = (
            q.filter(
                or_(
                    CardSRS.id == None,           # noqa: E711
                    CardSRS.next_review == None,  # noqa: E711
                )
            )
            .order_by(Card.id.asc())
            .all()
        )
        if not new_cards:
            return NextCardResponse(card=None, deck=DeckShort.from_orm(deck))
        card_obj, srs_obj = new_cards[0]
    else:
        card_obj, srs_obj = candidates[0]

    card_out = ReviewCard(
        id=card_obj.id,
        question=card_obj.question,
        answer=card_obj.answer,
        srs=CardSRSModel.from_orm(srs_obj) if srs_obj else None,
    )

    return NextCardResponse(card=card_out, deck=DeckShort.from_orm(deck))


@router.post("/answer", response_model=AnswerResponse)
def answer_card(payload: AnswerRequest, db: Session = Depends(get_db)):
    card = (
        db.query(Card)
        .filter(Card.id == payload.card_id, Card.deck_id == payload.deck_id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # ✅ Ensure we have an open session for this deck
    session = get_or_create_open_session(db, payload.deck_id)

    # Find/create SRS row
    srs = db.query(CardSRS).filter(CardSRS.card_id == card.id).first()
    if not srs:
        srs = CardSRS(
            card_id=card.id,
            interval=0,
            repetitions=0,
            ease_factor=2.5,
            next_review=None,
            last_grade=None,
        )
        db.add(srs)
        db.flush()

    # Update SRS (SM-2)
    sm2_update(srs, int(payload.grade))

    # ✅ Save answer history (this will fill review_answers table)
    ans = ReviewAnswer(
        session_id=session.id,
        card_id=card.id,
        rating=str(int(payload.grade)),  # store 0..5 as text
        note=None,
    )
    db.add(ans)

    db.commit()
    db.refresh(srs)

    # Next card
    next_response = get_next_card(deck_id=payload.deck_id, db=db)

    # ✅ If session finished, mark finished_at
    if next_response.card is None:
        session.finished_at = datetime.utcnow()
        db.commit()

    return AnswerResponse(success=True, next_card=next_response.card)
