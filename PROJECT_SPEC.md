y # Project: Anonymous Web Chat App (NoSQL OEE mini project)

## Context
College Open Ended Experiment for the course "NoSQL Database" (BISNS701). The requirement is a mini project using NoSQL databases plus a front end. The syllabus is MongoDB-focused: indexing (compound, text, unique, TTL, partial), aggregation, GridFS, capped collections, sharding, schema validation, `explain()`.

The project must show these concepts clearly, so every design choice below should be easy to explain and demonstrate.

## What to build
A free web chat app where users can chat anonymously as guests, or register an account to unlock extra features such as uploading pictures.

### Two user types
| | Guest | Registered member |
|---|---|---|
| Sign-up | None. Server gives a random alias and a temporary token | Email + password |
| Chat in public rooms | Yes | Yes |
| Upload pictures | No (view only) | Yes |
| Message retention | Messages auto-expire (TTL) | Messages kept |

Users are anonymous to each other. The server still stores what it needs (hashed passwords for members, session tokens for guests). Never expose a member's email to other users.

## Scope (build only this)
1. Guest join with a random alias and temporary token
2. Public rooms: list, create, join
3. Real-time messaging over WebSockets
4. Guest messages auto-expire via a TTL index; member messages do not expire
5. Registration and login (bcrypt password hashing, JWT)
6. Image upload for registered users, stored in GridFS
7. Indexes with `explain()` comparison (before and after)
8. One aggregation dashboard: messages per room and uploads per user

### Out of scope for now (do NOT build yet)
Redis, rate limiting, presence, report/block system, sharding benchmark, NSFW classifier, reputation system.
Keep the design ready for them (see "Design for later" below), but do not implement them.

## Tech stack
- Database: MongoDB (local for development, Atlas free tier for deployment)
- Backend: Python, FastAPI, WebSockets, `pymongo` (or `motor` for async)
- Front end: React (Vite) with Tailwind CSS and Framer Motion. The interface must look modern, animated and polished (see "UI requirements")
- Auth: JWT + bcrypt
- Images: Pillow for validation and re-encoding (strips EXIF metadata)
- Deployment (later): Render or Railway for the backend, Vercel or Netlify for the React front end, Atlas for MongoDB

## Data model
Use MongoDB schema validation (`$jsonSchema`) on every collection.

```
users:    { _id, email, pwd_hash, alias, avatar_file_id?, created_at }
rooms:    { _id, name, created_at }
messages: { _id, room_id, sender: { type: "guest"|"user", alias, user_id? },
            text, image_file_id?, created_at, expires_at? }
```
GridFS stores the images (`fs.files`, `fs.chunks`). Messages reference an image by `image_file_id`, never embed it.

### Indexes
| Index | Purpose |
|---|---|
| `users.email` unique | No duplicate accounts |
| `messages {room_id: 1, created_at: -1}` compound | Load recent messages per room |
| `messages.expires_at` TTL, `expireAfterSeconds: 0` | Guest messages vanish. Member messages have no `expires_at`, so they stay |
| `messages.text` text index | Search inside chat |

## API
- `POST /guest` returns alias + temporary token
- `POST /register`, `POST /login`
- `GET /rooms`, `POST /rooms`
- `WS /ws/{room_id}` for live messages
- `GET /rooms/{id}/messages` for history (paginated)
- `POST /upload` (members only): validate type (JPEG/PNG/WebP) and size (max 5 MB), re-encode, store in GridFS
- `GET /image/{file_id}` streams the image
- `GET /stats` returns the aggregation dashboard data (messages per room, uploads per user)

## UI requirements
- Modern, clean, polished look with a consistent design system (colors, spacing, typography), and light and dark themes
- Smooth animations with Framer Motion: message bubbles entering, page and room transitions, button and hover feedback, loading skeletons, typing-style indicators for connection state
- Chat screen: room sidebar, message list that auto-scrolls, input bar with image attach button (members only), guest badge and member badge next to aliases
- Image messages show a preview with a lightbox on click
- Login and register screens plus a "Continue as guest" option on the landing page
- Dashboard page with animated charts (Recharts) for messages per room and uploads per user
- Fully responsive (works well on mobile), with accessible contrast and keyboard support
- Keep animations subtle and fast so the app still feels responsive

## Design for later (keep in mind, don't build)
- `room_id` is on every message, since it will be the future shard key
- Put rate-limit logic behind one function so Redis can replace it later
- Reports will go in a separate `reports` collection, without changing `messages`

## Deliverables
1. Working app with the scope above
2. `README.md` with setup steps and an architecture diagram
3. A `benchmarks/` script that runs the same query with and without an index and saves the `explain("executionStats")` output
4. A short `REPORT_NOTES.md` covering: embed vs reference decisions, what "anonymous" means here and what the server stores, index choices and measured results

## Suggested project structure
```
app/
  main.py          # FastAPI app, routes
  db.py            # Mongo connection, schema validation, index creation
  auth.py          # bcrypt, JWT, guest tokens
  ws.py            # WebSocket connection manager
  images.py        # upload validation, GridFS helpers
  stats.py         # aggregation pipelines
frontend/          # React (Vite) app: src/components, src/pages, src/hooks
benchmarks/
README.md
REPORT_NOTES.md
requirements.txt
docker-compose.yml # MongoDB for local dev
```

## Build order (5 weeks)
1. Setup, Mongo connection, schema validation, room and message APIs
2. WebSocket chat, guest sessions, React chat UI with animations, TTL index
3. Registration, login, unique email index, role checks
4. GridFS image upload and display, size/type limits, EXIF stripping
5. Compound and text indexes with `explain()` comparison, aggregation dashboard, README and report

## Instructions for Claude Code
- Start with the setup and Week 1 tasks only, then stop and summarize before continuing to the next week
- Use small, readable code that a student can explain in a viva. Add short comments on why each index or schema choice exists
- Run the app and tests after each step to confirm it works
- Do not add features outside the scope list without asking
