Auto-Flashcards — Дорожная карта (Roadmap)

1. Цель спринта

Спринт 2 (AI Architecture Design Sprint, 14 дней): превратить результаты Лабы 1 (UC-1…UC-5) в технический фундамент — архитектура, контракты, данные и dev-инфраструктура.
Роли: SA/PO, Fullstack, MLOps, AI Engineer.
Итог: все артефакты готовы к началу реализации (Спринт 3).

2. Приоритеты и объём MVP

Включено:

UC-1 Создание колоды из материала (импорт → OCR/LLM → предпросмотр → сохранение).

UC-3 Ежедневная SRS-сессия (выбор «к сроку», оценка, пересчёт интервалов).

UC-2 Базовое редактирование карточек (вопрос/ответ/сложность, merge дублей).

UC-4 Базовая статистика (агрегаты, периоды: день/неделя/месяц).

UC-5 Профиль и настройки (язык/тема/уровень) + Auth/IdP.

Вне MVP (перенос дальше): продвинутые рекомендации, сложные стратегии merge с историей версий, тонкая оптимизация стоимости LLM.

3. Эпики и зависимости
   | Эпик | Содержание | Зависимости |
   | ------------------------------ | ------------------------------------------------ | ----------------------- |
   | **E1 Импорт/генерация (UC-1)** | Загрузка → OCR → LLM → предпросмотр → сохранение | БД, LLM Gateway, OCR |
   | **E2 Редактирование (UC-2)** | Правки карточек, merge дублей, валидации | E1 (есть данные) |
   | **E3 SRS-сессия (UC-3)** | Due-выборка, оценка, пересчёт интервалов | E1 (данные), индексы БД |
   | **E4 Статистика (UC-4)** | Агрегаты, периоды, «нет данных» | E3 события/результаты |
   | **E5 Профиль (UC-5)** | Профиль/настройки, Auth/IdP | БД, Auth |
   | **E6 Инфраструктура** | docker-compose.dev, CI, мониторинг | Базовые сервисы/репо |

Ключевая цепочка: E1 → E3 → E4; E2 идёт параллельно после появления данных.

4. Календарный план (14 дней)
   Неделя 1 — Планирование и проектирование

День 1–2 (Стратегия):

SA/PO: docs/requirements.md, черновик C4 (Context/Container).

Fullstack: старт database/schema.sql.

MLOps: выбор инструментов, набросок docker-compose.dev.yml.

AI Eng.: выбор LLM/embeddings, черновик требований.

День 3–4 (Проектирование):

SA/PO: финализация C4; связка UC↔эндпоинты; черновик OpenAPI.

Fullstack: wireframes + user-flows, корректировка схемы БД.

MLOps: docker-compose.dev (db/api/frontend/plantuml), инструкции запуска.

AI Eng.: промпты/данные, план evaluation.

День 5–7 (Детализация):

SA/PO: docs/roadmap.md (этот файл) + docs/definitions.md (DoR/DoD/KPI).

Fullstack: OpenAPI (E1/E3), индексы (deckId, nextReviewAt).

MLOps: CI (линт OpenAPI, генерация диаграмм), базовый мониторинг.

AI Eng.: baseline модель + API-интерфейсы.

Неделя 2 — Интеграция и полировка

День 8–10 (Интеграция):
Склейка артефактов → прогон сценария: UC-1 → UC-2 → UC-3 → UC-4 → UC-5; обновление C4/OpenAPI.

День 11–12 (Полировка):

MLOps: метрики latency/error/cost, трассировка.

AI Eng.: mini-evaluation + отчёт.

SA/PO: финальный архитектурный ревью (AC/NFR/ADR).

Fullstack: UX-состояния (loading/error/empty/success).

День 13–14 (Сдача):
PR по ролям, peer-review, финальная документация. Готовность к Спринту 3.

5. Поставки и владельцы

SA/PO:
docs/requirements.md, docs/architecture/c4-diagrams.md, docs/roadmap.md, docs/definitions.md, docs/adr/\*

Fullstack:
database/schema.sql, design/wireframes.figma, design/user-flows.miro, api/openapi.yaml

MLOps:
docker-compose.dev.yml, .github/workflows/_, monitoring/_, docs/infrastructure.md

AI Engineer:
ml/requirements.md, data/, ml/prompt_templates.py, ml/models/baseline.py, reports/baseline_report.md

6. Контракты и контрольные точки

Milestones:

M1 (День 2): requirements + C4 (Context/Container) черновики.

M2 (День 4): wireframes + docker-compose.dev каркас.

M3 (День 7): OpenAPI (E1/E3) + CI первый прогон.

M4 (День 10): интеграционный happy-path.

M5 (День 12): мониторинг/отчёт baseline, финальный архитектурный ревью.

M6 (День 14): PR смержены, документация готова.

Минимальные контракты:

OpenAPI покрывает UC-1..UC-5 (примеры запрос/ответ/ошибок).

БД: таблицы/ключи/индексы; целостность.

Dev-окружение: docker-compose.dev стартует без ошибок.

7. Риски и митигация
   | Риск | Влияние | Митигация |
   | --------------------------- | --------------------- | ---------------------------------------------------------- |
   | Недоступность LLM/OCR | Блок UC-1 | Очереди/ретраи/таймауты, резервный провайдер, анонимизация |
   | Высокая стоимость LLM | Перерасход | Rate limiting, батчинг, кэш промежуточных результатов |
   | Потеря прогресса SRS | UX-срыв | Автосохранение, идемпотентность, чекпоинты |
   | Тяжёлые агрегаты статистики | Медленные экраны UC-4 | Индексы, pre-aggregation, кэши |
   | Конкурентные правки | Конфликты/потери | Версионирование/merge-стратегии, подсказки в UI |

8. Стратегия PR/ветвления

Общая ветка спринта: lab2-design-sprint.

Персональные PR: lab2-sa-deliverables, lab2-fullstack-deliverables, lab2-mlops-deliverables, lab2-ml-deliverables.

Требования к PR: цель, список артефактов, связанные эпики/UC, ссылки на ADR.

CI обязательно: линт OpenAPI, генерация диаграмм PlantUML.

9. Критерии готовности (Definition of Done — для Roadmap)

Все артефакты созданы и согласованы: requirements, C4, OpenAPI, schema.sql, docker-compose.dev, monitoring, baseline-report.

Dev-сборка без ошибок; интеграционный happy-path по UC-1→UC-2→UC-3→UC-4→UC-5 проходит.

NFR-цели достижимы: P95 ≤ 800 мс, UC-1 ≤ 60s, наблюдаемость ключевых метрик, сохранность прогресса.

Документация актуальна; риски/митигации отражены.

10. Диаграммы и ссылки

System Context: diagrams/context-plain.puml → diagrams/context-plain.png

Containers: diagrams/container-plain.puml → diagrams/container-plain.png

Дополнительно: diagrams/uc1-sequence.puml, diagrams/api-components.puml

Контракты: api/openapi.yaml — источник истины

БД: database/schema.sql

DoR/DoD/KPI: docs/definitions.md

Требования: docs/requirements.md

11. Следующие шаги (для SA/PO)

Зафиксировать C4 (PNG/SVG) и вставить в c4-diagrams.md.

Дополнить OpenAPI примерами ошибок/валидаций; синхронизировать с Fullstack.

Оформить ADR-001 (FastAPI/PostgreSQL/Queue) и ADR-002 (политика LLM/OCR).

Открыть PR lab2-sa-deliverables, запросить cross-review от всех ролей, применить правки и мёрж.
