

📘 Проект: Auto-Flashcards

Роль: MLOps / DevOps Engineer

🎯 Цель

Создать единую среду разработки и мониторинга для всех сервисов системы
(Frontend, Backend, Database, LLM и аналитика)
с использованием Docker и GitHub Actions.

Данная конфигурация позволяет каждому члену команды запускать весь проект локально одной командой.

⚙️ Обзор архитектуры

| Компонент       | Технология                             | Назначение                                                |
| --------------- | -------------------------------------- | --------------------------------------------------------- |
| **Frontend**    | Next.js                                | Пользовательский интерфейс для студентов и преподавателей |
| **Backend**     | FastAPI (Python) / Node.js             | API для загрузки файлов, генерации карточек и повторений  |
| **Database**    | PostgreSQL                             | Хранение пользователей, карточек и статистики повторений  |
| **LLM Service** | llama.cpp / OpenAI                     | Генерация карточек (вопрос – ответ)                       |
| **Monitoring**  | Prometheus + Grafana + Langfuse + Loki | Сбор метрик, трассировка и логирование                    |
| **CI/CD**       | GitHub Actions                         | Автоматическая сборка, линтинг и тестирование             |


🧩 Docker-композиция
▶️ Среда разработки

Файл: docker-compose.dev.yml

Запускает:

frontend → http://localhost:3000

backend → http://localhost:8000

db (PostgreSQL) → порт 5432

llm → http://localhost:5000

jupyter → http://localhost:8888

Общая сеть: auto-flashcards-net

Запуск

docker compose -f docker-compose.dev.yml up -d

Остановка


docker compose -f docker-compose.dev.yml down


📈 Мониторинг

Файл: monitoring/docker-compose.yml

Содержит:

Langfuse (трассировка LLM) → http://localhost:3101

Prometheus (метрики) → http://localhost:9090

Grafana (дашборды) → http://localhost:3002

Loki + Promtail (агрегация логов)

Запуск:

docker compose -f monitoring/docker-compose.yml up -d


Просмотр дашбордов в Grafana с использованием импортированных JSON-панелей
(например, llm-performance.json).


🧰 Переменные окружения

Файл: .env.example

Пример значений:

POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123
POSTGRES_DB=auto_flashcards
JWT_SECRET=supersecretkey
OPENAI_API_KEY=your_openai_key_here


Создать реальный файл окружения:

cp .env.example .env



🔁 CI/CD Интеграция

Файл: .github/workflows/dev-ci.yml

Pipeline выполняет:

Линтинг и тесты для backend и frontend.

Сборку Docker-образов и отправку в GHCR.

Симуляцию деплоя для ветки разработки.

Комментарий в Pull Request с результатами сборки.

Срабатывает при:
push или pull_request в ветках lab2-design-sprint и lab2-mlops-deliverables.


📊 Мониторинг метрик

Prometheus собирает:

backend_response_time_seconds

llm_requests_total

llm_requests_failed_total

llm_latency_ms_avg

Grafana визуализирует:

Время отклика сервиса

Задержку и стоимость LLM

Количество ошибок

Поток токенов

Langfuse хранит подробные трассировки каждого вызова LLM API.



🧠 Jupyter Lab

Используется для экспериментов с LLM-моделями и анализа данных.

Открыть:

http://localhost:8888


Токен по умолчанию: dev123

🧾 Как пересобрать проект

Если изменились конфигурации:

docker compose -f docker-compose.dev.yml up --build
docker compose -f monitoring/docker-compose.yml up --build

✅ Проверочный чек-лист (для отчёта по Лабе 2)
Требование	Статус
Docker Compose среда разработки	✅ Выполнено
Мониторинг через Prometheus и Grafana	✅ Выполнено
Трассировка LLM через Langfuse	✅ Выполнено
Логирование (Loki + Promtail)	✅ Выполнено
Интеграция Jupyter Lab	✅ Выполнено
Файл .env и документация	✅ Выполнено
CI/CD Pipeline	✅ Выполнено
🏁 Результат

Система Auto-Flashcards теперь имеет полностью контейнеризированную и мониторимую инфраструктуру, готовую к интеграции с другими ролями (Fullstack, AI, SA/PO).
Один запуск команды docker compose up -d поднимает весь проект локально, включая трассировку LLM и дашборды производительности.


