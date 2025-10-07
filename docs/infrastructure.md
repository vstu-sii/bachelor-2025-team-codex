# Infrastructure Documentation

> **Author:** MLOps / DevOps Engineer  
> **Project:** bachelor-2025-team-codex  
> **Goal:** Unified development environment + CI/CD + Monitoring Stack

---

## 1. Development Environment Setup

### Components

| Service     | Tech                                 | Port             | Description               |
| ----------- | ------------------------------------ | ---------------- | ------------------------- | --------- |
| Frontend    | Next.js                              | 3000             | User interface            |
| Backend     | Backend                              | FastAPI (Python) | 8000                      | API layer |
| Database    | PostgreSQL                           | 5432             | Data storage              |
| LLM Service | Llama.cpp / abetlen-llama-cpp-python | 5000             | Model inference           |
| Jupyter Lab | base-notebook                        | 8888             | Experiments and notebooks |

### Run Environment

From the project root:

```bash
docker compose -f docker-compose.dev.yml up --build
```
