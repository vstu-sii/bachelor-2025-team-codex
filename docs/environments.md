@'
# Environments (Dev / Staging / Prod) — SA/PO Notes

## Принцип
Конфигурация должна храниться во внешних переменных окружения (env vars), чтобы отличаться между Dev/Staging/Prod без изменения кода.

## Dev
- Локальный запуск через Docker Compose
- .env локально + .env.example без секретов
- Логи: просмотр через docker logs

Рекомендуемые env vars (пример):
- BACKEND_URL
- FRONTEND_URL
- SUPABASE_URL
- SUPABASE_ANON_KEY
- OPENAI_API_KEY (секрет)
- LANGFUSE_PUBLIC_KEY (если используется)
- LANGFUSE_SECRET_KEY (секрет)

## Staging
- Отдельные ключи/база данных/проект Supabase (не production)
- Цель: проверить релиз перед demo/production
- Secrets хранятся в GitHub Actions Secrets (repo/environment)

## Prod
- Только production secrets (никогда не коммитить в репозиторий)
- Ротация секретов: при утечке ключа — перевыпуск + обновление secrets
- Backup / Recovery:
  - Если Supabase: включить регулярные бэкапы/опционально PITR (Point-in-Time Recovery)
  - Документировать кто и как делает восстановление

## Secrets management
- GitHub Actions secrets: хранить OPENAI_API_KEY, SUPABASE keys и т.д. в secrets
- Никогда не хранить реальные ключи в README / docs / .env.example
'@ | Set-Content -Encoding UTF8 docs/environments.md
