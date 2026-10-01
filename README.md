# Whisper — Anonymous Web Chat (NoSQL OEE, BISNS701)

A free real-time chat app. Anyone can join public rooms as a **guest** (random alias, messages auto-expire), or **register** to upload pictures and keep their messages. Built to demonstrate MongoDB: `$jsonSchema` validation, unique / compound / TTL / text indexes, `explain()`, aggregation pipelines and GridFS.

| | Guest | Registered member |
|---|---|---|
| Sign-up | None — server gives a random alias + temporary JWT | Email + password (bcrypt) |
| Chat in public rooms | Yes | Yes |
| Upload pictures | No (view only) | Yes (GridFS) |
| Message retention | Auto-deleted after 24 h (TTL index) | Kept |

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI["React + Vite<br/>Tailwind · Framer Motion · Recharts"]
    end
    subgraph Backend["FastAPI (Python)"]
        REST["REST routes<br/>/guest /register /login<br/>/rooms /upload /image /stats"]
        WS["WebSocket /ws/{room_id}<br/>ConnectionManager"]
        AUTH["auth.py<br/>bcrypt · JWT · role checks"]
        IMG["images.py<br/>Pillow validate + re-encode"]
        AGG["stats.py<br/>aggregation pipelines"]
    end
    subgraph MongoDB
        U[(users)]
        R[(rooms)]
        M[(messages<br/>TTL · compound · text)]
        G[(GridFS<br/>fs.files / fs.chunks)]
    end
    UI -- HTTP JSON --> REST
    UI <-- live messages --> WS
    REST --> AUTH --> U
    REST --> R
    WS --> M
    REST --> IMG --> G
    REST --> AGG --> M & G
```

## Project layout

```
app/
  main.py        FastAPI app and all routes (REST + WebSocket)
  db.py          Mongo connection, $jsonSchema validators, index creation
  auth.py        bcrypt, JWT, guest aliases, role checks
  messages.py    save_message / get_history (cursor pagination)
  ws.py          WebSocket connection manager (per-room broadcast)
  images.py      upload validation, EXIF stripping, GridFS helpers
  stats.py       aggregation pipelines for the dashboard
  ratelimit.py   rate-limit hook (no-op today, Redis later)
  config.py      settings from .env
  models.py      Pydantic request/response models
tests/           pytest suite (runs against the oee_chat_test database)
benchmarks/      explain() with/without index benchmark + saved results
frontend/        React app (src/components, src/pages, src/hooks)
REPORT_NOTES.md  design decisions and measured index results
```

## Setup

**Requirements:** Python 3.11+, Node 18+, MongoDB 7+ running on `localhost:27017` (or an Atlas URI).

### 1. Backend

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then set a real JWT_SECRET
uvicorn app.main:app --reload --port 8000
```

On start-up the app creates the collections with their validators and all indexes. API docs: <http://localhost:8000/docs>

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm run dev                 # http://localhost:5173
```

### 3. Tests

```bash
pytest                      # 22 tests: rooms, pagination, schema validation, auth, WebSocket, GridFS, stats, replies, typing, presence
```

### 4. Index benchmark

```bash
python benchmarks/explain_benchmark.py          # seeds 100k messages in a separate DB
```

Saves `explain("executionStats")` JSON for each query with and without its index to `benchmarks/results/`, plus `summary.md`.

## API

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/guest` | anyone | random alias + 24 h guest token |
| POST | `/register` | anyone | create member (409 if email exists) |
| POST | `/login` | anyone | member token |
| GET | `/rooms` | anyone | list rooms, each with its live `online` count |
| POST | `/rooms` | anyone | create room (409 on duplicate name) |
| GET | `/rooms/{id}/messages?before=&limit=&q=` | anyone | history, newest first; `before` = oldest message id seen; `q` = text search. Each message carries `reply_to` and a resolved `reply: {id, alias, text}` (`null` if the original expired) |
| WS | `/ws/{room_id}?token=&presence=1` | guest or member | send `{"text", "image_file_id?", "reply_to?"}`, receive `{"type":"message", ...}`. `{"type":"typing"}` is relayed to the rest of the room. With `presence=1` you also receive `{"type":"presence","online":n}` |
| GET | `/presence` | anyone | live `{online, rooms}` counts from open WebSockets (in memory, never stored) |
| POST | `/upload` | members | JPEG/PNG/WebP ≤ 5 MB → re-encoded → GridFS, returns `file_id` |
| GET | `/image/{file_id}` | anyone | streams the image from GridFS |
| GET | `/stats` | anyone | totals (incl. `online`), messages per room, uploads per user |

## Deployment (later)

- **Database:** MongoDB Atlas free tier. Set `MONGO_URI` to the Atlas connection string.
- **Backend:** Render or Railway. Start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `MONGO_URI`, `JWT_SECRET` and `CORS_ORIGINS=https://<your-frontend>`.
- **Frontend:** Vercel or Netlify. Build with `npm run build`, publish `frontend/dist`, and set `VITE_API_URL` to the backend URL. Add a SPA rewrite of `/*` to `/index.html`.
