"""Aggregation pipelines for the dashboard."""
from app.db import get_db
from app.ws import manager


async def messages_per_room() -> list[dict]:
    pipeline = [
        # 1. count messages for each room_id
        {"$group": {"_id": "$room_id", "messages": {"$sum": 1},
                    "guest": {"$sum": {"$cond": [{"$eq": ["$sender.type", "guest"]}, 1, 0]}},
                    "member": {"$sum": {"$cond": [{"$eq": ["$sender.type", "user"]}, 1, 0]}}}},
        # 2. join the room name (reference -> $lookup)
        {"$lookup": {"from": "rooms", "localField": "_id", "foreignField": "_id", "as": "room"}},
        {"$unwind": "$room"},
        {"$project": {"_id": 0, "room": "$room.name", "messages": 1, "guest": 1, "member": 1}},
        {"$sort": {"messages": -1}},
    ]
    return await (await get_db().messages.aggregate(pipeline)).to_list()


async def uploads_per_user() -> list[dict]:
    pipeline = [
        # GridFS stores each upload in fs.files with our metadata.user_id
        {"$group": {"_id": "$metadata.user_id", "uploads": {"$sum": 1},
                    "bytes": {"$sum": "$length"}}},
        {"$lookup": {"from": "users", "localField": "_id", "foreignField": "_id", "as": "user"}},
        {"$unwind": "$user"},
        # only the alias is shown; the email stays private
        {"$project": {"_id": 0, "alias": "$user.alias", "uploads": 1, "bytes": 1}},
        {"$sort": {"uploads": -1}},
    ]
    return await (await get_db()["fs.files"].aggregate(pipeline)).to_list()


async def totals() -> dict:
    db = get_db()
    return {
        "rooms": await db.rooms.count_documents({}),
        "messages": await db.messages.count_documents({}),
        "members": await db.users.count_documents({}),
        "uploads": await db["fs.files"].count_documents({}),
        "online": manager.total_online(),  # live, from open WebSockets
    }
