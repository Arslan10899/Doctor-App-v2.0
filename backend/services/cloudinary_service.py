"""
Cloudinary integration (future).

Doctor avatars and clinic photos are currently stored on the local disk
(``backend/uploads``).  Switch to Cloudinary by setting:

    CLOUDINARY_ENABLED=1
    CLOUDINARY_CLOUD_NAME=your-cloud
    CLOUDINARY_API_KEY=...
    CLOUDINARY_API_SECRET=...

and installing the optional dependency::

    pip install cloudinary

Both code paths return the exact same payload (``url``, ``public_id``), so the
frontend never has to know where the file lives.
"""

from __future__ import annotations

import logging
import os
import secrets
import uuid
from typing import Any, Optional

import config
from services import r2_storage

logger = logging.getLogger("doctor_app.cloudinary")


def is_enabled() -> bool:
    return bool(config.CLOUDINARY_ENABLED)


def _ensure_configured() -> bool:
    return bool(
        config.CLOUDINARY_ENABLED
        and config.CLOUDINARY_CLOUD_NAME
        and config.CLOUDINARY_API_KEY
        and config.CLOUDINARY_API_SECRET
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def upload_image(file_bytes: bytes, filename: str, folder: str = "avatars") -> dict[str, Any]:
    """
    Upload an image and return ``{"url": str, "public_id": str|None, "provider": str}``.

    Falls back to the local disk when Cloudinary is not configured.
    """
    if _ensure_configured():
        try:
            return _upload_to_cloudinary(file_bytes, filename, folder)
        except Exception as exc:  # pragma: no cover
            logger.error("Cloudinary upload failed, falling back to local disk: %s", exc)
    return _upload_to_local_disk(file_bytes, filename, folder)


def delete_image(public_id: Optional[str], url: Optional[str] = None) -> bool:
    if not public_id or not _ensure_configured():
        return False
    try:
        import cloudinary  # type: ignore
        import cloudinary.uploader  # type: ignore

        cloudinary.config(
            cloud_name=config.CLOUDINARY_CLOUD_NAME,
            api_key=config.CLOUDINARY_API_KEY,
            api_secret=config.CLOUDINARY_API_SECRET,
        )
        cloudinary.uploader.destroy(public_id)
        return True
    except Exception as exc:  # pragma: no cover
        logger.error("Cloudinary delete failed: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------
def upload_media(
    file_bytes: bytes,
    filename: str,
    folder: str = "doctors",
    kind: str = "image",
) -> dict[str, Any]:
    """
    Upload gallery media (image or video). Same payload shape as upload_image.

    Videos prefer Cloudflare R2 (free storage + free egress – app users can
    stream without cost) when R2 is configured; otherwise Cloudinary, then
    local disk as the last fallback. Any later provider switch stays
    row-level compatible: `provider` + `url` (+ `public_id` = object key).
    """
    resource_type = "video" if kind == "video" else "image"

    if resource_type == "video" and r2_storage.enabled():
        try:
            extension = os.path.splitext(filename)[1].lower()
            if extension not in VIDEO_EXTS:
                extension = ".mp4"
            key = f"{folder}/{uuid.uuid4().hex}{extension}"
            return {
                "url": r2_storage.upload_object(key, file_bytes),
                "public_id": key,
                "provider": "r2",
                "secret": secrets.token_hex(8),
            }
        except Exception as exc:  # pragma: no cover
            logger.error("R2 video upload failed, falling back to next provider: %s", exc)

    if _ensure_configured():
        try:
            return _upload_to_cloudinary(file_bytes, filename, folder, resource_type)
        except Exception as exc:  # pragma: no cover
            logger.error("Cloudinary %s upload failed, falling back to local disk: %s", resource_type, exc)
    return _store_local_media(file_bytes, filename, folder, kind)


# extra video extensions allowed alongside the image set
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".3gp"}


def _store_local_media(
    file_bytes: bytes,
    filename: str,
    folder: str,
    kind: str,
) -> dict[str, Any]:
    target_dir = os.path.join(config.UPLOAD_DIR, folder)
    os.makedirs(target_dir, exist_ok=True)

    extension = os.path.splitext(filename)[1].lower() or (".mp4" if kind == "video" else ".png")
    allowed = VIDEO_EXTS if kind == "video" else {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
    if extension not in allowed:
        extension = ".mp4" if kind == "video" else ".png"

    stored_name = f"{uuid.uuid4().hex}{extension}"
    absolute_path = os.path.join(target_dir, stored_name)

    with open(absolute_path, "wb") as fh:
        fh.write(file_bytes)

    return {
        "url": f"/uploads/{folder}/{stored_name}",
        "public_id": None,
        "provider": "local",
        "secret": secrets.token_hex(8),
    }


def _upload_to_cloudinary(
    file_bytes: bytes,
    filename: str,
    folder: str,
    resource_type: str = "image",
) -> dict[str, Any]:
    import cloudinary  # type: ignore
    import cloudinary.uploader  # type: ignore

    cloudinary.config(
        cloud_name=config.CLOUDINARY_CLOUD_NAME,
        api_key=config.CLOUDINARY_API_KEY,
        api_secret=config.CLOUDINARY_API_SECRET,
        secure=True,
    )

    result = cloudinary.uploader.upload(
        file_bytes,
        folder=f"{config.CLOUDINARY_FOLDER}/{folder}",
        resource_type=resource_type,
        overwrite=True,
        public_id=f"{folder}/{uuid.uuid4().hex}",
    )
    return {
        "url": result["secure_url"],
        "public_id": result.get("public_id"),
        "provider": "cloudinary",
        "width": result.get("width"),
        "height": result.get("height"),
    }


def _upload_to_local_disk(file_bytes: bytes, filename: str, folder: str) -> dict[str, Any]:
    target_dir = os.path.join(config.UPLOAD_DIR, folder)
    os.makedirs(target_dir, exist_ok=True)

    extension = os.path.splitext(filename)[1].lower() or ".png"
    if extension not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}:
        extension = ".png"

    stored_name = f"{uuid.uuid4().hex}{extension}"
    absolute_path = os.path.join(target_dir, stored_name)

    with open(absolute_path, "wb") as fh:
        fh.write(file_bytes)

    return {
        "url": f"/uploads/{folder}/{stored_name}",
        "public_id": None,
        "provider": "local",
        "secret": secrets.token_hex(8),
    }
