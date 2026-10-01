from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class RoomOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    online: int = 0  # live count from the WebSocket manager, not stored


class ReplyOut(BaseModel):
    id: str
    alias: str
    text: str


class SenderOut(BaseModel):
    type: Literal["guest", "user"]
    alias: str


class MessageOut(BaseModel):
    id: str
    room_id: str
    sender: SenderOut  # user_id is left out on purpose: users stay anonymous
    text: str
    image_file_id: str | None = None
    reply_to: str | None = None  # id of the message being answered (reference)
    reply: ReplyOut | None = None  # resolved at read time; None if the original expired
    created_at: datetime


class MessagePage(BaseModel):
    messages: list[MessageOut]
    next_before: str | None  # message id; pass as ?before= to load older messages


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt uses max 72 bytes
    alias: str | None = Field(default=None, min_length=2, max_length=40)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    role: Literal["guest", "user"]
    alias: str  # the email is never sent back


class UploadOut(BaseModel):
    file_id: str
    content_type: str
    size: int
