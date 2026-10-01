"""WebSocket connection manager: open sockets per room, presence and typing fan-out.

Presence lives in memory (one server process). When the app scales out it moves to
Redis pub/sub without changing the routes; see ratelimit.py for the same idea.
"""
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # room_id -> {socket: {"alias": str, "presence": bool}}
        self.rooms: dict[str, dict[WebSocket, dict]] = defaultdict(dict)

    async def connect(self, room_id: str, ws: WebSocket, alias: str, presence: bool = False):
        await ws.accept()
        # presence=True means the client asked for presence events (?presence=1)
        self.rooms[room_id][ws] = {"alias": alias, "presence": presence}

    def disconnect(self, room_id: str, ws: WebSocket):
        self.rooms.get(room_id, {}).pop(ws, None)
        if room_id in self.rooms and not self.rooms[room_id]:
            del self.rooms[room_id]

    def online(self, room_id: str) -> int:
        # one person with two tabs open counts once
        return len({c["alias"] for c in self.rooms.get(room_id, {}).values()})

    def snapshot(self) -> dict[str, int]:
        return {room_id: self.online(room_id) for room_id in list(self.rooms)}

    def total_online(self) -> int:
        return len({c["alias"] for conns in self.rooms.values() for c in conns.values()})

    async def broadcast(self, room_id: str, data: dict, exclude: WebSocket | None = None,
                        presence_only: bool = False):
        for ws, info in list(self.rooms.get(room_id, {}).items()):
            if ws is exclude or (presence_only and not info["presence"]):
                continue
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(room_id, ws)

    async def broadcast_presence(self, room_id: str):
        await self.broadcast(room_id, {"type": "presence", "room_id": room_id,
                                       "online": self.online(room_id)}, presence_only=True)


manager = ConnectionManager()
