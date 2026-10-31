"""
Central configuration for the Doctor Application backend.

Every value can be overridden with an environment variable so that the same
code base works for local development (SQLite) and for the future
Firebase / Cloudinary production setup.
"""

import json
import os

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
APP_NAME = "Doctor Application"
APP_VERSION = "1.0.0"
APP_SLUG = "doctor-application"

DB_PATH = os.environ.get("DOCTOR_APP_DB", os.path.join(DATA_DIR, "doctor_app.db"))

# Comma separated list of origins allowed to call the API.
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "DOCTOR_APP_CORS",
        "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5500,http://127.0.0.1:5500",
    ).split(",")
    if o.strip()
]

# Secret used to sign the session token issued by /api/auth/login.
# Replace with a strong value (or a Firebase Admin SDK token issuer) in prod.
SECRET_KEY = os.environ.get("DOCTOR_APP_SECRET", "doctor-app-dev-secret-change-me")
TOKEN_TTL_HOURS = int(os.environ.get("DOCTOR_APP_TOKEN_TTL", "12"))

# ---------------------------------------------------------------------------
# Firebase (optional – enabled once the SDK keys are provided)
# ---------------------------------------------------------------------------
FIREBASE_ENABLED = os.environ.get("FIREBASE_ENABLED", "0") == "1"
FIREBASE_CREDENTIALS_FILE = os.environ.get(
    "FIREBASE_CREDENTIALS_FILE", os.path.join(DATA_DIR, "firebase-credentials.json")
)
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "")
FIREBASE_DATABASE_URL = os.environ.get("FIREBASE_DATABASE_URL", "")

# ---------------------------------------------------------------------------
# Cloudinary (optional – enabled once the cloud name / api key are provided)
# ---------------------------------------------------------------------------
CLOUDINARY_ENABLED = os.environ.get("CLOUDINARY_ENABLED", "0") == "1"
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")
CLOUDINARY_FOLDER = os.environ.get("CLOUDINARY_FOLDER", "doctor-application")

# storage_settings.json fallback (same file as R2) for Cloudinary keys
_storage_settings_file = os.path.join(BACKEND_DIR, "storage_settings.json")
try:
    if os.path.isfile(_storage_settings_file):
        with open(_storage_settings_file, "r", encoding="utf-8") as _fh:
            _cs = (json.load(_fh) or {}).get("cloudinary", {})
        if _cs:
            CLOUDINARY_ENABLED = bool(_cs.get("enabled", CLOUDINARY_ENABLED))
            CLOUDINARY_CLOUD_NAME = str(_cs.get("cloud_name", CLOUDINARY_CLOUD_NAME) or CLOUDINARY_CLOUD_NAME)
            CLOUDINARY_API_KEY = str(_cs.get("api_key", CLOUDINARY_API_KEY) or CLOUDINARY_API_KEY)
            CLOUDINARY_API_SECRET = str(_cs.get("api_secret", CLOUDINARY_API_SECRET) or CLOUDINARY_API_SECRET)
            CLOUDINARY_FOLDER = str(_cs.get("folder", CLOUDINARY_FOLDER) or CLOUDINARY_FOLDER)
except (OSError, ValueError) as _exc:
    print(f"[config] storage_settings.json (cloudinary) ignored: {_exc}")

# ---------------------------------------------------------------------------
# Cloudflare R2 object storage (videos are stored here – free egress).
# Env vars win, `backend/storage_settings.json` is the file-based fallback
# (handy on PythonAnywhere where there is no env-var UI; file is git-ignored).
# ---------------------------------------------------------------------------
R2_ENABLED = os.environ.get("DOCTOR_APP_R2", "0") == "1"
R2_ACCOUNT_ID = os.environ.get("DOCTOR_APP_R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.environ.get("DOCTOR_APP_R2_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("DOCTOR_APP_R2_SECRET", "")
R2_BUCKET = os.environ.get("DOCTOR_APP_R2_BUCKET", "drapp-media")
R2_PUBLIC_BASE = os.environ.get("DOCTOR_APP_R2_PUBLIC_BASE", "")

_storage_settings_file = os.path.join(BACKEND_DIR, "storage_settings.json")
try:
    if os.path.isfile(_storage_settings_file):
        with open(_storage_settings_file, "r", encoding="utf-8") as _fh:
            _r2 = (json.load(_fh) or {}).get("r2", {})
        R2_ENABLED = bool(_r2.get("enabled", R2_ENABLED))
        R2_ACCOUNT_ID = str(_r2.get("account_id", R2_ACCOUNT_ID) or R2_ACCOUNT_ID)
        R2_ACCESS_KEY_ID = str(_r2.get("key_id", R2_ACCESS_KEY_ID) or R2_ACCESS_KEY_ID)
        R2_SECRET_ACCESS_KEY = str(_r2.get("secret", R2_SECRET_ACCESS_KEY) or R2_SECRET_ACCESS_KEY)
        R2_BUCKET = str(_r2.get("bucket", R2_BUCKET) or R2_BUCKET)
        R2_PUBLIC_BASE = str(_r2.get("public_base", R2_PUBLIC_BASE) or R2_PUBLIC_BASE)
        del _r2
except (OSError, ValueError) as _exc:  # never let a bad settings file break boot
    print(f"[config] storage_settings.json ignored: {_exc}")

# Default avatar used when a doctor has no uploaded picture.
DEFAULT_AVATAR = "/assets/avatar-placeholder.svg"
