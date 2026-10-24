"""
Firebase integration (future).

The application currently authenticates against the local SQLite ``users``
table.  As soon as a Firebase project is created, set the environment
variables below and flip ``FIREBASE_ENABLED=1`` – the rest of the code base
does not need to change because every call site goes through this module.

    FIREBASE_ENABLED=1
    FIREBASE_PROJECT_ID=your-project-id
    FIREBASE_CREDENTIALS_FILE=./data/firebase-credentials.json

The Firebase Admin SDK is an *optional* dependency.  It is only imported when
Firebase is actually enabled, so the project still runs with a plain
``pip install -r requirements.txt`` today.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import config

logger = logging.getLogger("doctor_app.firebase")

_app: Any = None
_auth: Any = None


def is_enabled() -> bool:
    return bool(config.FIREBASE_ENABLED)


def _ensure_app() -> Any:
    """Lazily create the Firebase Admin app."""
    global _app, _auth
    if _app is not None:
        return _app

    try:
        import firebase_admin  # type: ignore
        from firebase_admin import credentials  # type: ignore
    except ImportError:  # pragma: no cover - optional dependency
        logger.warning(
            "firebase_admin is not installed - install it with "
            "`pip install firebase-admin` to enable Firebase."
        )
        return None

    options: dict[str, Any] = {}
    if config.FIREBASE_PROJECT_ID:
        options["projectId"] = config.FIREBASE_PROJECT_ID
    if config.FIREBASE_DATABASE_URL:
        options["databaseURL"] = config.FIREBASE_DATABASE_URL

    try:
        if config.FIREBASE_CREDENTIALS_FILE:
            cred = credentials.Certificate(config.FIREBASE_CREDENTIALS_FILE)
            _app = firebase_admin.initialize_app(cred, options or None)
        else:
            _app = firebase_admin.initialize_app(options or None)
    except Exception as exc:  # pragma: no cover
        logger.error("Firebase initialisation failed: %s", exc)
        return None

    _auth = firebase_admin.auth
    return _app


def verify_id_token(id_token: str) -> Optional[dict[str, Any]]:
    """Verify a Firebase ID token and return its decoded claims."""
    if not is_enabled():
        return None
    app = _ensure_app()
    if app is None:
        return None
    try:
        return _auth.verify_id_token(id_token)
    except Exception as exc:  # pragma: no cover
        logger.warning("Firebase token verification failed: %s", exc)
        return None


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    if not is_enabled():
        return None
    app = _ensure_app()
    if app is None:
        return None
    try:
        return _auth.get_user_by_email(email)
    except Exception:  # pragma: no cover
        return None


def get_user(uid: str) -> Optional[dict[str, Any]]:
    if not is_enabled():
        return None
    app = _ensure_app()
    if app is None:
        return None
    try:
        return _auth.get_user(uid)
    except Exception:  # pragma: no cover
        return None


def create_user(email: str, password: str, display_name: str = "") -> Optional[dict[str, Any]]:
    if not is_enabled():
        return None
    app = _ensure_app()
    if app is None:
        return None
    try:
        return _auth.create_user(email=email, password=password, display_name=display_name)
    except Exception as exc:  # pragma: no cover
        logger.error("Firebase user creation failed: %s", exc)
        return None


def delete_user(uid: str) -> bool:
    if not is_enabled():
        return False
    app = _ensure_app()
    if app is None:
        return False
    try:
        _auth.delete_user(uid)
        return True
    except Exception:  # pragma: no cover
        return False
