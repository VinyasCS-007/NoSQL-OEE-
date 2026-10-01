"""Production behaviour: rate limits, default rooms, refusing the default JWT secret."""
import pytest
from fastapi.testclient import TestClient

from app.config import settings


def test_message_rate_limit(client):
    room = client.post("/rooms", json={"name": "General"}).json()["id"]
    guest = client.post("/guest").json()
    with client.websocket_connect(f"/ws/{room}?token={guest['token']}") as ws:
        for i in range(5):
            ws.send_json({"text": f"msg {i}"})
            assert ws.receive_json()["type"] == "message"
        ws.send_json({"text": "one too many"})
        reply = ws.receive_json()
        assert reply["type"] == "error" and "too fast" in reply["detail"]


def test_room_creation_rate_limit(client):
    for i in range(5):
        assert client.post("/rooms", json={"name": f"Room {i}"}).status_code == 201
    assert client.post("/rooms", json={"name": "Room 6"}).status_code == 429


def test_guest_session_rate_limit(client):
    for _ in range(20):
        assert client.post("/guest").status_code == 200
    assert client.post("/guest").status_code == 429


def test_default_rooms_seeded_once(sync_db, monkeypatch):
    monkeypatch.setattr(settings, "seed_default_rooms", True)
    from app.main import DEFAULT_ROOMS, app
    with TestClient(app) as c:
        names = sorted(r["name"] for r in c.get("/rooms").json())
    assert names == sorted(DEFAULT_ROOMS)
    with TestClient(app):  # a restart must not duplicate them
        pass
    assert sync_db.rooms.count_documents({}) == len(DEFAULT_ROOMS)


def test_production_refuses_default_secret(sync_db, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "jwt_secret", "change-me")
    from app.main import app
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        with TestClient(app):
            pass
