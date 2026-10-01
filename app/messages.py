"""Saving and loading chat messages. Used by the REST API and (week 2) the WebSocket."""
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.config import settings
from app.db import get_db

MAX_PAGE = 100


async def save_message(room_id: ObjectId, sender: dict, text: str,
                       image_file_id: ObjectId | None = None,
                       reply_to: ObjectId | None = None) -> dict:
    now = datetime.now(timezone.utc)
    doc = {"room_id": room_id, "sender": sender, "text": text, "created_at": now}
    if image_file_id:
        doc["image_file_id"] = image_file_id
    if reply_to:
        doc["reply_to"] = reply_to
    # Only guests get expires_at, so only their messages are removed by the TTL index.
    if sender["type"] == "guest":
        doc["expires_at"] = now + timedelta(hours=settings.guest_message_ttl_hours)
    result = await get_db().messages.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_history(room_id: ObjectId, before: dict | None = None,
                      limit: int = 50, search: str | None = None) -> list[dict]:
    """Newest-first page of messages.

    Cursor pagination: `before` is the oldest message of the previous page, and we
    return what comes after it. Unlike skip(), deep pages stay fast.
    Sorting on (created_at, _id) keeps the order stable when two messages share the
    same millisecond. The compound index {room_id: 1, created_at: -1, _id: -1}
    serves both the filter and the sort. With `search`, the text index is used ($text)."""
    query = {"room_id": room_id}
    if before:
        t, oid = before["created_at"], before["_id"]
        query["$or"] = [{"created_at": {"$lt": t}},
                        {"created_at": t, "_id": {"$lt": oid}}]
    if search:
        query["$text"] = {"$search": search}
    limit = max(1, min(limit, MAX_PAGE))
    cursor = get_db().messages.find(query).sort([("created_at", -1), ("_id", -1)]).limit(limit)
    return await cursor.to_list()


async def find_reply_target(room_id: ObjectId, message_id: ObjectId) -> dict | None:
    """A reply may only point at a message in the same room."""
    return await get_db().messages.find_one({"_id": message_id, "room_id": room_id},
                                            {"sender.alias": 1, "text": 1})


async def resolve_replies(docs: list[dict]) -> dict:
    """One $in query for every reply_to on the page (no N+1 lookups). _id index only."""
    ids = list({d["reply_to"] for d in docs if d.get("reply_to")})
    if not ids:
        return {}
    found = await get_db().messages.find({"_id": {"$in": ids}}, {"sender.alias": 1, "text": 1}).to_list()
    return {f["_id"]: f for f in found}


def message_out(doc: dict, reply_doc: dict | None = None) -> dict:
    """Convert a message document to its public JSON shape (no user_id, no email)."""
    return {
        "id": str(doc["_id"]),
        "room_id": str(doc["room_id"]),
        "sender": {"type": doc["sender"]["type"], "alias": doc["sender"]["alias"]},
        "text": doc["text"],
        "image_file_id": str(doc["image_file_id"]) if doc.get("image_file_id") else None,
        "reply_to": str(doc["reply_to"]) if doc.get("reply_to") else None,
        "reply": {"id": str(reply_doc["_id"]), "alias": reply_doc["sender"]["alias"],
                  "text": reply_doc["text"][:200]} if reply_doc else None,
        "created_at": doc["created_at"],
    }
