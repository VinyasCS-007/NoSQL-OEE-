"""Rate limiting.

A small in-memory sliding-window limiter. Every limited action goes through
`allow()`, so it can later be swapped for a Redis counter (needed once the app
runs on more than one server process) without touching the routes.
"""
import time
from collections import defaultdict, deque

# action -> (max events, window in seconds)
LIMITS = {
    "message": (5, 5),         # 5 chat messages per 5 s per sender
    "upload": (10, 3600),      # 10 pictures per hour per member
    "room": (5, 600),          # 5 new rooms per 10 min per client
    "guest": (20, 3600),       # 20 guest aliases per hour per client (stops alias farming)
    "auth": (10, 60),          # 10 login/register attempts per minute per client
}

_events: dict[str, deque] = defaultdict(deque)


def allow(action: str, key: str) -> bool:
    """Record one event for (action, key); return False if the limit is already reached."""
    limit, window = LIMITS[action]
    now = time.monotonic()
    q = _events[f"{action}:{key}"]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True


def reset():
    """Forget all events (used by the tests)."""
    _events.clear()


async def check_rate_limit(identity: dict) -> bool:
    """Chat messages: members are keyed by user id, guests by their alias."""
    key = identity.get("sub") or f"guest:{identity.get('alias')}"
    return allow("message", key)
