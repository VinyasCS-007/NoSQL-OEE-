"""WebSocket connection manager: keeps the open sockets of each room."""
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # room_id -> set of connected sockets
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, room_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms[room_id].add(ws)

    def disconnect(self, room_id: str, ws: WebSocket):
        self.rooms[room_id].discard(ws)
        if not self.rooms[room_id]:
            del self.rooms[room_id]

    async def broadcast(self, room_id: str, data: dict):
        for ws in list(self.rooms.get(room_id, ())):
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(room_id, ws)


manager = ConnectionManager()
