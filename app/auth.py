"""Password hashing (bcrypt), JWT tokens, guest aliases and role checks."""
import random
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

ALGORITHM = "HS256"
GUEST_TOKEN_HOURS = 24
MEMBER_TOKEN_DAYS = 7

ADJECTIVES = ["Quiet", "Blue", "Swift", "Lucky", "Brave", "Calm", "Clever", "Misty",
              "Sunny", "Wild", "Silent", "Cosmic", "Gentle", "Rapid", "Golden"]
ANIMALS = ["Otter", "Falcon", "Panda", "Fox", "Owl", "Tiger", "Koala", "Wolf",
           "Dolphin", "Raven", "Lynx", "Heron", "Badger", "Gecko", "Moose"]


def random_alias() -> str:
    return f"{random.choice(ADJECTIVES)}{random.choice(ANIMALS)}{random.randint(10, 99)}"


def hash_password(password: str) -> str:
    # bcrypt adds a random salt and is slow on purpose, which resists brute force
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, pwd_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), pwd_hash.encode())


def create_token(role: str, alias: str, user_id: str | None = None) -> str:
    """role is 'guest' or 'user'. Guests have no DB record: the token is their identity."""
    lifetime = timedelta(hours=GUEST_TOKEN_HOURS) if role == "guest" else timedelta(days=MEMBER_TOKEN_DAYS)
    payload = {
        "role": role,
        "alias": alias,
        "exp": datetime.now(timezone.utc) + lifetime,
    }
    if user_id:
        payload["sub"] = user_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Returns the payload, or raises ValueError if the token is invalid or expired."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError as e:
        raise ValueError(str(e))


bearer = HTTPBearer(auto_error=False)


def current_identity(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    """Any valid token (guest or member)."""
    if creds is None:
        raise HTTPException(401, "Missing token")
    try:
        return decode_token(creds.credentials)
    except ValueError:
        raise HTTPException(401, "Invalid or expired token")


def require_member(identity: dict = Depends(current_identity)) -> dict:
    """Role check: only registered users (e.g. for image upload)."""
    if identity.get("role") != "user":
        raise HTTPException(403, "Only registered members can do this")
    return identity


def sender_from_identity(identity: dict) -> dict:
    """Build the embedded `sender` sub-document for a message."""
    from bson import ObjectId
    sender = {"type": identity["role"], "alias": identity["alias"]}
    if identity["role"] == "user":
        sender["user_id"] = ObjectId(identity["sub"])
    return sender
