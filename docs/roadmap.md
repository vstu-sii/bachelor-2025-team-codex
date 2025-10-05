# Auto-Flashcards — Roadmap (Lab 2)

## 1. Эпики проекта (Epics)

- **E1. Flashcard Generation** — загрузка PDF → OCR → генерация карточек через LLM.
- **E2. Review Engine (SM-2)** — список «Review Today», алгоритм SM-2, рейтинг 0–5.
- **E3. UI/UX** — веб-интерфейс (Next.js), wireframes, сценарии пользователей.
- **E4. Infrastructure (Dev Environment)** — docker-compose, CI/CD pipelines.
- **E5. Monitoring & Logging** — Langfuse, Prometheus, Grafana, health-checks.
- **E6. Baseline AI Model** — выбор LLM, шаблоны промптов, baseline+evaluation.

## 2. План на 14 дней (Sprint Timeline)

### Неделя 1 — Архитектурное планирование

**День 1–2**

- SA/PO: финализирует `docs/requirements.md`.
- Fullstack: черновик схемы БД (таблицы, связи).
- MLOps: исследование инструментов (Docker, Actions, Grafana).
- AI Engineer: анализ LLM/эмбеддингов, набор тестовых данных.

**День 3–4**

- SA/PO: `docs/architecture/c4-diagrams.md` (контекст + контейнеры).
- Fullstack: wireframes ключевых экранов + user flows.
- MLOps: черновик `docker-compose.dev.yml`.
- AI Engineer: подготовка `data/` и `ml/prompt_templates.py`.

**День 5–7**

- SA/PO: `docs/roadmap.md` + `docs/definitions.md` (DoR/DoD, KPI).
- Fullstack: `api/openapi.yaml` (контракты).
- MLOps: базовый CI (линт/тест), прогон PR.
- AI Engineer: `ml/models/baseline.py` (черновой baseline).

### Неделя 2 — Детализация и интеграция

**День 8–10**

- Интеграция артефактов по ролям.
- Cross-review между SA/PO ↔ Fullstack ↔ MLOps ↔ AI.
- Тестирование интеграций (минимальный Happy Path).
- Обновление документации.

**День 11–12**

- MLOps: мониторинг (дешборды), финальные проверки health-checks.
- AI Engineer: evaluation baseline (отчёт по качеству).
- SA/PO: архитектурное ревью и фиксация рисков.
- Fullstack: валидирует UI/UX (состояния: загрузка/ошибка/успех).

**День 13–14**

- Создание Pull Request’ов из `lab2-[role]-deliverables` → `lab2-design-sprint`.
- Peer-review, исправления.
- Финальная документация (readme/cheatsheet).
- Готовность к следующему спринту.

## 3. Зависимости (Dependencies)

- Спецификация API зависит от схемы БД.
- `docker-compose.dev.yml` следует контейнерной диаграмме (C4).
- Baseline LLM зависит от эндпоинта `/cards/{deck_id}/generate`.

## 4. Приоритеты (MVP Scope)

**Включено в MVP:**

- PDF ≤ 50MB (EN/RU), OCR, генерация 15–30 карточек.
- SM-2 (оценка 0–5), «Review Today».
- Панель прогресса (обзор статистики).

**Может быть перенесено (Nice-to-have):**

- Расширенный шаринг колод.
- Продвинутые дешборды мониторинга.

## 5. Риски и митигация (Risks & Mitigation)

- **Низкое качество OCR** → предупреждение + возможность ручного редактирования.
- **Высокая задержка LLM** → лимит карточек (≤30), кэширование результатов.
- **Рост стоимости LLM** → лимиты в Langfuse, целевой бюджет ≤ 0.05$/user/day.
- **Интеграционные ошибки** → cross-review + CI проверки в PR.
- **UX-риски** → быстрые тесты прототипа на целевых студентах.
