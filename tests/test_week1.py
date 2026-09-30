from datetime import datetime, timezone

import pytest
from bson import ObjectId
from pymongo.errors import WriteError

from app.messages import save_message

GUEST = {"type": "guest", "alias": "QuietOtter42"}
MEMBER = {"type": "user", "alias": "BlueFalcon7", "user_id": ObjectId()}


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_create_and_list_rooms(client):
    r = client.post("/rooms", json={"name": "General"})
    assert r.status_code == 201
    assert r.json()["name"] == "General"
    client.post("/rooms", json={"name": "Anime"})
    names = [room["name"] for room in client.get("/rooms").json()]
    assert names == ["Anime", "General"]


def test_duplicate_room_name_rejected(client):
    client.post("/rooms", json={"name": "General"})
    assert client.post("/rooms", json={"name": "general"}).status_code == 409


def test_invalid_room_name(client):
    assert client.post("/rooms", json={"name": ""}).status_code == 422
    assert client.post("/rooms", json={"name": "x" * 51}).status_code == 422


def test_messages_unknown_room(client):
    assert client.get("/rooms/not-an-id/messages").status_code == 404
    assert client.get(f"/rooms/{ObjectId()}/messages").status_code == 404


def test_history_pagination_and_ttl_field(client, sync_db):
    room_id = ObjectId(client.post("/rooms", json={"name": "General"}).json()["id"])

    # save_message is async; run it on the TestClient's event loop
    for i in range(5):
        sender = GUEST if i % 2 == 0 else MEMBER
        client.portal.call(save_message, room_id, sender, f"msg {i}")

    page1 = client.get(f"/rooms/{room_id}/messages?limit=3").json()
    assert [m["text"] for m in page1["messages"]] == ["msg 4", "msg 3", "msg 2"]
    assert page1["next_before"] is not None
    # user_id must never leak to other users
    assert all("user_id" not in m["sender"] for m in page1["messages"])

    page2 = client.get(f"/rooms/{room_id}/messages",
                       params={"limit": 3, "before": page1["next_before"]}).json()
    assert [m["text"] for m in page2["messages"]] == ["msg 1", "msg 0"]
    assert page2["next_before"] is None

    # guests get expires_at (for TTL), members do not
    assert sync_db.messages.count_documents({"sender.type": "guest", "expires_at": {"$exists": True}}) == 3
    assert sync_db.messages.count_documents({"sender.type": "user", "expires_at": {"$exists": True}}) == 0


def test_schema_validation_rejects_bad_documents(client, sync_db):
    # missing room_id
    with pytest.raises(WriteError):
        sync_db.messages.insert_one({"sender": GUEST, "text": "hi",
                                     "created_at": datetime.now(timezone.utc)})
    # invalid sender type
    with pytest.raises(WriteError):
        sync_db.messages.insert_one({"room_id": ObjectId(), "text": "hi",
                                     "sender": {"type": "admin", "alias": "x"},
                                     "created_at": datetime.now(timezone.utc)})
    # created_at as a string instead of a date
    with pytest.raises(WriteError):
        sync_db.rooms.insert_one({"name": "Bad", "created_at": "today"})
