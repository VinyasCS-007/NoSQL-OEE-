# anon → NoSQL-OEE- integration

Drop these folders onto the repo root (they mirror its layout) and replace what's there.

## Frontend (`frontend/`)
- Replace `frontend/src/` entirely, and `frontend/index.html`. In `package.json`, `framer-motion` was removed: all animation now uses CSS and the Web Animations API. No new dependencies were added. Run `npm install` once.
- These old files were removed: `components/AnimatedNumber, AuroraBackground, ConnectionStatus, HeroScene, InputBar, MessageBubble, MessageList, RoomSidebar, Scene3D, TiltCard`, `hooks/useTheme.js`. If `.design-sync/config.json` lists them, update it.
- Theme now lives on `<html data-theme data-mood data-motion>`. Each mood sets its own theme: cinematic is dark and airy is light. If someone flips the theme by hand, that choice is remembered for the current mood.
- New files:
  - `hooks/useSettings.jsx`: mood, theme, haptics, motion, smooth scroll, cursor and toast.
  - `hooks/useScrollFx.js`: inertia scrolling and the scroll-in 3D animations.
  - `components/Fx.jsx`: card tilt, magnetic buttons, ripples and the custom cursor.
  - `components/three/*`: the R3F hero and loader scenes.
  - `components/chat/*`: the chat screen parts.

## Backend (`app/`)
- `reply_to`: an ObjectId reference added to `messages` (`$jsonSchema` updated).
  - The API returns `reply_to` plus a resolved `reply: {id, alias, text}`. Each history page resolves its replies with one `$in` lookup.
  - A reply is rejected if the original is in a different room.
  - If the original has expired through the TTL index, `reply` comes back as `null`.
- Presence is kept in memory in `ws.py` and never stored. Connect with `/ws/{room}?token=…&presence=1` to receive `{"type":"presence","online":n}`.
  - `GET /presence` returns `{online, rooms}`.
  - `GET /rooms` now includes `online`, and `/stats` totals include `online`.
- Typing: the client sends `{"type":"typing"}`. Everyone else in the room receives `{"type":"typing","alias"}`. Nothing is stored.
- PROJECT_SPEC lists presence as out of scope; it was added on request. It works with a single server process; with several processes, move it to Redis pub/sub.

## Tests
`tests/test_realtime.py` adds four tests: reply round-trip, cross-room reply rejection, typing fan-out, and presence counts. The existing tests are untouched, because presence events are only sent to sockets that ask for them.

```bash
pytest
cd frontend && npm install && npm run dev
```

README API table additions: `GET /presence`, WS `?presence=1`, WS `{"type":"typing"}`, message field `reply_to`.
