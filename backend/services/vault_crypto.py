"""
Vault encryption for the Resources page.

Stored credentials (usernames / passwords of hosting, databases, ad
accounts …) are AES-encrypted at rest with Fernet so the SQLite file can
travel with git WITHOUT leaking secrets into the (public) repository.

The key lives in ``backend/vault_key.key`` and is auto-generated on first
use. That file is git-ignored – the encrypted rows without the key are
unreadable, which is exactly the point. When deploying to PythonAnywhere,
copy the key file once:

    backend/vault_key.key  ->  ~/Doctor-App-v2.0/backend/vault_key.key

Loss of the key means the stored passwords cannot be recovered (usernames
and comments remain readable), so keep a private copy of the key safe.
"""

from __future__ import annotations

import logging
import secrets
from pathlib import Path

import config

logger = logging.getLogger("doctor_app.vault")

KEY_FILE = Path(config.BACKEND_DIR) / "vault_key.key"
_PREFIX = "gcm:"  # marks encrypted payloads; anything else stays plain

_fernet = None
_load_error: str | None = None


def _load_fernet():
    """Import the optional dependency lazily and cache the cipher."""
    global _fernet, _load_error
    if _load_error:
        return None
    if _fernet is not None:
        return _fernet
    if not KEY_FILE.is_file():
        try:
            try:
                from cryptography.fernet import Fernet

                key = Fernet.generate_key().decode("ascii")
            except ImportError:
                # cryptography not installed yet – make a best-effort key that
                # Fernet *would* accept once the package is present. Operators
                # are expected to install requirements.txt.
                import base64

                raw = secrets.token_bytes(32)
                key = base64.urlsafe_b64encode(raw).decode("ascii")
            KEY_FILE.write_text(key + "\n", encoding="utf-8")
            logger.info("Vault key generated at %s", KEY_FILE)
        except OSError as exc:
            _load_error = str(exc)
            logger.error("Vault key generation failed: %s", exc)
            return None
    try:
        from cryptography.fernet import Fernet

        _fernet = Fernet(KEY_FILE.read_text(encoding="utf-8").strip())
        return _fernet
    except ImportError:
        _load_error = "cryptography package not installed"
        logger.error("Vault encryption disabled: %s", _load_error)
        return None
    except Exception as exc:  # pragma: no cover - corrupt key file
        _load_error = str(exc)
        logger.error("Vault key unreadable: %s", exc)
        return None


def available() -> bool:
    return _load_fernet() is not None


def encrypt(text: str | None) -> str:
    """Store ``text`` encrypted; empty input stays empty."""
    if not text:
        return ""
    cipher = _load_fernet()
    if cipher is None:
        raise RuntimeError(_load_error or "vault encryption unavailable")
    return _PREFIX + cipher.encrypt(text.encode("utf-8")).decode("ascii")


def decrypt(stored: str | None) -> str | None:
    """Return the plaintext or None when it cannot be decrypted."""
    if not stored:
        return None
    if not stored.startswith(_PREFIX):
        return stored  # legacy plain rows
    cipher = _load_fernet()
    if cipher is None:
        return None
    try:
        return cipher.decrypt(stored[len(_PREFIX):].encode("ascii")).decode("utf-8")
    except Exception:  # pragma: no cover - wrong/missing key
        logger.error("Vault decrypt failed (key mismatch?)")
        return None
