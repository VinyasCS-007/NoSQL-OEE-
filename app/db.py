"""MongoDB connection, schema validation and index setup.

Every collection gets a $jsonSchema validator so bad documents are rejected
by the database itself, not only by our Python code.
"""
from pymongo import AsyncMongoClient

from app.config import settings

client: AsyncMongoClient | None = None


def get_db():
    return client[settings.db_name]


async def connect(db_name: str | None = None):
    global client
    if db_name:
        settings.db_name = db_name
    # tz_aware: dates come back as UTC-aware datetimes, so the API sends "+00:00"
    client = AsyncMongoClient(settings.mongo_uri, tz_aware=True)
    await init_db()


async def close():
    global client
    if client is not None:
        await client.close()
        client = None


# ---------- $jsonSchema validators ----------

USERS_SCHEMA = {
    "bsonType": "object",
    "required": ["email", "pwd_hash", "alias", "created_at"],
    "properties": {
        "email": {"bsonType": "string", "pattern": "^.+@.+$"},
        # only the bcrypt hash is stored, never the plain password
        "pwd_hash": {"bsonType": "string"},
        # public name shown to others; the email is never exposed
        "alias": {"bsonType": "string", "minLength": 1, "maxLength": 40},
        # reference to a GridFS file, not the image bytes
        "avatar_file_id": {"bsonType": "objectId"},
        "created_at": {"bsonType": "date"},
    },
}

ROOMS_SCHEMA = {
    "bsonType": "object",
    "required": ["name", "created_at"],
    "properties": {
        "name": {"bsonType": "string", "minLength": 1, "maxLength": 50},
        "created_at": {"bsonType": "date"},
    },
}

MESSAGES_SCHEMA = {
    "bsonType": "object",
    "required": ["room_id", "sender", "text", "created_at"],
    "properties": {
        # required on every message: it is the future shard key
        "room_id": {"bsonType": "objectId"},
        # sender is embedded: it is small and always read with the message
        "sender": {
            "bsonType": "object",
            "required": ["type", "alias"],
            "properties": {
                "type": {"enum": ["guest", "user"]},
                "alias": {"bsonType": "string"},
                "user_id": {"bsonType": "objectId"},
            },
        },
        "text": {"bsonType": "string", "maxLength": 2000},
        # images are referenced (GridFS), never embedded: they are large
        "image_file_id": {"bsonType": "objectId"},
        "created_at": {"bsonType": "date"},
        # only guest messages have this; the TTL index deletes them after it passes
        "expires_at": {"bsonType": "date"},
    },
}

SCHEMAS = {
    "users": USERS_SCHEMA,
    "rooms": ROOMS_SCHEMA,
    "messages": MESSAGES_SCHEMA,
}


async def init_db():
    """Create collections with validators (or update them). Safe to run on every start."""
    db = get_db()
    existing = await db.list_collection_names()
    for name, schema in SCHEMAS.items():
        validator = {"$jsonSchema": schema}
        if name in existing:
            # collMod updates the validator on an existing collection
            await db.command(
                "collMod", name,
                validator=validator,
                validationLevel="strict",
                validationAction="error",
            )
        else:
            await db.create_collection(
                name,
                validator=validator,
                validationLevel="strict",
                validationAction="error",
            )
    await create_indexes()


async def create_indexes():
    db = get_db()
    # Unique: the DB itself refuses a second account with the same email,
    # even if two register requests arrive at the same moment.
    await db.users.create_index("email", unique=True, name="email_unique")

    # Compound: matches the history query (filter room_id, sort created_at desc),
    # so Mongo reads only the 50 index keys it needs instead of scanning and sorting.
    # _id is a tie-breaker for messages saved in the same millisecond.
    await db.messages.create_index([("room_id", 1), ("created_at", -1), ("_id", -1)],
                                   name="room_recent")

    # TTL: a background task deletes a document once expires_at has passed
    # (expireAfterSeconds=0 means "at the time stored in the field").
    # Member messages have no expires_at, so the TTL index never touches them.
    await db.messages.create_index("expires_at", expireAfterSeconds=0, name="guest_ttl")

    # Text: tokenised, stemmed word search inside chat messages ($text).
    await db.messages.create_index([("text", "text")], name="text_search")
