# Report notes

## 1. Embed vs reference

| Data | Decision | Why |
|---|---|---|
| `messages.sender` `{type, alias, user_id?}` | **Embedded** | Small, never changes after the message is sent, and always shown with the message. Embedding avoids a `$lookup` for every chat message. Aliases are frozen at send time, which is what a chat log should show. |
| `messages.room_id` | **Reference** (ObjectId) | Rooms are shared by many messages. It is also the future **shard key**: every message carries it, and every history query filters on it, so a room's messages would live on one shard. |
| `messages.image_file_id`, `users.avatar_file_id` | **Reference** to GridFS | Images are large binary data (up to 5 MB). Embedding would bloat every message read and hit the 16 MB document limit. GridFS splits files into 255 kB chunks (`fs.chunks`) with metadata in `fs.files`. |
| Upload owner | `fs.files.metadata.user_id` | Stored with the file, so "uploads per user" is a single `$group` on `fs.files`. |
| Future reports | Separate `reports` collection | Moderation data grows independently and must not change the `messages` schema or its hot indexes. |

## 2. What "anonymous" means here

- **Other users only ever see an alias** and a guest/member badge. API responses strip `user_id`, and emails are never returned by any endpoint. The dashboard `$lookup` projects only the alias.
- **Guests:**
  - The server stores **nothing** about the person. There is no user document; the alias lives only inside a signed JWT that expires after 24 h.
  - Their messages carry `expires_at`, and the TTL index deletes them after 24 h.
- **Members:**
  - The server stores the email (to log in), a **bcrypt hash** (never the password), the alias and `created_at`.
  - Their messages carry `sender.user_id` internally, so upload ownership can be checked, but it is never sent to clients.
- **Images:** Pillow re-encodes every upload, which **removes EXIF metadata** such as GPS location and camera model. A test checks that an EXIF tag in the upload is gone from the stored file.
- **Not anonymous from the operator:** the server still sees IP addresses at the network level. "Anonymous" means anonymous *to other users*, not a privacy-network guarantee.

## 3. Schema validation

Every collection has a `$jsonSchema` validator with `validationLevel: strict` and `validationAction: error`, applied at start-up by `create_collection` or `collMod`. The database itself rejects, for example:

- a message without `room_id`
- a sender type other than `guest` or `user`
- `created_at` stored as a string instead of a date
- text over 2000 characters

This is tested in `tests/test_week1.py::test_schema_validation_rejects_bad_documents`.

## 4. Index choices

| Index | Type | Serves |
|---|---|---|
| `users {email: 1}` | **unique** | Login lookup. It also guarantees no duplicate accounts even under concurrent sign-ups: the second insert raises `DuplicateKeyError`, which becomes HTTP 409. |
| `messages {room_id: 1, created_at: -1, _id: -1}` | **compound** | Room history: equality on `room_id` (first key), then sorted by newest. Mongo walks the index in order and stops after `limit`, with no in-memory sort. `_id` breaks ties between messages saved in the same millisecond, keeping pagination order stable. |
| `messages {expires_at: 1}`, `expireAfterSeconds: 0` | **TTL** | Mongo's background task (runs about every 60 s) deletes documents once `expires_at` has passed. Only guest messages have the field. **TTL ignores documents without it**, so member messages are kept without a second collection. |
| `messages {text: "text"}` | **text** | Word search in chat (`?q=`). Tokenises and stems words, so "pizzas" matches "pizza". |

Pagination uses a **cursor** (`before` = id of the oldest message loaded) instead of `skip()`. `skip(n)` still walks n index entries, while a cursor jumps straight to the right position in the compound index.

## 5. Measured results (`benchmarks/explain_benchmark.py`)

The benchmark used 100,000 messages in 50 rooms and 20,000 users, on a local MongoDB 8.3 on Windows. Raw `explain("executionStats")` output is in `benchmarks/results/`.

| Query | Index | Plan | Keys examined | Docs examined | Avg query time |
|---|---|---|---|---|---|
| Latest 50 messages of a room | none | `COLLSCAN → SORT` | 0 | **100,000** | 191.7 ms |
| | compound | `IXSCAN → FETCH → LIMIT` | 50 | **50** | **2.8 ms** |
| Login by email | none | `COLLSCAN` | 0 | 20,000 | 50.7 ms |
| | unique | `EXPRESS_IXSCAN` | 1 | **1** | **1.35 ms** |
| Word "pizza" in a room | none (`$regex`) | `COLLSCAN` | 0 | 100,000 | 201 ms (explain) |
| | text | `IXSCAN → TEXT_MATCH` | 22,907 | 45,814 | 227 ms (explain) |

**Reading the results:**

- **Compound index:** the history query went from scanning *every* document plus a blocking in-memory sort to reading exactly 50 index keys and 50 documents. That is about 70× faster, and the cost no longer grows with collection size.
- **Unique index:** the lookup became a single-key point read (MongoDB 8's `EXPRESS_IXSCAN` fast path).
- **Text index:** the benefit is correctness more than speed at this size. `$text` understands words and stems, while a regex does not. It examined more documents here because "pizza" appears in about 23k messages across **all** rooms, and the room filter is applied after the text match.
  - The fix, if search became hot, is a compound text index `{room_id: 1, text: "text"}`. Queries would then have to include an equality on `room_id`, which ours always do.
  - It was left out to keep the spec's index list and to show this trade-off in the viva.
- **Write cost:** each index is updated on every insert. Four indexes on `messages` is a reasonable trade for a read-heavy chat.

## 6. Aggregation (`app/stats.py`)

- **Messages per room:** a `$group` by `room_id` counts all messages, plus guest and member counts using `$cond`. Then `$lookup` rooms joins the room name, followed by `$project` and `$sort`.
- **Uploads per user:** a `$group` on `fs.files` by `metadata.user_id` counts uploads and sums bytes. Then `$lookup` users projects **only the alias**, never the email.

## 7. Replies, typing and presence (added after the spec)

- **Replies are a reference, not an embed.** `messages.reply_to` stores the original message's ObjectId; the `$jsonSchema` validator allows it as an optional `objectId`.
  - When a history page loads, all its replies are resolved with a single `$in` query rather than one lookup per message, and the API returns `reply: {id, alias, text}`.
  - A reply must be in the same room as the original. If the original was a guest message that the TTL index has since deleted, `reply` is `null`. Embedding a copy would have kept a guest's text alive past its 24 h expiry, which defeats the point of the TTL.
- **Typing and presence are never stored.** They live in memory in `ws.py`.
  - Typing pings are relayed to the other sockets in the room.
  - Presence counts unique aliases per room, so one person with two tabs counts once. It is pushed only to sockets that connect with `?presence=1`, and is also available from `GET /presence`, the `online` field on `/rooms` and the `/stats` totals.
- **Scope note:** PROJECT_SPEC lists presence as out of scope; it was added on request. It is correct for a single server process. With several processes it would move to Redis pub/sub, the same swap planned for rate limiting.

## 8. Designed for later (not built)

- **Sharding:** `room_id` is on every message and leads the compound index, making it the natural shard key.
- **Rate limiting:** every WebSocket message goes through `ratelimit.check_rate_limit()`, a no-op today. A Redis counter can replace it without touching the chat code.
- **Reports:** moderation goes in a separate `reports` collection, with no change to `messages`.
