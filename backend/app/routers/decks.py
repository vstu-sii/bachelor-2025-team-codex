# backend/app/routers/decks.py
from __future__ import annotations

from datetime import date
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session, selectinload

from backend.app.auth import get_current_user
from backend.db import get_db, Deck as DeckORM, Card as CardORM, User as UserORM

router = APIRouter()


class CardSRS(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    interval: int = 0
    repetitions: int = 0
    ease_factor: float = 2.5
    next_review: Optional[date] = None
    last_grade: Optional[int] = None


class CardCreate(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    answer: str = Field(..., min_length=1, max_length=2000)


class Card(CardCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    srs: Optional[CardSRS] = None


class DeckCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)


class Deck(DeckCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cards: List[Card] = Field(default_factory=list)


def _ensure_public_user(db: Session, email: str, full_name: Optional[str] = None) -> UserORM:
    user = db.query(UserORM).filter(UserORM.email == email).first()
    if not user:
        user = UserORM(email=email, full_name=full_name)
        db.add(user)
        db.flush()  # يعطي user.id بدون commit كامل
    else:
        if full_name and not user.full_name:
            user.full_name = full_name
            db.flush()
    return user


def _get_deck_or_404(db: Session, deck_id: int, owner_uid: str) -> DeckORM:
    deck = (
        db.query(DeckORM)
        .options(selectinload(DeckORM.cards).selectinload(CardORM.srs))
        .filter(DeckORM.id == deck_id, DeckORM.owner_uid == owner_uid)
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


def _get_card_or_404(db: Session, deck_id: int, card_id: int, owner_uid: str) -> CardORM:
    _ = _get_deck_or_404(db, deck_id, owner_uid)
    card = (
        db.query(CardORM)
        .options(selectinload(CardORM.srs))
        .filter(CardORM.id == card_id, CardORM.deck_id == deck_id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.get("/", response_model=List[Deck])
async def list_decks(
    db: Session = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
) -> List[Deck]:
    user_id = user["id"]
    decks = (
        db.query(DeckORM)
        .options(selectinload(DeckORM.cards).selectinload(CardORM.srs))
        .filter(DeckORM.owner_uid == user_id)
        .order_by(DeckORM.id.desc())
        .all()
    )
    return decks


@router.post("/", response_model=Deck, status_code=201)
async def create_deck(
    payload: DeckCreate,
    db: Session = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Deck:
    user_id = user["id"]
    email = user.get("email") or ""
    full_name = user.get("user_metadata", {}).get("full_name") if isinstance(user.get("user_metadata"), dict) else None

    if not email:
        raise HTTPException(status_code=400, detail="Supabase user has no email")

    public_user = _ensure_public_user(db, email=email, full_name=full_name)

    deck = DeckORM(
        title=payload.title,
        description=payload.description,
        owner_id=public_user.id,   # ✅ مهم لتوافق DB constraint
        owner_uid=user_id,         # ✅ UUID من Supabase
    )

    db.add(deck)
    db.commit()
    db.refresh(deck)
    return deck


@router.get("/{deck_id}", response_model=Deck)
async def get_deck(
    deck_id: int,
    db: Session = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Deck:
    return _get_deck_or_404(db, deck_id, user["id"])


@router.delete("/{deck_id}", status_code=204)
async def delete_deck(
    deck_id: int,
    db: Session = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
) -> None:
    deck = _get_deck_or_404(db, deck_id, user["id"])
    db.delete(deck)
    db.commit()
    return None


@router.get("/{deck_id}/cards", response_model=List[Card])
async def list_cards(
    deck_id: int,
    db: Session = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
) -> List[Card]:
    deck = _get_deck_or_404(db, deck_id, user["id"])
    cards = (
        db.query(CardORM)
        .options(selectinload(CardORM.srs))
        .filter(CardORM.deck_id == deck.id)
        .order_by(CardORM.id.asc())
        .all()
    )
    return cards


@router.post("/{deck_id}/cards", response_model=Card, status_code=201)
async def create_card(
    deck_id: int,
    payload: CardCreate,
    db: Session = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Card:
    deck = _get_deck_or_404(db, deck_id, user["id"])
    card = CardORM(deck_id=deck.id, question=payload.question, answer=payload.answer)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.put("/{deck_id}/cards/{card_id}", response_model=Card)
async def update_card(
    deck_id: int,
    card_id: int,
    payload: CardCreate,
    db: Session = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Card:
    card = _get_card_or_404(db, deck_id, card_id, user["id"])
    card.question = payload.question
    card.answer = payload.answer
    db.commit()
    db.refresh(card)
    return card


@router.delete("/{deck_id}/cards/{card_id}", status_code=204)
async def delete_card(
    deck_id: int,
    card_id: int,
    db: Session = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
) -> None:
    card = _get_card_or_404(db, deck_id, card_id, user["id"])
    db.delete(card)
    db.commit()
    return None
