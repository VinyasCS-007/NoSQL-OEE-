import io

import pytest
from PIL import Image
from starlette.websockets import WebSocketDisconnect


def make_image(fmt="JPEG", with_exif=False) -> bytes:
    img = Image.new("RGB", (40, 30), "teal")
    out = io.BytesIO()
    if with_exif:
        exif = Image.Exif()
        exif[0x010F] = "SecretCameraMaker"  # "Make" tag
        img.save(out, format=fmt, exif=exif)
    else:
        img.save(out, format=fmt)
    return out.getvalue()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def room(client):
    return client.post("/rooms", json={"name": "General"}).json()["id"]


@pytest.fixture
def member(client):
    r = client.post("/register", json={"email": "a@example.com", "password": "secret123", "alias": "BlueFalcon"})
    return r.json()


# ---------- guests / auth ----------

def test_guest_gets_alias_and_token(client):
    body = client.post("/guest").json()
    assert body["role"] == "guest" and body["alias"] and body["token"]


def test_register_login_and_unique_email(client, sync_db, member):
    assert member["role"] == "user" and member["alias"] == "BlueFalcon"
    assert "email" not in member
    # stored hash, not the plain password
    user = sync_db.users.find_one({"email": "a@example.com"})
    assert user["pwd_hash"] != "secret123" and user["pwd_hash"].startswith("$2")
    # the unique index rejects the same email (any case)
    dup = client.post("/register", json={"email": "A@example.com", "password": "another123"})
    assert dup.status_code == 409
    assert client.post("/login", json={"email": "a@example.com", "password": "secret123"}).status_code == 200
    assert client.post("/login", json={"email": "a@example.com", "password": "wrong-pass"}).status_code == 401


def test_indexes_exist(client, sync_db):
    idx = sync_db.messages.index_information()
    assert idx["guest_ttl"]["expireAfterSeconds"] == 0
    assert idx["room_recent"]["key"] == [("room_id", 1), ("created_at", -1), ("_id", -1)]
    assert "text_search" in idx
    assert sync_db.users.index_information()["email_unique"]["unique"] is True


# ---------- WebSocket chat ----------

def test_websocket_broadcast_and_history(client, room, member):
    guest = client.post("/guest").json()
    with client.websocket_connect(f"/ws/{room}?token={guest['token']}") as g, \
         client.websocket_connect(f"/ws/{room}?token={member['token']}") as m:
        g.send_json({"text": "hello from guest"})
        assert m.receive_json()["message"]["text"] == "hello from guest"
        assert g.receive_json()["message"]["sender"]["type"] == "guest"

        m.send_json({"text": "hi guest"})
        msg = g.receive_json()["message"]
        assert msg["sender"] == {"type": "user", "alias": "BlueFalcon"}
        m.receive_json()

    history = client.get(f"/rooms/{room}/messages").json()["messages"]
    assert [x["text"] for x in history] == ["hi guest", "hello from guest"]


def test_websocket_rejects_bad_token(client, room):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/ws/{room}?token=garbage") as ws:
            ws.receive_json()


def test_text_search(client, room, member):
    with client.websocket_connect(f"/ws/{room}?token={member['token']}") as ws:
        for text in ["pizza tonight?", "I prefer burgers", "pizzas are great"]:
            ws.send_json({"text": text})
            ws.receive_json()
    found = client.get(f"/rooms/{room}/messages", params={"q": "pizza"}).json()["messages"]
    # text index stems words: "pizzas" matches "pizza"
    assert sorted(m["text"] for m in found) == ["pizza tonight?", "pizzas are great"]


# ---------- images (GridFS) ----------

def test_upload_requires_member(client):
    guest = client.post("/guest").json()
    files = {"file": ("a.jpg", make_image(), "image/jpeg")}
    assert client.post("/upload", files=files).status_code == 401
    assert client.post("/upload", files=files, headers=auth(guest["token"])).status_code == 403


def test_upload_validates_type_and_size(client, member):
    h = auth(member["token"])
    fake = {"file": ("a.jpg", b"not an image", "image/jpeg")}
    assert client.post("/upload", files=fake, headers=h).status_code == 400
    gif = {"file": ("a.gif", make_image("GIF"), "image/gif")}
    assert client.post("/upload", files=gif, headers=h).status_code == 400
    big = {"file": ("big.jpg", b"\xff" * (5 * 1024 * 1024 + 10), "image/jpeg")}
    assert client.post("/upload", files=big, headers=h).status_code == 400


def test_upload_strips_exif_and_streams(client, member, room, sync_db):
    raw = make_image(with_exif=True)
    assert b"SecretCameraMaker" in raw
    r = client.post("/upload", files={"file": ("p.jpg", raw, "image/jpeg")}, headers=auth(member["token"]))
    assert r.status_code == 201
    file_id = r.json()["file_id"]

    img = client.get(f"/image/{file_id}")
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"
    assert b"SecretCameraMaker" not in img.content
    assert sync_db["fs.chunks"].count_documents({}) >= 1

    # member sends an image message referencing the GridFS file
    with client.websocket_connect(f"/ws/{room}?token={member['token']}") as ws:
        ws.send_json({"text": "", "image_file_id": file_id})
        assert ws.receive_json()["message"]["image_file_id"] == file_id


def test_guest_cannot_send_image_message(client, room):
    guest = client.post("/guest").json()
    with client.websocket_connect(f"/ws/{room}?token={guest['token']}") as ws:
        ws.send_json({"image_file_id": "0" * 24})
        assert ws.receive_json()["type"] == "error"


# ---------- stats ----------

def test_stats(client, room, member):
    guest = client.post("/guest").json()
    with client.websocket_connect(f"/ws/{room}?token={guest['token']}") as ws:
        ws.send_json({"text": "one"}); ws.receive_json()
        ws.send_json({"text": "two"}); ws.receive_json()
    client.post("/upload", files={"file": ("p.png", make_image("PNG"), "image/png")}, headers=auth(member["token"]))

    s = client.get("/stats").json()
    assert s["messages_per_room"] == [{"room": "General", "messages": 2, "guest": 2, "member": 0}]
    assert s["uploads_per_user"][0]["alias"] == "BlueFalcon"
    assert s["uploads_per_user"][0]["uploads"] == 1
    assert s["totals"]["members"] == 1
