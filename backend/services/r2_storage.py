"""
Cloudflare R2 object storage (S3-compatible API).

Videos (and any other large media) are stored in an R2 bucket because the
free tier has no egress charges – app users can stream without cost.

Activation (either way works):
    1. Environment variables:
       DOCTOR_APP_R2=1
       DOCTOR_APP_R2_ACCOUNT_ID=...      Cloudflare dash → R2 → account id
       DOCTOR_APP_R2_KEY_ID=...          R2 API token access key id
       DOCTOR_APP_R2_SECRET=...          R2 API token secret
       DOCTOR_APP_R2_BUCKET=drapp-media
       DOCTOR_APP_R2_PUBLIC_BASE=https://pub-xxxxxxxx.r2.dev
    2. backend/storage_settings.json (git-ignored file, perfect for
       PythonAnywhere where there is no env var UI):
       {
         "r2": {
           "enabled": true,
           "account_id": "...",
           "key_id": "...",
           "secret": "...",
           "bucket": "drapp-media",
           "public_base": "https://pub-xxxxxxxx.r2.dev"
         }
       }

Keys are stored in `doctor_media.provider = 'r2'` and
`doctor_media.url = <public_base>/<key>` so any later provider switch stays
row-level compatible.
"""

from __future__ import annotations

import logging
from typing import Optional

import config

logger = logging.getLogger("doctor_app.r2")


def enabled() -> bool:
    return bool(
        config.R2_ENABLED
        and config.R2_ACCOUNT_ID
        and config.R2_ACCESS_KEY_ID
        and config.R2_SECRET_ACCESS_KEY
        and config.R2_BUCKET
        and config.R2_PUBLIC_BASE
    )


def _client():
    import boto3  # optional dependency (requirements.txt)

    return boto3.client(
        "s3",
        endpoint_url=f"https://{config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=config.R2_ACCESS_KEY_ID,
        aws_secret_access_key=config.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def public_url(key: str) -> str:
    base = (config.R2_PUBLIC_BASE or "").rstrip("/")
    return f"{base}/{key.lstrip('/')}"


def upload_object(key: str, data: bytes) -> str:
    """Put the object and return its public URL. Raises on failure so the
    caller can fall back to the next provider."""
    response = _client().put_object(Bucket=config.R2_BUCKET, Key=key, Body=data)
    status = int(((response or {}).get("ResponseMetadata") or {}).get("HTTPStatusCode") or 0)
    if status != 200:
        raise RuntimeError(f"R2 put_object returned HTTP {status}")
    return public_url(key)


def delete_object(key: str) -> bool:
    try:
        _client().delete_object(Bucket=config.R2_BUCKET, Key=key)
        return True
    except Exception as exc:  # pragma: no cover - network errors are logged
        logger.error("R2 delete failed for %s: %s", key, exc)
        return False


def key_from_public_url(url: str) -> Optional[str]:
    """Extract the object key stored behind a R2 public URL."""
    base = (config.R2_PUBLIC_BASE or "").rstrip("/")
    if not url or not base or not url.startswith(base + "/"):
        return None
    return url[len(base) + 1:].lstrip("/")
