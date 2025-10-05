# Database Design — AUTO-FLASHCARDS

Based on: `requirements.md`, `D1 (PRD)`, `c4-diagrams.md`

## ER Diagram (Mermaid)

```mermaid
erDiagram
    users ||--o{ decks : "owns"
    users ||--o{ reviews : "rates"
    users ||--o{ files : "uploads"
    users ||--o{ runs : "triggers"
    decks ||--o{ cards : "contains"
    cards ||--o{ reviews : "scheduled"