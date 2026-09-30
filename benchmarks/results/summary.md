# explain() results — 100,000 messages, 50 rooms, 20,000 users

Generated 2026-09-30 21:52. Raw explain output is in the JSON files next to this one.

| Query | Index | Plan stages | Returned | Keys examined | Docs examined | explain ms | avg query ms |
|---|---|---|---|---|---|---|---|
| room_history | no index | SORT → COLLSCAN | 50 | 0 | 100,000 | 535 | 191.69 |
| room_history | with index | LIMIT → FETCH → IXSCAN | 50 | 50 | 50 | 47 | 2.78 |
| login_email | no index | COLLSCAN | 1 | 0 | 20,000 | 38 | 50.71 |
| login_email | with index | EXPRESS_IXSCAN | 1 | 1 | 1 | 35 | 1.35 |
| text_search | no index | COLLSCAN | 473 | 0 | 100,000 | 201 | — |
| text_search | with index | FETCH → TEXT_MATCH → FETCH → IXSCAN | 473 | 22,907 | 45,814 | 227 | — |

text_search 'no index' uses a case-insensitive $regex (the only option without a text index).