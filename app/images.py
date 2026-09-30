"""Image upload validation and GridFS storage.

Images go to GridFS (fs.files + fs.chunks) rather than into message documents:
a document is capped at 16 MB and big binary blobs would slow down every
message query. Messages only keep the file's ObjectId (a reference).
"""
import io

from bson import ObjectId
from gridfs import AsyncGridFSBucket
from PIL import Image, UnidentifiedImageError

from app.db import get_db

MAX_BYTES = 5 * 1024 * 1024
ALLOWED = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


class ImageError(ValueError):
    pass


def validate_and_reencode(data: bytes) -> tuple[bytes, str]:
    """Check size and real format (not just the file name), then re-encode.
    Re-encoding drops EXIF metadata such as GPS location and camera info."""
    if len(data) > MAX_BYTES:
        raise ImageError("Image is larger than 5 MB")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            probe.verify()  # detects truncated / fake files
        img = Image.open(io.BytesIO(data))
        fmt = img.format
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise ImageError("Not a valid image")
    if fmt not in ALLOWED:
        raise ImageError("Only JPEG, PNG and WebP are allowed")

    img.load()
    if fmt == "JPEG" and img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    out = io.BytesIO()
    # a fresh save without exif= writes no EXIF block
    options = {} if fmt == "PNG" else {"quality": 90}
    img.save(out, format=fmt, **options)
    return out.getvalue(), ALLOWED[fmt]


def bucket() -> AsyncGridFSBucket:
    return AsyncGridFSBucket(get_db())


async def store_image(data: bytes, content_type: str, user_id: str, filename: str) -> ObjectId:
    # metadata.user_id lets the stats pipeline count uploads per user
    return await bucket().upload_from_stream(
        filename or "image",
        data,
        metadata={"user_id": ObjectId(user_id), "content_type": content_type},
    )


async def image_owned_by(file_id: ObjectId, user_id: str) -> bool:
    doc = await get_db()["fs.files"].find_one({"_id": file_id, "metadata.user_id": ObjectId(user_id)})
    return doc is not None


async def open_image(file_id: ObjectId):
    """Returns a GridOut stream (raises gridfs.errors.NoFile if missing)."""
    return await bucket().open_download_stream(file_id)
