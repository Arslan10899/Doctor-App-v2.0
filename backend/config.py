"""
Central configuration for the Doctor Application backend.

Every value can be overridden with an environment variable so that the same
code base works for local development (SQLite) and for the future
Firebase / Cloudinary production setup.
"""

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

# Default avatar used when a doctor has no uploaded picture.
DEFAULT_AVATAR = "/assets/avatar-placeholder.svg"
