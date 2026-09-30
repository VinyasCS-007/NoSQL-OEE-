"""Saving and loading chat messages. Used by the REST API and (week 2) the WebSocket."""
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.config import settings
from app.db import get_db

MAX_PAGE = 100


async def save_message(room_id: ObjectId, sender: dict, text: str,
                       image_file_id: ObjectId | None = None) -> dict:
    now = datetime.now(timezone.utc)
    doc = {"room_id": room_id, "sender": sender, "text": text, "created_at": now}
    if image_file_id:
        doc["image_file_id"] = image_file_id
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


def message_out(doc: dict) -> dict:
    """Convert a message document to its public JSON shape (no user_id, no email)."""
    return {
        "id": str(doc["_id"]),
        "room_id": str(doc["room_id"]),
        "sender": {"type": doc["sender"]["type"], "alias": doc["sender"]["alias"]},
        "text": doc["text"],
        "image_file_id": str(doc["image_file_id"]) if doc.get("image_file_id") else None,
        "created_at": doc["created_at"],
    }
