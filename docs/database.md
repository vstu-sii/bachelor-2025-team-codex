# Database — Auto-Flashcards (PostgreSQL)

This document explains the MVP schema aligned with UC-1..UC-5 and the OpenAPI contracts.

## Entities

### users

| column        | type        | notes                             |
| ------------- | ----------- | --------------------------------- |
| id (PK)       | uuid        | generated via `gen_random_uuid()` |
| email         | text uniq   | login                             |
| password_hash | text        | hashed                            |
| display_name  | text        | profile                           |
| language      | text        | en, ru, ar, de, fr                |
| theme         | text        | light/dark                        |
| level         | text        | beginner/intermediate/advanced    |
| created_at    | timestamptz |                                   |
| updated_at    | timestamptz | auto trigger                      |

### decks

Belongs to a user. Turns `is_final=true` on `/decks/{id}/finalize`.

| column     | type        | notes                     |
| ---------- | ----------- | ------------------------- |
| id (PK)    | uuid        |                           |
| user_id FK | uuid→users  | ON DELETE CASCADE         |
| title      | text        |                           |
| is_final   | boolean     | false→true after finalize |
| created_at | timestamptz |                           |
| updated_at | timestamptz | trigger                   |

Index: `idx_decks_user (user_id)`.

### cards

Cards belong to a deck.

| column     | type        | notes             |
| ---------- | ----------- | ----------------- |
| id (PK)    | uuid        |                   |
| deck_id FK | uuid→decks  | ON DELETE CASCADE |
| question   | text        |                   |
| answer     | text        |                   |
| difficulty | int         | 1..5, default 3   |
| created_at | timestamptz |                   |
| updated_at | timestamptz | trigger           |

Index: `idx_cards_deck (deck_id)`.

### reviews (SRS state per user-card)

One row per `(user_id, card_id)` with current scheduling state.

| column        | type         | notes                       |
| ------------- | ------------ | --------------------------- |
| id (PK)       | uuid         |                             |
| card_id FK    | uuid→cards   | ON DELETE CASCADE           |
| user_id FK    | uuid→users   | ON DELETE CASCADE           |
| due_at        | timestamptz  | next due time               |
| interval_days | int          | current interval            |
| ease_factor   | numeric(4,2) | SM-2 EF (default 2.50)      |
| repetitions   | int          | count of successful reviews |
| last_grade    | text         | again/hard/good/easy        |
| created_at    | timestamptz  |                             |
| updated_at    | timestamptz  | trigger                     |

Indexes:

- `idx_reviews_due (user_id, due_at)`
- `idx_reviews_card (card_id)`  
  Unique: `(card_id, user_id)`.

### stats_daily (aggregates)

Optional precomputed stats for `/stats`.

| column       | type       | notes                       |
| ------------ | ---------- | --------------------------- |
| id (PK)      | uuid       |                             |
| user_id FK   | uuid→users | ON DELETE CASCADE           |
| deck_id FK   | uuid→decks | nullable; ON DELETE CASCADE |
| day          | date       |                             |
| reviewed_cnt | int        |                             |
| new_cnt      | int        |                             |
| correct_cnt  | int        |                             |

Unique: `(user_id, deck_id, day)`.  
Index: `idx_stats_user_day (user_id, day)`.

### files (optional)

If UC-1 uses file upload (S3/local) to generate `fileRef`.

| column      | type        | notes                   |
| ----------- | ----------- | ----------------------- |
| id (PK)     | uuid        |                         |
| user_id FK  | uuid→users  | ON DELETE CASCADE       |
| storage_key | text        | S3 key or local path    |
| mime_type   | text        |                         |
| size_bytes  | bigint      |                         |
| status      | text        | stored/processed/failed |
| created_at  | timestamptz |                         |

### jobs (background)

Queue for OCR/LLM/aggregations.

| column      | type        | notes                         |
| ----------- | ----------- | ----------------------------- |
| id (PK)     | uuid        |                               |
| user_id FK  | uuid→users  | ON DELETE SET NULL            |
| deck_id FK  | uuid→decks  | ON DELETE SET NULL            |
| job_type    | text        | ocr/llm_generate/aggregate…   |
| status      | text        | queued/running/done/failed    |
| payload     | jsonb       | params                        |
| result      | jsonb       | outputs (e.g., preview cards) |
| error       | text        | error message if any          |
| created_at  | timestamptz |                               |
| started_at  | timestamptz |                               |
| finished_at | timestamptz |                               |

Indexes: `idx_jobs_status`, `idx_jobs_deck`.

---

## Relationships (ER quick)

- `users 1—N decks`
- `decks 1—N cards`
- `users N—N cards` via `reviews` (per-user SRS state)
- `users 1—N files`, `users 1—N jobs`
- `decks 1—N jobs`, `users 1—N stats_daily`, `decks 1—N stats_daily (optional)`

---

## API ↔ DB mapping (key endpoints)

- `POST /decks` → insert into `decks` (is_final=false) and `cards` (preview or staged), may enqueue `jobs`.
- `GET /decks/{id}/cards` → select from `cards` where `deck_id = :id`.
- `POST /decks/{id}/finalize` → set `decks.is_final = true`.
- `PATCH /cards/{id}` → update `cards`.
- `POST /cards/merge` → pick survivor card, move references, delete duplicates.
- `POST /srs/session/start` → select from `reviews` where `user_id=:uid AND due_at <= now()`.
- `POST /srs/grade` → update `reviews` (interval/ease/repetitions/due_at).
- `GET /stats` → read from `stats_daily` (precomputed) or compute on the fly.

---

## Sample queries

```sql
-- UC-3 session: due cards
SELECT c.*
FROM reviews r
JOIN cards c ON c.id = r.card_id
WHERE r.user_id = $1
  AND r.due_at <= now()
ORDER BY r.due_at
LIMIT 30;

-- After grading (example: good)
UPDATE reviews
SET
  repetitions   = repetitions + 1,
  ease_factor   = GREATEST(1.30, ease_factor + 0.10),
  interval_days = CASE WHEN repetitions = 0 THEN 1
                       WHEN repetitions = 1 THEN 3
                       ELSE LEAST(60, (interval_days * ease_factor)::int) END,
  due_at        = now() + make_interval(days => interval_days),
  last_grade    = 'good',
  updated_at    = now()
WHERE card_id = $1 AND user_id = $2;

-- Stats (week, per deck)
SELECT deck_id,
       date_trunc('day', r.updated_at)::date AS day,
       count(*) FILTER (WHERE last_grade IN ('good','easy')) AS correct_cnt,
       count(*) AS reviewed_cnt
FROM reviews r
JOIN cards c ON c.id = r.card_id
WHERE r.user_id = $1
  AND r.updated_at >= now() - interval '7 days'
GROUP BY deck_id, day
ORDER BY day DESC;
```
