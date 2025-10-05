# D4 — RACI Matrix
Проект: AUTO-FLASHCARDS  
Ответственный: SA/PO  

---

## RACI-таблица
R = Responsible (выполняет)  
A = Accountable (отвечает)  
C = Consulted (консультируется)  
I = Informed (информируется)  

| Область ответственности                | SA/PO   | AI Engineer | MLOps  | Fullstack |
|----------------------------------------|---------|-------------|--------|-----------|
| System Architecture & ADR              | A/R     | C           | C      | C         |
| Documentation & Presentation           | A/R     | C           | C      | C         |
| UI/UX Design & Interface               | R/C     | I           | I      | A/R       |
| Backend API Development (FastAPI)      | R       | C           | C      | A/R       |
| Testing & QA                           | R       | C           | C      | A/R       |
| Docker & Containerization              | R       | C           | A/R    | C         |
| CI/CD Pipelines (GitHub Actions)       | R       | C           | A/R    | C         |
| Monitoring & Observability (Langfuse)  | R       | C           | A/R    | C         |
| Model Selection & Setup (LLM/NLP)      | C       | A/R         | I      | I         |
| Prompt Engineering & RAG               | C       | A/R         | I      | C         |
| SRS (SM-2) Engine                      | C       | A/R         | I      | C         |
| Ingestion Pipeline (PDF/Text/OCR)      | R       | C           | C      | A/R       |

---

## Decision Making
- За каждую область отвечает владелец **A**.  
- При пересечении областей финальное решение принимает **SA/PO**.  
- Изменение объёма проекта требует подтверждения **SA/PO** и уведомления всей команды.  

---

## Escalation Path
1. Обсуждение внутри команды.  
2. Решение **SA/PO**, зафиксированное в PR/Issue.  
3. Эскалация к ментору (Telegram) для подтверждения.  

---

## Подписи участников
- SA/PO: @ALBADWIMAJID — Согласен  
- AI Engineer: @laithtahan812 — Согласен  
- MLOps: @zain1010241-netizen — Согласен  
- Fullstack: @nardeen0 — Согласен  
