@'
# Requirements v3 (Post-Testing) — SA/PO

## Why changes
После Lab5 тестов были выявлены проблемы/риски, требующие корректировки требований и DoD.

## Changes Log
| Req ID | Old | New | Reason (evidence) | Priority |
|---|---|---|---|---|
| R-1 | TBD | TBD | Testing report issue #TBD | P0/P1 |

## Updated Definition of Done (DoD)
- CI: build + tests pass
- E2E: критические сценарии проходят (UC-1, UC-3)
- Performance: ключевые операции в пределах целевых значений (p95 TBD)
- UX: Task Success >= TBD%, ошибки понятны пользователю

## North Star Metric (NSM)
- Previous NSM: TBD
- Updated NSM: TBD
- Rationale: NSM должен отражать ценность для пользователя и быть измеримым.
'@ | Set-Content -Encoding UTF8 docs/requirements-v3.md
