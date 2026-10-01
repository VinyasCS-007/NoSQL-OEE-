import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, FastAPI, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from gridfs.errors import NoFile
from pymongo.errors import DuplicateKeyError

from app import db, images, stats
from app.auth import (create_token, decode_token, hash_password, random_alias, require_member,
                      sender_from_identity, verify_password)
from app.config import settings
from app.messages import find_reply_target, get_history, message_out, resolve_replies, save_message
from app.models import (LoginIn, MessagePage, RegisterIn, RoomCreate, RoomOut, TokenOut,
                        UploadOut)
from app.ratelimit import allow, check_rate_limit
from app.ws import manager


DEFAULT_ROOMS = ["General", "Anime", "Music", "Study Group", "Cricket"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.environment == "production" and settings.jwt_secret in ("", "change-me"):
        # with the default secret anyone could forge tokens, so never serve publicly like that
        raise RuntimeError("Set a strong JWT_SECRET before running in production")
    await db.connect()  # connects, applies schema validators and indexes
    if settings.seed_default_rooms and await db.get_db().rooms.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        await db.get_db().rooms.insert_many([{"name": n, "created_at": now} for n in DEFAULT_ROOMS])
    yield
    await db.close()


app = FastAPI(title="Anonymous Chat (NoSQL OEE)", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


def to_object_id(value: str, what: str = "Item") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(404, f"{what} not found")


def client_ip(request: Request) -> str:
    # behind Render's proxy uvicorn --proxy-headers puts the real visitor IP here
    return request.client.host if request.client else "unknown"


def limit(action: str, key: str, detail: str):
    if not allow(action, key):
        raise HTTPException(429, detail)


def room_out(doc: dict) -> dict:
    rid = str(doc["_id"])
    return {"id": rid, "name": doc["name"], "created_at": doc["created_at"], "online": manager.online(rid)}


@app.get("/health")
async def health():
    await db.get_db().command("ping")
    return {"status": "ok"}


# ---------- guests and members ----------

@app.post("/guest", response_model=TokenOut)
async def guest(request: Request):
    limit("guest", client_ip(request), "Too many guest sessions from this network. Try again later.")
    # Guests are not stored in the DB: the signed token carries their alias.
    alias = random_alias()
    return {"token": create_token("guest", alias), "role": "guest", "alias": alias}


@app.post("/register", response_model=TokenOut, status_code=201)
async def register(body: RegisterIn, request: Request):
    limit("auth", client_ip(request), "Too many attempts. Wait a minute and try again.")
    alias = (body.alias or random_alias()).strip()
    doc = {
        "email": body.email.lower(),
        "pwd_hash": hash_password(body.password),
        "alias": alias,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        result = await db.get_db().users.insert_one(doc)
    except DuplicateKeyError:  # raised by the unique index on email
        raise HTTPException(409, "An account with this email already exists")
    return {"token": create_token("user", alias, str(result.inserted_id)), "role": "user", "alias": alias}


@app.post("/login", response_model=TokenOut)
async def login(body: LoginIn, request: Request):
    limit("auth", client_ip(request), "Too many attempts. Wait a minute and try again.")
    user = await db.get_db().users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["pwd_hash"]):
        raise HTTPException(401, "Wrong email or password")
    return {"token": create_token("user", user["alias"], str(user["_id"])), "role": "user", "alias": user["alias"]}


# ---------- rooms and history ----------

@app.get("/rooms", response_model=list[RoomOut])
async def list_rooms():
    rooms = await db.get_db().rooms.find().sort("name", 1).to_list()
    return [room_out(r) for r in rooms]


@app.post("/rooms", response_model=RoomOut, status_code=201)
async def create_room(body: RoomCreate, request: Request):
    # guests and members can both create rooms; the limit keeps bots from flooding the list
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Room name cannot be blank")
    limit("room", client_ip(request), "You're creating rooms too fast. Try again in a few minutes.")
    # case-insensitive duplicate check ("General" == "general")
    exists = await db.get_db().rooms.find_one(
        {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
    )
    if exists:
        raise HTTPException(409, "A room with this name already exists")
    doc = {"name": name, "created_at": datetime.now(timezone.utc)}
    result = await db.get_db().rooms.insert_one(doc)
    doc["_id"] = result.inserted_id
    return room_out(doc)


@app.get("/rooms/{room_id}/messages", response_model=MessagePage)
async def room_messages(
    room_id: str,
    before: str | None = Query(None, description="id of the oldest message already loaded"),
    limit: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
):
    oid = to_object_id(room_id, "Room")
    if not await db.get_db().rooms.find_one({"_id": oid}):
        raise HTTPException(404, "Room not found")
    cursor_doc = None
    if before:
        cursor_doc = await db.get_db().messages.find_one(
            {"_id": to_object_id(before, "Message"), "room_id": oid}, {"created_at": 1})
        if not cursor_doc:
            raise HTTPException(404, "Message not found")
    docs = await get_history(oid, cursor_doc, limit, search=q or None)
    replies = await resolve_replies(docs)
    # a full page means there may be older messages
    next_before = str(docs[-1]["_id"]) if len(docs) == limit else None
    return {"messages": [message_out(d, replies.get(d.get("reply_to"))) for d in docs],
            "next_before": next_before}


@app.get("/presence")
async def presence():
    # in-memory count of open sockets; nothing is written to MongoDB
    return {"online": manager.total_online(), "rooms": manager.snapshot()}


# ---------- images (GridFS) ----------

@app.post("/upload", response_model=UploadOut, status_code=201)
async def upload(file: UploadFile, member: dict = Depends(require_member)):
    limit("upload", member["sub"], "Upload limit reached (10 pictures per hour).")
    data = await file.read(images.MAX_BYTES + 1)  # read one extra byte to detect oversize
    try:
        clean, content_type = images.validate_and_reencode(data)
    except images.ImageError as e:
        raise HTTPException(400, str(e))
    file_id = await images.store_image(clean, content_type, member["sub"], file.filename)
    return {"file_id": str(file_id), "content_type": content_type, "size": len(clean)}


@app.get("/image/{file_id}")
async def get_image(file_id: str):
    try:
        grid_out = await images.open_image(to_object_id(file_id, "Image"))
    except NoFile:
        raise HTTPException(404, "Image not found")
    content_type = (grid_out.metadata or {}).get("content_type", "application/octet-stream")

    async def chunks():
        # stream chunk by chunk instead of loading the whole file into memory
        while chunk := await grid_out.readchunk():
            yield chunk

    return StreamingResponse(chunks(), media_type=content_type,
                             headers={"Cache-Control": "public, max-age=86400"})


# ---------- dashboard ----------

@app.get("/stats")
async def get_stats():
    return {
        "totals": await stats.totals(),
        "messages_per_room": await stats.messages_per_room(),
        "uploads_per_user": await stats.uploads_per_user(),
    }


# ---------- live chat ----------

@app.websocket("/ws/{room_id}")
async def chat_socket(ws: WebSocket, room_id: str, token: str = "", presence: int = 0):
    # Browsers can't set headers on WebSockets, so the token comes as ?token=
    try:
        identity = decode_token(token)
        oid = ObjectId(room_id)
    except (ValueError, InvalidId):
        await ws.close(code=4401)
        return
    if not await db.get_db().rooms.find_one({"_id": oid}):
        await ws.close(code=4404)
        return

    await manager.connect(room_id, ws, identity["alias"], presence=bool(presence))
    await manager.broadcast_presence(room_id)
    try:
        while True:
            data = await ws.receive_json()
            # typing is relayed to everyone else in the room and never stored
            if data.get("type") == "typing":
                await manager.broadcast(room_id, {"type": "typing", "alias": identity["alias"]}, exclude=ws)
                continue
            text = str(data.get("text", "")).strip()[:2000]
            image_id = data.get("image_file_id")
            reply_doc = None
            if data.get("reply_to"):
                try:
                    reply_doc = await find_reply_target(oid, ObjectId(data["reply_to"]))
                except (InvalidId, TypeError):
                    reply_doc = None
                if not reply_doc:
                    await ws.send_json({"type": "error", "detail": "That message is no longer available"})
                    continue

            if image_id:
                # only members can post images, and only images they uploaded
                if identity["role"] != "user":
                    await ws.send_json({"type": "error", "detail": "Only members can send images"})
                    continue
                try:
                    image_id = ObjectId(image_id)
                except InvalidId:
                    image_id = None
                if not image_id or not await images.image_owned_by(image_id, identity["sub"]):
                    await ws.send_json({"type": "error", "detail": "Unknown image"})
                    continue
            if not text and not image_id:
                continue
            if not await check_rate_limit(identity):
                await ws.send_json({"type": "error", "detail": "Slow down, you're sending messages too fast."})
                continue

            doc = await save_message(oid, sender_from_identity(identity), text, image_id,
                                     reply_doc["_id"] if reply_doc else None)
            out = message_out(doc, reply_doc)
            out["created_at"] = out["created_at"].isoformat()
            await manager.broadcast(room_id, {"type": "message", "message": out})
    except (WebSocketDisconnect, ValueError):
        pass
    finally:
        manager.disconnect(room_id, ws)
        await manager.broadcast_presence(room_id)
