-- Auto-Flashcards — PostgreSQL Schema (MVP, hardened)
-- Requires: PostgreSQL 13+.
-- Extensions used: pgcrypto (UUID), citext (case-insensitive email)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
-- =================== Users ===================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    language TEXT DEFAULT 'en',
    -- en, ru, ar, de, fr
    theme TEXT DEFAULT 'light',
    -- light, dark
    level TEXT DEFAULT 'beginner',
    -- beginner, intermediate, advanced
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_not_empty CHECK (length(trim(email::text)) > 0)
);
-- =================== Decks ===================
CREATE TABLE IF NOT EXISTS decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE after finalize
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT decks_title_not_empty CHECK (length(trim(title)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);
-- =================== Cards ===================
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    difficulty INT NOT NULL DEFAULT 3 CHECK (
        difficulty BETWEEN 1 AND 5
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cards_question_not_empty CHECK (length(trim(question)) > 0),
    CONSTRAINT cards_answer_not_empty CHECK (length(trim(answer)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_deck_created ON cards(deck_id, created_at DESC);
-- =================== Reviews (SRS schedule) ===================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    interval_days INT NOT NULL DEFAULT 0,
    ease_factor NUMERIC(4, 2) NOT NULL DEFAULT 2.50,
    -- SM-2 EF
    repetitions INT NOT NULL DEFAULT 0,
    last_grade TEXT,
    -- again|hard|good|easy
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (card_id, user_id) -- single schedule per user-card
);
CREATE INDEX IF NOT EXISTS idx_reviews_due ON reviews(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_reviews_card ON reviews(card_id);
-- =================== Stats (daily aggregates) ===================
CREATE TABLE IF NOT EXISTS stats_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    reviewed_cnt INT NOT NULL DEFAULT 0,
    new_cnt INT NOT NULL DEFAULT 0,
    correct_cnt INT NOT NULL DEFAULT 0,
    UNIQUE (user_id, deck_id, day)
);
CREATE INDEX IF NOT EXISTS idx_stats_user_day ON stats_daily(user_id, day);
-- =================== Files (optional UC-1 source) ===================
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    -- e.g. S3 key or local path
    mime_type TEXT,
    size_bytes BIGINT,
    status TEXT NOT NULL DEFAULT 'stored',
    -- stored|processed|failed
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT files_status_check CHECK (status IN ('stored', 'processed', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_user_created ON files(user_id, created_at DESC);
-- =================== Background Jobs (LLM/OCR/Aggregations) ===================
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE
    SET NULL,
        deck_id UUID REFERENCES decks(id) ON DELETE
    SET NULL,
        job_type TEXT NOT NULL,
        -- ocr|llm_generate|aggregate|other
        status TEXT NOT NULL DEFAULT 'queued',
        -- queued|running|done|failed
        payload JSONB,
        -- input params
        result JSONB,
        -- result payload (e.g., preview cards)
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        CONSTRAINT jobs_status_check CHECK (
            status IN ('queued', 'running', 'done', 'failed')
        ),
        CONSTRAINT jobs_type_check CHECK (
            job_type IN ('ocr', 'llm_generate', 'aggregate', 'other')
        )
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_deck ON jobs(deck_id);
CREATE INDEX IF NOT EXISTS idx_jobs_deck_status ON jobs(deck_id, status);
-- =================== Triggers (auto updated_at) ===================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Attach to tables that have updated_at
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_users_updated_at'
) THEN CREATE TRIGGER trg_users_updated_at BEFORE
UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_decks_updated_at'
) THEN CREATE TRIGGER trg_decks_updated_at BEFORE
UPDATE ON decks FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cards_updated_at'
) THEN CREATE TRIGGER trg_cards_updated_at BEFORE
UPDATE ON cards FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_reviews_updated_at'
) THEN CREATE TRIGGER trg_reviews_updated_at BEFORE
UPDATE ON reviews FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_jobs_updated_at'
) THEN CREATE TRIGGER trg_jobs_updated_at BEFORE
UPDATE ON jobs FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
END IF;
END $$;
-- =================== Comments (docs) ===================
COMMENT ON TABLE reviews IS 'SRS schedule per user-card (SM-2-like).';
COMMENT ON COLUMN reviews.ease_factor IS 'SM-2 Ease Factor (default 2.50).';
COMMENT ON COLUMN jobs.payload IS 'JSON parameters for worker.';
COMMENT ON COLUMN jobs.result IS 'JSON result payload (e.g., preview cards).';
-- =================== (Optional) Row Level Security ===================
-- Enable RLS if you need strict per-user isolation from the DB side.
-- You must set `SET app.user_id = '<uuid>';` in the application session.
-- Uncomment to enable:
-- ALTER TABLE decks       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cards       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reviews     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE files       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stats_daily ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jobs        ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY decks_own_rw ON decks
--   USING (user_id = current_setting('app.user_id', true)::uuid)
--   WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);
-- Repeat similar policies for other tables owning user_id.