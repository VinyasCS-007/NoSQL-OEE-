"""Rate limiting hook.

Not implemented yet (out of scope). Every message goes through this single
function, so later it can be replaced by a Redis counter without touching
the WebSocket code.
"""


async def check_rate_limit(identity: dict) -> bool:
    """Return True if the sender may post. Always True for now."""
    return True
