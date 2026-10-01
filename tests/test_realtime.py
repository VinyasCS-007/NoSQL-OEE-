"""Replies (reference by _id), presence and typing over the WebSocket."""
import pytest


@pytest.fixture
def room(client):
    return client.post("/rooms", json={"name": "General"}).json()["id"]


def test_reply_references_original(client, room, sync_db):
    a, b = client.post("/guest").json(), client.post("/guest").json()
    with client.websocket_connect(f"/ws/{room}?token={a['token']}") as wa, \
         client.websocket_connect(f"/ws/{room}?token={b['token']}") as wb:
        wa.send_json({"text": "anyone up?"})
        original = wa.receive_json()["message"]
        wb.receive_json()

        wb.send_json({"text": "always", "reply_to": original["id"]})
        reply = wa.receive_json()["message"]
        wb.receive_json()

    assert reply["reply_to"] == original["id"]
    assert reply["reply"] == {"id": original["id"], "alias": a["alias"], "text": "anyone up?"}
    # stored as a reference, not a copy of the original
    stored = sync_db.messages.find_one({"text": "always"})
    assert str(stored["reply_to"]) == original["id"] and "reply" not in stored

    newest = client.get(f"/rooms/{room}/messages").json()["messages"][0]
    assert newest["reply"]["text"] == "anyone up?"


def test_reply_to_other_room_is_rejected(client, room):
    other = client.post("/rooms", json={"name": "Music"}).json()["id"]
    g = client.post("/guest").json()
    with client.websocket_connect(f"/ws/{other}?token={g['token']}") as ws:
        ws.send_json({"text": "in music"})
        msg_id = ws.receive_json()["message"]["id"]
    with client.websocket_connect(f"/ws/{room}?token={g['token']}") as ws:
        ws.send_json({"text": "cross-room", "reply_to": msg_id})
        assert ws.receive_json()["type"] == "error"


def test_typing_goes_to_others_only(client, room):
    a, b = client.post("/guest").json(), client.post("/guest").json()
    with client.websocket_connect(f"/ws/{room}?token={a['token']}") as wa, \
         client.websocket_connect(f"/ws/{room}?token={b['token']}") as wb:
        wa.send_json({"type": "typing"})
        assert wb.receive_json() == {"type": "typing", "alias": a["alias"]}
        # the sender gets nothing for typing; its next frame is its own message
        wa.send_json({"text": "hi"})
        assert wa.receive_json()["type"] == "message"
    # typing is never stored
    assert client.get(f"/rooms/{room}/messages").json()["messages"][0]["text"] == "hi"


def test_presence_counts_and_events(client, room):
    a, b = client.post("/guest").json(), client.post("/guest").json()
    with client.websocket_connect(f"/ws/{room}?token={a['token']}&presence=1") as wa:
        assert wa.receive_json() == {"type": "presence", "room_id": room, "online": 1}
        with client.websocket_connect(f"/ws/{room}?token={b['token']}"):
            assert wa.receive_json()["online"] == 2
            assert client.get("/presence").json() == {"online": 2, "rooms": {room: 2}}
            assert client.get("/rooms").json()[0]["online"] == 2
            assert client.get("/stats").json()["totals"]["online"] == 2
        assert wa.receive_json()["online"] == 1
    assert client.get("/presence").json()["online"] == 0
