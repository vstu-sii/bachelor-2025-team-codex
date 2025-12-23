# backend/db.py
from __future__ import annotations

import os
from datetime import date, datetime
from typing import Generator, Optional

from dotenv import load_dotenv
from sqlalchemy import (
    create_engine,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import (
    declarative_base,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)

# Postgres UUID type (Supabase Postgres)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

load_dotenv()

SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
if not SUPABASE_DB_URL:
    raise RuntimeError("SUPABASE_DB_URL is not set. Check your .env file and environment.")

engine = create_engine(SUPABASE_DB_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ---------- ORM Models ----------

class User(Base):
    """
    public.users (كما في سكيمتك)
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    decks: Mapped[list["Deck"]] = relationship("Deck", back_populates="owner")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"


class Deck(Base):
    """
    public.decks
    """
    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ✅ موجود في DB: owner_id integer NOT NULL -> public.users(id)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)

    # ✅ موجود في DB: owner_uid uuid -> auth.users(id)
    # مهم: لا نضع ForeignKey("auth.users.id") حتى لا نحتاج تعريف جدول auth.users في SQLAlchemy.
    owner_uid: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), index=True, nullable=True)

    owner: Mapped["User"] = relationship("User", back_populates="decks")

    cards: Mapped[list["Card"]] = relationship(
        "Card",
        back_populates="deck",
        cascade="all, delete-orphan",
    )

    review_sessions: Mapped[list["ReviewSession"]] = relationship(
        "ReviewSession",
        back_populates="deck",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Deck id={self.id} title={self.title!r} owner_id={self.owner_id} owner_uid={self.owner_uid!r}>"


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    deck_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("decks.id"),
        index=True,
        nullable=False,
    )

    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)

    deck: Mapped["Deck"] = relationship("Deck", back_populates="cards")

    srs: Mapped[Optional["CardSRS"]] = relationship(
        "CardSRS",
        back_populates="card",
        uselist=False,
        cascade="all, delete-orphan",
    )

    review_answers: Mapped[list["ReviewAnswer"]] = relationship(
        "ReviewAnswer",
        back_populates="card",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Card id={self.id} deck_id={self.deck_id}>"


class CardSRS(Base):
    __tablename__ = "card_srs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    card_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("cards.id"),
        unique=True,
        index=True,
        nullable=False,
    )

    interval: Mapped[int] = mapped_column(Integer, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    next_review: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_grade: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    card: Mapped["Card"] = relationship("Card", back_populates="srs")

    def __repr__(self) -> str:
        return f"<CardSRS card_id={self.card_id} interval={self.interval} reps={self.repetitions} ef={self.ease_factor}>"


class ReviewSession(Base):
    __tablename__ = "review_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    deck_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("decks.id"),
        index=True,
        nullable=False,
    )

    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    deck: Mapped["Deck"] = relationship("Deck", back_populates="review_sessions")

    answers: Mapped[list["ReviewAnswer"]] = relationship(
        "ReviewAnswer",
        back_populates="session",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ReviewSession id={self.id} deck_id={self.deck_id}>"


class ReviewAnswer(Base):
    __tablename__ = "review_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    session_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("review_sessions.id"),
        index=True,
        nullable=False,
    )

    card_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("cards.id"),
        index=True,
        nullable=False,
    )

    rating: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    session: Mapped["ReviewSession"] = relationship("ReviewSession", back_populates="answers")
    card: Mapped["Card"] = relationship("Card", back_populates="review_answers")

    def __repr__(self) -> str:
        return f"<ReviewAnswer id={self.id} session_id={self.session_id} card_id={self.card_id}>"


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
