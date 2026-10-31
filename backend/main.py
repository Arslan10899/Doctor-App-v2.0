"""
Doctor Application – FastAPI backend
====================================

Serves the JSON API used by the HTML/CSS/JS front end and also serves the
static front end from ``/frontend``.

Run it with::

    python run.py
    # or
    uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from typing import Any, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config  # noqa: E402
import database as db  # noqa: E402
import schemas  # noqa: E402
from services import cloudinary_service, firebase_service  # noqa: E402


@asynccontextmanager
async def lifespan(app: "FastAPI"):
    """Startup / shutdown hook (lifespan API – works on Starlette >= 1.0 too,
    where the old on_event() decorator was removed)."""
    db.init_db()
    _autoseed_from_backup()
    _relink_hospital_media()
    yield


app = FastAPI(
    title=f"{config.APP_NAME} API",
    version=config.APP_VERSION,
    description="REST API for the Doctor Application admin dashboard.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compress HTML / JS / CSS / API responses >= 1 KB (large win on hosted plans,
# where the browser download path is the slow part).
from starlette.middleware.gzip import GZipMiddleware  # noqa: E402

app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.middleware("http")
async def cache_control_frontend(request: Request, call_next):
    """Smart caching for hosted deploys (PythonAnywhere / Render):

    - css/js/assets/uploads are version-busted or uniquely named, so the
      browser can cache them for a year (huge speed-up on repeat visits).
    - HTML pages revalidate (ETag -> cheap 304 instead of re-download).
    - API responses are untouched.
    """
    path = request.url.path.lower()
    if request.method in {"GET", "HEAD"} and not path.startswith("/api/") and not path.startswith("/docs") and not path.startswith("/openapi"):
        long_cache = path.startswith(
            ("/css/", "/js/", "/assets/", "/uploads/")
        )
        response = await call_next(request)
        if long_cache:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path.endswith(".html") or path in ("/", ""):
            response.headers["Cache-Control"] = "no-cache"
        return response

    return await call_next(request)


# ---------------------------------------------------------------------------
# Life cycle
# ---------------------------------------------------------------------------
def _relink_hospital_media() -> None:
    """After the backup import, `hospital_media` (hospital card cover /
    profile images) is still empty: those files are committed to git under
    backend/uploads/hospitals and only the media links need re-creating.
    Runs once, the first time the table is empty.  Convert to a no-op with
    DOCTOR_APP_AUTOSEED=0."""
    if os.environ.get("DOCTOR_APP_AUTOSEED", "1") != "1":
        return
    try:
        from hospital_media_seed import apply_if_empty

        linked = apply_if_empty()
        if linked:
            print(f"[startup] linked {linked} hospital card images from backend/uploads")
    except Exception as exc:  # never let a failed seed break the server
        print(f"[startup] hospital media link skipped: {exc}")


def _autoseed_from_backup() -> None:
    """Manual-use only: the backup file is no longer a live data source.

    All data now lives in the SQLite database. The bundled
    firestore_backup.json is archived and is NOT read at startup. It can
    only be imported explicitly (e.g. a brand-new empty deployment that
    really needs it) by setting the env var DOCTOR_APP_IMPORT_BACKUP=1.
    """
    if os.environ.get("DOCTOR_APP_IMPORT_BACKUP", "0") != "1":
        return
    try:
        seeded = db.query_one("SELECT COUNT(*) AS c FROM doctors")["c"] > 0
        if seeded:
            return
        from import_only_from_backup import BACKUP_PATH, main as import_backup

        if not os.path.isfile(BACKUP_PATH):
            return
        print("[startup] DOCTOR_APP_IMPORT_BACKUP=1 – importing from " + BACKUP_PATH)
        import_backup()
    except Exception as exc:  # never let a failed seed break the server
        print(f"[startup] auto-seed skipped: {exc}")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def _hash_password(password: str) -> str:
    return hashlib.sha256(f"doctor-app::{password}".encode()).hexdigest()


def _sign(payload: str) -> str:
    """Very small HMAC signature so the local token cannot be forged easily."""
    return hmac.new(config.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: int) -> str:
    body = f"{user_id}.{int((datetime.now() + timedelta(hours=config.TOKEN_TTL_HOURS)).timestamp())}.{secrets.token_hex(8)}"
    return f"{body}.{_sign(body)}"


def current_user(request: Request) -> dict[str, Any]:
    """
    Resolve the signed-in user.

    * When Firebase is enabled a ``Bearer <firebase-id-token>`` header is verified.
    * Otherwise the local ``Authorization: Bearer <token>`` token is validated.
    * Every request must be authenticated – the API never falls back to a
      implicit account, so unauthenticated clients receive 401.
    """
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""

    if token:
        claims = firebase_service.verify_id_token(token)
        if claims:
            user = db.query_one("SELECT * FROM users WHERE uid = ?", (claims.get("uid"),))
            if user:
                return user
            return {
                "id": 0,
                "uid": claims.get("uid"),
                "name": claims.get("name") or claims.get("email"),
                "email": claims.get("email"),
                "role": "admin",
            }

        parts = token.split(".")
        if len(parts) == 4:
            body = ".".join(parts[:3])
            if hmac.compare_digest(_sign(body), parts[3]):
                try:
                    expires_at = float(parts[1])
                except ValueError:
                    expires_at = 0
                if expires_at >= datetime.now().timestamp():
                    user = db.query_one("SELECT * FROM users WHERE id = ?", (parts[0],))
                    if user:
                        return user

    raise HTTPException(status_code=401, detail="Not authenticated")


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "app": config.APP_NAME,
        "version": config.APP_VERSION,
        "database": os.path.basename(config.DB_PATH),
        "firebase": "enabled" if firebase_service.is_enabled() else "disabled",
        "cloudinary": "enabled" if cloudinary_service.is_enabled() else "disabled",
    }


@app.get("/api/config")
def public_config() -> dict[str, Any]:
    return {
        "app_name": config.APP_NAME,
        "version": config.APP_VERSION,
        "default_avatar": config.DEFAULT_AVATAR,
        "providers": {
            "firebase": firebase_service.is_enabled(),
            "cloudinary": cloudinary_service.is_enabled(),
        },
    }


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@app.post("/api/auth/login", response_model=schemas.LoginResponse)
def login(payload: schemas.LoginRequest) -> schemas.LoginResponse:
    email = payload.email.strip().lower()
    user = db.query_one("SELECT * FROM users WHERE email = ?", (email,))

    if user and user.get("password_hash"):
        if not hmac.compare_digest(user["password_hash"], _hash_password(payload.password)):
            raise HTTPException(status_code=401, detail="Invalid email or password")
    elif user is None:
        # Firebase-backed accounts sign in through the Firebase SDK on the client.
        fb_user = firebase_service.get_user_by_email(email)
        if fb_user:
            user = {
                "id": 0,
                "uid": fb_user.get("uid"),
                "name": fb_user.get("display_name") or email,
                "email": email,
                "role": "admin",
            }
        else:
            raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(user["id"])
    return schemas.LoginResponse(
        token=token,
        expires_in=config.TOKEN_TTL_HOURS * 3600,
        user={
            "id": user["id"],
            "uid": user.get("uid"),
            "name": user["name"],
            "email": user["email"],
            "role": user.get("role", "admin"),
            "avatar_url": user.get("avatar_url"),
        },
    )


@app.get("/api/auth/me")
def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return _serialize_user(user)


def _serialize_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user.get("id"),
        "uid": user.get("uid"),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role", "admin"),
        "avatar_url": user.get("avatar_url"),
        "created_at": user.get("created_at"),
    }


@app.put("/api/auth/me")
def update_me(
    payload: schemas.ProfileUpdate,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Update the signed-in user's own profile details."""
    if not user.get("id"):
        raise HTTPException(status_code=403, detail="Remote accounts cannot be edited here")

    name = payload.name.strip()
    email = payload.email.strip().lower()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Name must be at least 2 characters")
    if not email or email.count("@") != 1 or "." not in email.split("@")[1]:
        raise HTTPException(status_code=422, detail="Please enter a valid email address")

    clash = db.query_one(
        "SELECT id FROM users WHERE lower(email) = ? AND id <> ?", (email, user["id"])
    )
    if clash:
        raise HTTPException(status_code=409, detail="That email is already in use")

    sets, params = ["name = ?", "email = ?"], [name, email]
    if "avatar_url" in payload.model_fields_set:
        sets.append("avatar_url = ?")
        params.append((payload.avatar_url or "").strip() or None)

    db.execute(
        f"UPDATE users SET {', '.join(sets)} WHERE id = ?", (*params, user["id"])
    )
    return _serialize_user(db.query_one("SELECT * FROM users WHERE id = ?", (user["id"],)))


@app.post("/api/auth/change-password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Change the signed-in user's password (current password required)."""
    if not user.get("id"):
        raise HTTPException(status_code=403, detail="Remote accounts cannot be edited here")

    row = db.query_one("SELECT password_hash FROM users WHERE id = ?", (user["id"],))
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if not row.get("password_hash") or not hmac.compare_digest(
        row["password_hash"], _hash_password(payload.current_password)
    ):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    db.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (_hash_password(payload.new_password), user["id"]),
    )
    return {"message": "Password updated"}


@app.post("/api/auth/avatar")
async def update_my_avatar(
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Upload a profile picture for the signed-in user."""
    if not user.get("id"):
        raise HTTPException(status_code=403, detail="Remote accounts cannot be edited here")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is larger than 5 MB")

    result = cloudinary_service.upload_image(content, file.filename or "avatar.png", "avatars")
    db.execute(
        "UPDATE users SET avatar_url = ? WHERE id = ?", (result["url"], user["id"])
    )
    return {"url": result["url"], "provider": result["provider"]}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@app.get("/api/dashboard/stats")
def dashboard_stats(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    today = date.today().isoformat()
    month_start = date.today().replace(day=1).isoformat()

    def scalar(sql: str, params: tuple = ()) -> float:
        row = db.query_one(sql, params)
        return float(row["v"]) if row and row["v"] is not None else 0.0

    total_doctors = int(scalar("SELECT COUNT(*) v FROM doctors"))
    active_doctors = int(scalar("SELECT COUNT(*) v FROM doctors WHERE status = 'Active'"))
    total_patients = int(scalar("SELECT COUNT(*) v FROM patients"))
    total_appointments = int(scalar("SELECT COUNT(*) v FROM appointments"))
    today_appointments = int(scalar("SELECT COUNT(*) v FROM appointments WHERE appointment_date = ?", (today,)))
    completed = int(scalar("SELECT COUNT(*) v FROM appointments WHERE status = 'Completed'"))
    pending = int(scalar("SELECT COUNT(*) v FROM appointments WHERE status = 'Pending'"))
    cancelled = int(scalar("SELECT COUNT(*) v FROM appointments WHERE status = 'Cancelled'"))
    scheduled = int(scalar("SELECT COUNT(*) v FROM appointments WHERE status = 'Scheduled'"))
    revenue = scalar("SELECT SUM(amount) v FROM payments WHERE status = 'Paid'")
    new_doctors = int(scalar("SELECT COUNT(*) v FROM doctors WHERE created_at >= ?", (month_start,)))
    avg_rating = scalar("SELECT AVG(rating) v FROM doctors")
    total_hospitals = int(scalar("SELECT COUNT(*) v FROM hospitals"))
    total_cities = int(scalar("SELECT COUNT(*) v FROM cities"))
    total_duty_slots = int(scalar("SELECT COUNT(*) v FROM hospital_schedules"))
    total_app_users = int(scalar("SELECT COUNT(*) v FROM app_users"))
    registered_app_users = int(scalar("SELECT COUNT(*) v FROM app_users WHERE is_registered = 1"))
    total_notifications = int(scalar("SELECT COUNT(*) v FROM notifications"))
    total_my_ads = int(scalar("SELECT COUNT(*) v FROM my_ads"))
    active_my_ads = int(scalar("SELECT COUNT(*) v FROM my_ads WHERE active = 1"))
    total_backup_promos = int(scalar("SELECT COUNT(*) v FROM backup_promos"))

    top = db.query_one(
        """
        SELECT d.specialty, COUNT(a.id) AS total
        FROM doctors d
        LEFT JOIN appointments a ON a.doctor_id = d.id
        GROUP BY d.specialty
        ORDER BY total DESC, d.specialty ASC
        LIMIT 1
        """
    )

    # how much disk the app is using right now
    def file_bytes(path: str) -> int:
        try:
            return os.path.getsize(path)
        except OSError:
            return 0

    def dir_usage(path: str) -> tuple[int, int]:
        total = 0
        count = 0
        for root, _dirs, names in os.walk(path):
            for name in names:
                total += file_bytes(os.path.join(root, name))
                count += 1
        return total, count

    db_base = file_bytes(config.DB_PATH)
    db_wal = file_bytes(config.DB_PATH + "-wal") + file_bytes(config.DB_PATH + "-shm")
    uploads_bytes, uploads_files = dir_usage(config.UPLOAD_DIR)

    def table_usage(table: str) -> int:
        """Rough on-disk size of one table (payload + per-row overhead).

        The shipped SQLite build has no dbstat virtual table, so this is
        an estimate: sum of all column bytes + 10 B/cell header + 18 %
        padding for free pages and index entries."""
        cols = [r["name"] for r in db.query_all(f'PRAGMA table_info("{table}")')]
        if not cols:
            return 0
        payload_expr = " + ".join(f'IFNULL(length(CAST("{c}" AS BLOB)), 0)' for c in cols)
        payload = int(scalar(f'SELECT COALESCE(SUM({payload_expr}), 0) v FROM "{table}"'))
        row_count = int(scalar(f'SELECT COUNT(*) v FROM "{table}"'))
        return int(payload * 1.18) + row_count * 10

    tables_usage = {
        name: table_usage(name)
        for name in (
            "doctors",
            "hospitals",
            "hospital_schedules",
            "app_users",
            "notifications",
            "my_ads",
            "backup_promos",
        )
    }

    storage = {
        "db_file": os.path.basename(config.DB_PATH),
        "db_bytes": db_base + db_wal,
        "db_base_bytes": db_base,
        "db_wal_bytes": db_wal,
        "uploads_bytes": uploads_bytes,
        "uploads_files": uploads_files,
        "total_bytes": db_base + db_wal + uploads_bytes,
        "tables": tables_usage,
    }

    return {
        "total_doctors": total_doctors,
        "active_doctors": active_doctors,
        "total_patients": total_patients,
        "total_appointments": total_appointments,
        "today_appointments": today_appointments,
        "completed_appointments": completed,
        "pending_appointments": pending,
        "scheduled_appointments": scheduled,
        "cancelled_appointments": cancelled,
        "total_revenue": round(revenue, 2),
        "new_doctors_this_month": new_doctors,
        "avg_rating": round(avg_rating, 2),
        "top_specialty": top["specialty"] if top else None,
        # Directory / mobile app data imported from the local backup
        "total_hospitals": total_hospitals,
        "total_cities": total_cities,
        "total_duty_slots": total_duty_slots,
        "total_app_users": total_app_users,
        "registered_app_users": registered_app_users,
        "total_notifications": total_notifications,
        "total_my_ads": total_my_ads,
        "active_my_ads": active_my_ads,
        "total_backup_promos": total_backup_promos,
        "storage": storage,
    }


@app.get("/api/dashboard/charts/appointments")
def chart_appointments(
    months: int = Query(default=12, ge=1, le=24),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    """Appointments per month for the last N months."""
    today = date.today().replace(day=1)
    buckets: list[tuple[str, str]] = []
    for i in range(months - 1, -1, -1):
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        buckets.append((f"{year:04d}-{month:02d}", datetime(year, month, 1).strftime("%b")))

    result = []
    for key, label in buckets:
        row = db.query_one(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) AS scheduled,
                SUM(CASE WHEN status = 'Pending'   THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
            FROM appointments
            WHERE substr(appointment_date, 1, 7) = ?
            """,
            (key,),
        )
        result.append(
            {
                "month": label,
                "key": key,
                "total": int(row["total"] or 0),
                "completed": int(row["completed"] or 0),
                "scheduled": int(row["scheduled"] or 0),
                "pending": int(row["pending"] or 0),
                "cancelled": int(row["cancelled"] or 0),
            }
        )
    return result


@app.get("/api/dashboard/charts/revenue")
def chart_revenue(
    months: int = Query(default=12, ge=1, le=24),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    today = date.today().replace(day=1)
    result = []
    for i in range(months - 1, -1, -1):
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        key = f"{year:04d}-{month:02d}"
        row = db.query_one(
            "SELECT SUM(amount) v FROM payments WHERE status='Paid' AND substr(paid_at,1,7) = ?",
            (key,),
        )
        result.append(
            {
                "month": datetime(year, month, 1).strftime("%b"),
                "key": key,
                "revenue": round(float(row["v"] or 0), 2),
            }
        )
    return result


@app.get("/api/dashboard/charts/specialties")
def chart_specialties(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    rows = db.query_all(
        """
        SELECT
            d.specialty                AS specialty,
            COUNT(DISTINCT d.id)       AS doctors,
            COUNT(a.id)                AS appointments
        FROM doctors d
        LEFT JOIN appointments a ON a.doctor_id = d.id
        GROUP BY d.specialty
        ORDER BY appointments DESC
        """
    )
    for row in rows:
        row["doctors"] = int(row["doctors"])
        row["appointments"] = int(row["appointments"])
    return rows


@app.get("/api/dashboard/recent-appointments")
def recent_appointments(
    limit: int = Query(default=8, ge=1, le=50),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    rows = db.query_all(
        """
        SELECT
            a.id, a.appointment_date, a.time_slot, a.reason, a.status, a.fee, a.payment_status,
            p.name  AS patient_name,
            d.name  AS doctor_name,
            d.specialty
        FROM appointments a
        LEFT JOIN patients p ON p.id = a.patient_id
        LEFT JOIN doctors  d ON d.id = a.doctor_id
        ORDER BY a.appointment_date DESC, a.id DESC
        LIMIT ?
        """,
        (limit,),
    )
    for row in rows:
        row["id"] = int(row["id"])
        row["fee"] = float(row["fee"] or 0)
    return rows


@app.get("/api/dashboard/top-doctors")
def top_doctors(
    limit: int = Query(default=5, ge=1, le=20),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    rows = db.query_all(
        """
        SELECT
            d.id, d.name, d.specialty, d.hospital, d.avatar_url, d.rating,
            d.consultation_fee, COUNT(a.id) AS appointments,
            COALESCE(SUM(CASE WHEN a.status = 'Completed' THEN a.fee ELSE 0 END), 0) AS revenue
        FROM doctors d
        LEFT JOIN appointments a ON a.doctor_id = d.id
        GROUP BY d.id
        ORDER BY appointments DESC, d.rating DESC
        LIMIT ?
        """,
        (limit,),
    )
    for row in rows:
        row["id"] = int(row["id"])
        row["appointments"] = int(row["appointments"])
        row["revenue"] = round(float(row["revenue"]), 2)
        row["rating"] = float(row["rating"] or 0)
    return rows


# ---------------------------------------------------------------------------
# Doctors
# ---------------------------------------------------------------------------
SORTABLE_DOCTOR_FIELDS = {
    "name": "d.name",
    "specialty": "d.specialty",
    "status": "d.status",
    "rating": "d.rating",
    "experience_years": "d.experience_years",
    "consultation_fee": "d.consultation_fee",
    "created_at": "d.created_at",
    "total_patients": "d.total_patients",
}


@app.get("/api/doctors")
def list_doctors(
    search: Optional[str] = Query(default=None),
    specialty: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    hospital: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_dir: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    where: list[str] = []
    params: list[Any] = []

    if search:
        where.append(
            "(d.name LIKE ? OR d.email LIKE ? OR d.phone LIKE ? OR d.hospital LIKE ? "
            "OR d.specialty LIKE ? OR d.city LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like] * 6)
    if specialty and specialty.lower() != "all":
        where.append("d.specialty = ?")
        params.append(specialty)
    if status and status.lower() != "all":
        where.append("d.status = ?")
        params.append(status)
    if hospital and hospital.lower() != "all":
        where.append("d.hospital = ?")
        params.append(hospital)
    if city and city.lower() != "all":
        where.append("d.city = ?")
        params.append(city)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    column = SORTABLE_DOCTOR_FIELDS.get(sort_by, "d.created_at")
    direction = "ASC" if str(sort_dir).lower() == "asc" else "DESC"

    total_row = db.query_one(f"SELECT COUNT(*) AS c FROM doctors d {where_sql}", params)
    total = int(total_row["c"]) if total_row else 0

    offset = (page - 1) * limit
    items = db.query_all(
        f"""
        SELECT d.*,
               (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id) AS appointments_count,
               (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id AND a.status = 'Completed') AS completed_count
        FROM doctors d
        {where_sql}
        ORDER BY {column} {direction}
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset],
    )

    for item in items:
        item["id"] = int(item["id"])
        item["experience_years"] = int(item["experience_years"] or 0)
        item["consultation_fee"] = float(item["consultation_fee"] or 0)
        item["rating"] = float(item["rating"] or 0)
        item["total_patients"] = int(item["total_patients"] or 0)
        item["appointments_count"] = int(item["appointments_count"] or 0)
        item["completed_count"] = int(item["completed_count"] or 0)

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
    }


@app.get("/api/doctors/{doctor_id}")
def get_doctor(doctor_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    doctor = db.query_one(
        """
        SELECT d.*,
               (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id) AS appointments_count
        FROM doctors d WHERE d.id = ?
        """,
        (doctor_id,),
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doctor["id"] = int(doctor["id"])
    doctor["appointments_count"] = int(doctor["appointments_count"] or 0)
    doctor["media"] = _list_doctor_media(doctor_id)
    return doctor


@app.post("/api/doctors", status_code=201)
def create_doctor(payload: schemas.DoctorCreate, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    exists = db.query_one("SELECT id FROM doctors WHERE email = ?", (payload.email,))
    if exists:
        raise HTTPException(status_code=409, detail="A doctor with this email already exists")

    now = db.now_iso()
    doctor_id = db.execute(
        """
        INSERT INTO doctors
            (name, email, phone, specialty, qualification, experience_years, hospital, city,
             country, consultation_fee, rating, status, gender, bio, avatar_url,
             urdu_name, whatsapp, opd_info, ot_schedule, diseases, clinics_json, timings_json,
             views_count, total_calls, sehat_card_empaneled, profile_activity, doctors_message,
             created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            payload.name, payload.email, payload.phone, payload.specialty, payload.qualification,
            payload.experience_years, payload.hospital, payload.city, payload.country,
            payload.consultation_fee, payload.rating, payload.status, payload.gender,
            payload.bio, payload.avatar_url,
            payload.urdu_name, payload.whatsapp, payload.opd_info, payload.ot_schedule,
            payload.diseases, payload.clinics_json, payload.timings_json,
            payload.views_count, payload.total_calls, payload.sehat_card_empaneled,
            payload.profile_activity, payload.doctors_message,
            now, now,
        ),
    )
    return get_doctor(doctor_id)


@app.put("/api/doctors/{doctor_id}")
def update_doctor(
    doctor_id: int,
    payload: schemas.DoctorUpdate,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    existing = db.query_one("SELECT * FROM doctors WHERE id = ?", (doctor_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if payload.email and payload.email != existing["email"]:
        clash = db.query_one("SELECT id FROM doctors WHERE email = ? AND id <> ?", (payload.email, doctor_id))
        if clash:
            raise HTTPException(status_code=409, detail="A doctor with this email already exists")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_doctor(doctor_id)

    data["updated_at"] = db.now_iso()
    assignments = ", ".join(f"{key} = ?" for key in data)
    db.execute(
        f"UPDATE doctors SET {assignments} WHERE id = ?",
        list(data.values()) + [doctor_id],
    )
    return get_doctor(doctor_id)


@app.delete("/api/doctors/{doctor_id}")
def delete_doctor(doctor_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, str]:
    existing = db.query_one("SELECT * FROM doctors WHERE id = ?", (doctor_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Doctor not found")
    # remove gallery media files + rows before dropping the doctor
    for row in db.query_all("SELECT url, provider FROM doctor_media WHERE doctor_id = ?", (doctor_id,)):
        _delete_media_file(row["url"], row["provider"] or "")
    db.execute("DELETE FROM doctor_media WHERE doctor_id = ?", (doctor_id,))
    db.execute("DELETE FROM doctors WHERE id = ?", (doctor_id,))
    return {"message": f"Doctor '{existing['name']}' deleted"}


@app.post("/api/doctors/{doctor_id}/avatar")
async def upload_avatar(
    doctor_id: int,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    existing = db.query_one("SELECT id FROM doctors WHERE id = ?", (doctor_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Doctor not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is larger than 5 MB")

    result = cloudinary_service.upload_image(content, file.filename or "avatar.png", "avatars")
    db.execute(
        "UPDATE doctors SET avatar_url = ?, cloudinary_id = ?, updated_at = ? WHERE id = ?",
        (result["url"], result.get("public_id"), db.now_iso(), doctor_id),
    )
    return {"url": result["url"], "provider": result["provider"]}


# ---------------------------------------------------------------------------
# Doctor profile media gallery (photos + videos)
# ---------------------------------------------------------------------------
DOCTOR_IMAGE_MAX_BYTES = 10 * 1024 * 1024   # 10 MB
DOCTOR_VIDEO_MAX_BYTES = 50 * 1024 * 1024   # 50 MB


def _list_doctor_media(doctor_id: int) -> list[dict[str, Any]]:
    rows = db.query_all(
        """
        SELECT id, doctor_id, kind, url, provider, created_at
        FROM doctor_media
        WHERE doctor_id = ?
        ORDER BY kind ASC, id DESC
        """,
        (doctor_id,),
    )
    for row in rows:
        row["id"] = int(row["id"])
        row["doctor_id"] = int(row["doctor_id"])
    return rows


def _doctor_media_row(media_id: int) -> dict[str, Any]:
    row = db.query_one("SELECT * FROM doctor_media WHERE id = ?", (media_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Media item not found")
    return row


def _delete_media_file(url: str, provider: str) -> None:
    """Remove the stored file behind a media row.

    provider='r2'    -> delete the object from the Cloudflare R2 bucket
    provider='local' -> unlink the file under backend/uploads
    other (cloudinary/link) -> best-effort Cloudinary destroy, harmless.
    """
    if provider == "r2":
        from services import r2_storage

        key = r2_storage.key_from_public_url(url)
        if key:
            r2_storage.delete_object(key)
        else:
            # URL predates the current public_base (or base is unset):
            # treat the path part after the host as the key.
            path = (url or "").split("://", 1)[-1]
            path = path.split("/", 1)
            if len(path) == 2 and path[1]:
                r2_storage.delete_object(path[1])
        return
    if provider != "local":
        cloudinary_service.delete_image(None, url)
        return
    if not url or not url.startswith("/uploads/"):
        return
    # /uploads/<folder>/<name> -> never allow escaping the upload directory
    parts = [p for p in url[len("/uploads/"):].split("/") if p]
    if any(p in ("..", ".") for p in parts) or len(parts) != 2:
        return
    target = os.path.join(config.UPLOAD_DIR, *parts)
    upload_root = os.path.abspath(config.UPLOAD_DIR)
    try:
        if os.path.abspath(target).startswith(upload_root) and os.path.isfile(target):
            os.remove(target)
    except OSError as exc:  # keep the row removal going even if unlink fails
        print(f"[media] local file delete failed for {url}: {exc}")


@app.post("/api/doctors/{doctor_id}/media/images")
async def upload_doctor_media_images(
    doctor_id: int,
    files: list[UploadFile] = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if not db.query_one("SELECT id FROM doctors WHERE id = ?", (doctor_id,)):
        raise HTTPException(status_code=404, detail="Doctor not found")

    saved: list[dict[str, Any]] = []
    for file in files[:12]:  # safety cap per request
        content = await file.read()
        if not content:
            continue
        if len(content) > DOCTOR_IMAGE_MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"Image '{file.filename}' 10 MB se bari hai")
        result = cloudinary_service.upload_media(content, file.filename or "photo.jpg", "doctors", "image")
        db.execute(
            "INSERT INTO doctor_media (doctor_id, kind, url, provider, public_id) VALUES (?, 'image', ?, ?, ?)",
            (doctor_id, result["url"], result["provider"], result.get("public_id")),
        )
        saved.append({"url": result["url"], "provider": result["provider"]})

    if not saved:
        raise HTTPException(status_code=400, detail="Koi image nahi mili")
    return {"saved": len(saved), "items": _list_doctor_media(doctor_id)}


@app.post("/api/doctors/{doctor_id}/media/video-file")
async def upload_doctor_media_video(
    doctor_id: int,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if not db.query_one("SELECT id FROM doctors WHERE id = ?", (doctor_id,)):
        raise HTTPException(status_code=404, detail="Doctor not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > DOCTOR_VIDEO_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Video 50 MB se bari hai")

    result = cloudinary_service.upload_media(content, file.filename or "video.mp4", "doctors", "video")
    db.execute(
        "INSERT INTO doctor_media (doctor_id, kind, url, provider, public_id) VALUES (?, 'video', ?, ?, ?)",
        (doctor_id, result["url"], result["provider"], result.get("public_id")),
    )
    return {"url": result["url"], "provider": result["provider"], "items": _list_doctor_media(doctor_id)}


@app.post("/api/doctors/{doctor_id}/media/video-link")
def add_doctor_media_video_link(
    doctor_id: int,
    payload: schemas.VideoLinkCreate,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if not db.query_one("SELECT id FROM doctors WHERE id = ?", (doctor_id,)):
        raise HTTPException(status_code=404, detail="Doctor not found")

    url = payload.url.strip()
    if not re.match(r"^https?://[^\s]+$", url) or len(url) > 2048:
        raise HTTPException(status_code=400, detail="Valid video link (http/https URL) den")
    db.execute(
        "INSERT INTO doctor_media (doctor_id, kind, url, provider) VALUES (?, 'video', ?, 'link')",
        (doctor_id, url),
    )
    return {"url": url, "provider": "link", "items": _list_doctor_media(doctor_id)}


@app.delete("/api/media/{media_id}")
def delete_doctor_media(media_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    row = _doctor_media_row(media_id)
    doctor_id = int(row["doctor_id"])
    _delete_media_file(row["url"], row["provider"] or "")
    db.execute("DELETE FROM doctor_media WHERE id = ?", (media_id,))
    return {"message": "Media deleted", "items": _list_doctor_media(doctor_id)}


@app.get("/api/doctors/{doctor_id}/media")
def list_doctor_media(
    doctor_id: int,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if not db.query_one("SELECT id FROM doctors WHERE id = ?", (doctor_id,)):
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {"items": _list_doctor_media(doctor_id)}


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------
@app.get("/api/specialties")
def list_specialties(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    rows = db.query_all(
        """
        SELECT d.name, d.icon, d.color, d.description, COUNT(dr.id) AS doctors
        FROM departments d
        LEFT JOIN doctors dr ON dr.specialty = d.name
        GROUP BY d.name
        ORDER BY d.name ASC
        """
    )
    for row in rows:
        row["doctors"] = int(row["doctors"] or 0)
    return rows


@app.get("/api/hospitals")
def list_hospitals(user: dict[str, Any] = Depends(current_user)) -> list[str]:
    rows = db.query_all("SELECT DISTINCT hospital FROM doctors WHERE hospital IS NOT NULL AND hospital <> '' ORDER BY hospital")
    return [r["hospital"] for r in rows]


@app.get("/api/hospitals/directory")
def hospitals_directory(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    """Hospital directory imported from the backup: name, city and counts."""
    rows = db.query_all(
        """
        SELECT h.id, h.name, h.urdu_name, h.city, h.doctor_count,
               CASE WHEN h.source_id LIKE 'panel:%' THEN 'panel' ELSE 'backup' END AS origin,
               m.profile_url AS profile_image_url,
               m.cover_url AS cover_image_url,
               (SELECT COUNT(*) FROM hospital_schedules s WHERE s.hospital_id = h.id) AS schedules
        FROM hospitals h
        LEFT JOIN hospital_media m ON m.source_id = h.source_id
        ORDER BY h.name ASC
        """
    )
    for row in rows:
        row["id"] = int(row["id"])
        row["doctor_count"] = int(row["doctor_count"] or 0)
        row["schedules"] = int(row["schedules"] or 0)

    # Attach the specialty chips from the doctor ↔ hospital link table.
    specs_by_hospital: dict[int, set[str]] = {}
    for link_row in db.query_all(
        """
        SELECT l.hospital_id, d.specialty
        FROM hospital_doctors l
        JOIN doctors d ON d.id = l.doctor_id
        WHERE d.specialty IS NOT NULL AND d.specialty <> ''
        """
    ):
        specs_by_hospital.setdefault(int(link_row["hospital_id"]), set()).add(link_row["specialty"])
    for row in rows:
        row["specialties"] = sorted(specs_by_hospital.get(row["id"], set()))
    return rows


@app.post("/api/hospitals", status_code=201)
def create_hospital(payload: schemas.HospitalCreate, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Add a hospital from the panel (in addition to the imported directory)."""
    existing = db.query_one(
        "SELECT id FROM hospitals WHERE LOWER(name) = LOWER(?)", (payload.name,)
    )
    if existing:
        raise HTTPException(status_code=409, detail="A hospital with this name already exists")

    hospital_id = db.execute(
        "INSERT INTO hospitals (source_id, name, urdu_name, city, doctor_count) VALUES (?, ?, ?, ?, 0)",
        ("panel:" + uuid.uuid4().hex, payload.name, payload.urdu_name or None, payload.city or None),
    )
    # Keep the city filter working when the panel adds a brand-new city.
    if payload.city:
        db.execute("INSERT OR IGNORE INTO cities (name) VALUES (?)", (payload.city,))
    return _hospital_payload(hospital_id)


@app.put("/api/hospitals/{hospital_id}")
def update_hospital(
    hospital_id: int,
    payload: schemas.HospitalUpdate,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    existing = db.query_one("SELECT id, name, city FROM hospitals WHERE id = ?", (hospital_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Hospital not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        clash = db.query_one(
            "SELECT id FROM hospitals WHERE id <> ? AND LOWER(name) = LOWER(?)",
            (hospital_id, data["name"]),
        )
        if clash:
            raise HTTPException(status_code=409, detail="A hospital with this name already exists")

    if data.get("city") and data["city"] != existing["city"]:
        db.execute("INSERT OR IGNORE INTO cities (name) VALUES (?)", (data["city"],))
    data_to_set = {k: v or None for k, v in data.items()}
    if data_to_set:
        assignments = ", ".join(f"{key} = ?" for key in data_to_set)
        db.execute(f"UPDATE hospitals SET {assignments} WHERE id = ?", (*data_to_set.values(), hospital_id))
    return _hospital_payload(hospital_id)


@app.delete("/api/hospitals/{hospital_id}")
def delete_hospital(hospital_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Only panel-added hospitals can be removed – backup rows stay read-only."""
    existing = db.query_one("SELECT id, source_id, name FROM hospitals WHERE id = ?", (hospital_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Hospital not found")
    if not existing["source_id"] or str(existing["source_id"]).startswith("panel:"):
        pass  # panel-added hospital – allowed
    else:
        raise HTTPException(
            status_code=403,
            detail="Backup hospitals are read-only here – delete them from the backup data instead",
        )
    # remove the hospital's local-disk images (cover / profile) if any
    media = db.query_one(
        "SELECT profile_url, cover_url FROM hospital_media WHERE source_id = ?",
        (existing["source_id"] or f"panel:{hospital_id}",),
    )
    if media:
        for url in (media["profile_url"], media["cover_url"]):
            if url and url.startswith("/uploads/"):
                path = os.path.join(config.UPLOAD_DIR, url.removeprefix("/uploads/"))
                try:
                    if os.path.isfile(path):
                        os.remove(path)
                except OSError:
                    pass
    db.execute("DELETE FROM hospital_media WHERE source_id = ?", (existing["source_id"] or f"panel:{hospital_id}",))
    db.execute("DELETE FROM hospitals WHERE id = ?", (hospital_id,))
    return {"message": f"Hospital '{existing['name']}' deleted"}


def _hospital_payload(hospital_id: int) -> dict[str, Any]:
    hospital = db.query_one(
        """SELECT h.id, h.name, h.urdu_name, h.city, h.doctor_count,
                  (SELECT COUNT(*) FROM hospital_schedules s WHERE s.hospital_id = h.id) AS schedules,
                  m.profile_url AS profile_image_url,
                  m.cover_url AS cover_image_url
           FROM hospitals h
           LEFT JOIN hospital_media m ON m.source_id = h.source_id
           WHERE h.id = ?""",
        (hospital_id,),
    )
    schedule_count = int(hospital["schedules"] or 0)
    return {
        "id": int(hospital["id"]),
        "name": hospital["name"],
        "urdu_name": hospital["urdu_name"],
        "city": hospital["city"],
        "doctor_count": int(hospital["doctor_count"] or 0),
        "schedules": schedule_count,
        "specialties": [],
        "profile_image_url": hospital["profile_image_url"],
        "cover_image_url": hospital["cover_image_url"],
        "origin": "panel",
    }


@app.get("/api/cities")
def list_cities(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    """Cities from the backup with hospital and doctor counts."""
    rows = db.query_all(
        """
        SELECT c.name,
               (SELECT COUNT(*) FROM hospitals h WHERE h.city = c.name) AS hospitals,
               (SELECT COUNT(*) FROM doctors d WHERE d.city = c.name)  AS doctors
        FROM cities c
        ORDER BY c.name ASC
        """
    )
    for row in rows:
        row["hospitals"] = int(row["hospitals"] or 0)
        row["doctors"] = int(row["doctors"] or 0)
    return rows


@app.get("/api/hospitals/{hospital_id}")
def hospital_detail(
    hospital_id: int,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """One hospital with its attached doctors and OPD/OT duty slots."""
    hospital = db.query_one(
        """
        SELECT h.id, h.source_id, h.name, h.urdu_name, h.city, h.doctor_count,
               (SELECT COUNT(*) FROM hospital_schedules s WHERE s.hospital_id = h.id) AS schedule_count,
               m.profile_url AS profile_image_url,
               m.cover_url AS cover_image_url
        FROM hospitals h
        LEFT JOIN hospital_media m ON m.source_id = h.source_id
        WHERE h.id = ?
        """,
        (hospital_id,),
    )
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    schedules = db.query_all(
        """
        SELECT s.id, h.name AS hospital, h.urdu_name AS hospital_urdu, h.city,
               s.doctor_name, s.opd_specialty, s.day, s.start_time, s.end_time
        FROM hospital_schedules s
        JOIN hospitals h ON h.id = s.hospital_id
        WHERE s.hospital_id = ?
        ORDER BY CASE s.day
                    WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
                    ELSE 7 END,
                 s.start_time ASC
        """,
        (hospital_id,),
    )
    for slot in schedules:
        slot["id"] = int(slot["id"])

    doctors = db.query_all(
        """
        SELECT d.* FROM hospital_doctors l
        JOIN doctors d ON d.id = l.doctor_id
        WHERE l.hospital_id = ?
        ORDER BY LOWER(d.name)
        """,
        (hospital_id,),
    )
    specialties = sorted({str(d["specialty"]) for d in doctors if d["specialty"]})

    return {
        "hospital": {
            "id": int(hospital["id"]),
            "name": hospital["name"],
            "urdu_name": hospital["urdu_name"],
            "city": hospital["city"],
            "doctor_count": len(doctors),
            "schedule_count": int(hospital["schedule_count"] or 0),
            "specialties": specialties,
            "profile_image_url": hospital["profile_image_url"],
            "cover_image_url": hospital["cover_image_url"],
        },
        "schedules": schedules,
        "doctors": [
            {
                "id": int(d["id"]),
                "name": d["name"],
                "email": d["email"],
                "specialty": d["specialty"],
                "status": d["status"],
                "avatar_url": d["avatar_url"],
                "rating": float(d["rating"] or 0),
                "city": d["city"],
            }
            for d in doctors
        ],
    }


def _save_hospital_image(hospital_id: int, file: "UploadFile", kind: str) -> dict[str, Any]:
    """Shared logic behind the hospital profile / cover image uploads."""
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is larger than 5 MB")

    hospital = db.query_one("SELECT id, source_id FROM hospitals WHERE id = ?", (hospital_id,))
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    if not hospital["source_id"]:
        raise HTTPException(status_code=403, detail="Remote accounts cannot be edited here")

    kind_col = "profile_url" if kind == "profile" else "cover_url"
    field = "profile_image_url" if kind == "profile" else "cover_image_url"

    result = cloudinary_service.upload_image(content, file.filename or f"{kind}.png", "hospitals")

    # replace an old local-disk image so uploads does not grow forever
    current = db.query_one(
        f"SELECT {kind_col} AS url FROM hospital_media WHERE source_id = ?",
        (hospital["source_id"],),
    )
    old_url = current["url"] if current else None
    if old_url and old_url.startswith("/uploads/"):
        rel = old_url.removeprefix("/uploads/")
        path = os.path.join(config.UPLOAD_DIR, rel)
        try:
            if os.path.isfile(path):
                os.remove(path)
        except OSError:
            pass

    db.execute(
        f"""
        INSERT INTO hospital_media (source_id, {kind_col}, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(source_id) DO UPDATE SET
            {kind_col} = excluded.{kind_col},
            updated_at = excluded.updated_at
        """,
        (hospital["source_id"], result["url"]),
    )
    return {"url": result["url"], "provider": result["provider"], field: result["url"]}


@app.post("/api/hospitals/{hospital_id}/profile-image")
async def upload_hospital_profile_image(
    hospital_id: int,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Hospital logo / profile photo shown on the profile page and cards."""
    return _save_hospital_image(hospital_id, file, "profile")


@app.post("/api/hospitals/{hospital_id}/cover-image")
async def upload_hospital_cover_image(
    hospital_id: int,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Wide banner rendered across the top of the hospital profile."""
    return _save_hospital_image(hospital_id, file, "cover")


@app.get("/api/hospital-schedules")
def list_hospital_schedules(
    hospital: Optional[str] = None,
    day: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=1000),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    """OPD/OT duty slots per hospital – the appointment details from the backup."""
    sql = """
        SELECT s.id, s.hospital_id, h.name AS hospital, h.urdu_name AS hospital_urdu, h.city,
               s.doctor_name, s.opd_specialty, s.day, s.start_time, s.end_time
        FROM hospital_schedules s
        JOIN hospitals h ON h.id = s.hospital_id
        WHERE 1 = 1
    """
    params: list[Any] = []
    if hospital and hospital != "all":
        sql += " AND h.name = ?"
        params.append(hospital)
    if day and day != "all":
        sql += " AND s.day = ?"
        params.append(day)
    if search:
        sql += " AND (s.doctor_name LIKE ? OR s.opd_specialty LIKE ? OR h.name LIKE ?)"
        like = f"%{search}%"
        params.extend([like, like, like])
    sql += """
        ORDER BY h.name ASC,
                 CASE s.day
                    WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
                    ELSE 7 END,
                 s.start_time ASC
        LIMIT ?
    """
    params.append(limit)
    rows = db.query_all(sql, params)
    for row in rows:
        row["id"] = int(row["id"])
        row["hospital_id"] = int(row["hospital_id"])
    return rows


@app.get("/api/app-users")
def list_app_users(
    search: Optional[str] = Query(default=None),
    registered: Optional[str] = Query(default=None),   # all | yes | no
    sort_by: str = Query(default="created_at"),
    sort_dir: str = Query(default="asc"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Mobile app users from the backup: device tokens + registered accounts."""
    where: list[str] = []
    params: list[Any] = []
    if search:
        where.append(
            "(name LIKE ? OR email LIKE ? OR device_token LIKE ? OR uid LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like] * 4)
    if registered == "yes":
        where.append("is_registered = 1")
    elif registered == "no":
        where.append("is_registered = 0")
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    sortable = {"created_at": "id", "name": "name", "email": "email", "role": "role"}
    column = sortable.get(sort_by, "id")
    direction = "DESC" if str(sort_dir).lower() == "desc" else "ASC"

    total_row = db.query_one(f"SELECT COUNT(*) AS c FROM app_users {where_sql}", params)
    total = int(total_row["c"]) if total_row else 0
    offset = (page - 1) * limit

    rows = db.query_all(
        f"""
        SELECT id, source_id, uid, name, email, role, earning, device_token, is_registered
        FROM app_users
        {where_sql}
        ORDER BY
            CASE WHEN is_registered = 1 THEN 0 ELSE 1 END ASC,
            {column} {direction}
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset],
    )
    for row in rows:
        row["id"] = int(row["id"])
        row["is_registered"] = int(row["is_registered"] or 0)
        row["earning"] = float(row["earning"] or 0)

    stats_row = db.query_one(
        "SELECT COUNT(*) AS total, SUM(is_registered) AS registered, "
        "SUM(CASE WHEN device_token IS NOT NULL THEN 1 ELSE 0 END) AS with_token FROM app_users"
    )

    return {
        "items": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
        "summary": {
            "total": int(stats_row["total"] or 0) if stats_row else 0,
            "registered": int(stats_row["registered"] or 0) if stats_row else 0,
            "with_token": int(stats_row["with_token"] or 0) if stats_row else 0,
        },
    }


@app.get("/api/app-users/tokens")
def list_app_user_tokens(
    limit: int = Query(default=2000, ge=1, le=5000),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Every valid FCM device token, e.g. to paste into a push campaign."""
    rows = db.query_all(
        """
        SELECT id, device_token FROM app_users
        WHERE device_token IS NOT NULL AND TRIM(device_token) <> ''
        ORDER BY is_registered DESC, id ASC
        LIMIT ?
        """,
        (limit,),
    )
    return {
        "total": len(rows),
        "tokens": [row["device_token"] for row in rows],
    }


@app.delete("/api/app-users")
def delete_all_app_users(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Remove every app-user account (registered accounts + device tokens).

    Accounts that were deleted in the panel will not come back unless the
    backup is re-imported on a fresh database; new registrations from the
    mobile app will show up here again automatically.
    """
    row = db.query_one("SELECT COUNT(*) AS c FROM app_users")
    count = int(row["c"]) if row else 0
    db.execute("DELETE FROM app_users")
    return {
        "message": f"{count} app-user account(s) remove ho gaye",
        "removed": count,
    }


@app.get("/api/notifications")
def list_notifications(
    search: Optional[str] = Query(default=None),
    n_type: Optional[str] = Query(default=None, alias="type"),
    origin: Optional[str] = Query(default=None),   # all | backup | panel
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    """Push notifications shown inside the mobile app: the backup's history
    (read-only) plus fresh ones sent from this panel."""
    sql = """
        SELECT id, title, description, type, image_url, parent_notification_id,
               sent_at, admin_name, backup_updated_at, origin
        FROM notifications
    """
    params: list[Any] = []
    where: list[str] = []
    if search:
        where.append("(title LIKE ? OR description LIKE ? OR type LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like, like])
    if n_type and n_type.lower() != "all":
        where.append("type = ?")
        params.append(n_type)
    if origin in ("backup", "panel"):
        where.append("origin = ?")
        params.append(origin)
    if where:
        sql += " WHERE " + " AND ".join(where)
    # sent-from-panel first (newest content), then the backup history
    sql += " ORDER BY (origin = 'panel') DESC, sent_at DESC"
    rows = db.query_all(sql, params)
    for row in rows:
        row["id"] = int(row["id"])
    return rows


@app.post("/api/notifications", status_code=201)
def send_notification(payload: dict[str, Any], user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Compose a new push notification for the mobile app audience.

    It is stored with origin='panel' so a backup re-import never
    deletes it; actual FCM delivery stays pluggable.
    """
    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="A title is required")
    description = str(payload.get("description") or "").strip() or None
    n_type = str(payload.get("type") or "updated").strip().lower() or "updated"
    allowed_types = {"updated", "created", "offer", "alert", "info"}
    if n_type not in allowed_types:
        raise HTTPException(status_code=422, detail="Type must be one of: " + ", ".join(sorted(allowed_types)))

    now = db.now_iso()
    new_id = db.execute(
        """
        INSERT INTO notifications
            (source_id, title, description, type, image_url, sent_at, admin_name, origin, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)
        """,
        (
            f"panel:{secrets.token_hex(8)}",
            title, description, n_type,
            str(payload.get("image_url") or "").strip() or None,
            now,
            user.get("name") or "Admin",
            "panel",
            now,
        ),
    )
    row = db.query_one(
        "SELECT id, title, description, type, image_url, sent_at, admin_name, origin, created_at "
        "FROM notifications WHERE id = ?",
        (new_id,),
    )
    row["id"] = int(row["id"])
    return row


@app.delete("/api/notifications/{notification_id}")
def delete_notification(notification_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Only notifications sent from this panel can be deleted – the
    backup's history stays read-only."""
    row = db.query_one("SELECT id, origin FROM notifications WHERE id = ?", (notification_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    if row["origin"] != "panel":
        raise HTTPException(status_code=403, detail="Backup notifications are read-only")
    db.execute("DELETE FROM notifications WHERE id = ?", (notification_id,))
    return {"ok": True}


@app.get("/api/opd-specialties")
def list_opd_specialties(
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    """OPD specialty groups exactly as the mobile app shows them (English + Urdu)."""
    rows = db.query_all("SELECT id, name_en, name_ur FROM opd_specialties ORDER BY name_en ASC")
    for row in rows:
        row["id"] = int(row["id"])
    return rows


# ---------------------------------------------------------------------------
# My Ads – the admin's own advertisement content
# ---------------------------------------------------------------------------
def _youtube_thumb(url: str) -> str | None:
    """YouTube watch / youtu.be / shorts / embed link -> its poster thumbnail."""
    match = re.search(
        r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|shorts/|embed/|live/))([\w-]{6,})",
        url,
    )
    return f"https://i.ytimg.com/vi/{match.group(1)}/hqdefault.jpg" if match else None


def _ad_media_url(raw: str) -> str | None:
    """An ad banner pasted as a link: direct image URLs pass through,
    YouTube links become their thumbnail."""
    url = str(raw or "").strip()
    if not url:
        return None
    if not re.match(r"^https?://", url, re.I):
        raise HTTPException(status_code=422, detail="Banner link must start with http:// or https://")
    return _youtube_thumb(url) or url


def _normalise_ad_payload(payload: dict[str, Any]) -> dict[str, Any]:
    data: dict[str, Any] = {}
    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="A title is required")
    data["title"] = title
    data["content"] = str(payload.get("content") or "").strip() or None
    data["date_from"] = str(payload.get("date_from") or "").strip() or None
    data["date_to"] = str(payload.get("date_to") or "").strip() or None
    data["active"] = 1 if payload.get("active", True) else 0
    if "image_url" in payload:
        data["image_url"] = _ad_media_url(payload.get("image_url"))
    return data


@app.get("/api/my-ads")
def list_my_ads(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    rows = db.query_all("SELECT * FROM my_ads ORDER BY created_at DESC, id DESC")
    for row in rows:
        row["id"] = int(row["id"])
        row["active"] = int(row["active"] or 0)
    return rows


@app.post("/api/my-ads", status_code=201)
def create_my_ad(
    payload: dict[str, Any],
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    data = _normalise_ad_payload(payload)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_id = db.execute(
        """
        INSERT INTO my_ads (title, content, image_url, date_from, date_to, active, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?)
        """,
        (
            data["title"],
            data["content"],
            data.get("image_url"),
            data["date_from"],
            data["date_to"],
            data["active"],
            now,
            now,
        ),
    )
    row = db.query_one("SELECT * FROM my_ads WHERE id = ?", (new_id,))
    if row:
        row["id"] = int(row["id"])
        row["active"] = int(row["active"] or 0)
    return row


def _local_ad_file(url: str | None) -> str | None:
    """Absolut path of a locally stored ad image (only inside uploads/ads)."""
    if not url or not url.startswith("/uploads/ads/"):
        return None
    name = os.path.basename(url)
    return os.path.join(config.UPLOAD_DIR, "ads", name)


def _drop_ad_image(*urls: str | None) -> None:
    """Delete local ad image files (Cloudinary objects are left alone)."""
    for url in urls:
        path = _local_ad_file(url)
        if path and os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass


@app.put("/api/my-ads/{ad_id}")
def update_my_ad(
    ad_id: int,
    payload: dict[str, Any],
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    existing = db.query_one("SELECT id FROM my_ads WHERE id = ?", (ad_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Ad not found")

    data = _normalise_ad_payload(payload)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if "image_url" in payload:
        old = db.query_one("SELECT image_url FROM my_ads WHERE id = ?", (ad_id,))
        db.execute(
            "UPDATE my_ads SET image_url = ?, cloudinary_id = NULL WHERE id = ?",
            (data.get("image_url"), ad_id),
        )
        # switching away from a locally stored banner cleans up the old file
        if old and old["image_url"] and old["image_url"] != data.get("image_url"):
            _drop_ad_image(old["image_url"])
    db.execute(
        """
        UPDATE my_ads
        SET title = ?, content = ?, date_from = ?, date_to = ?, active = ?, updated_at = ?
        WHERE id = ?
        """,
        (data["title"], data["content"], data["date_from"], data["date_to"], data["active"], now, ad_id),
    )
    if payload.get("remove_image"):
        old = db.query_one("SELECT image_url FROM my_ads WHERE id = ?", (ad_id,))
        db.execute(
            "UPDATE my_ads SET image_url = NULL, cloudinary_id = NULL, updated_at = ? WHERE id = ?",
            (now, ad_id),
        )
        _drop_ad_image(old["image_url"] if old else None)
    row = db.query_one("SELECT * FROM my_ads WHERE id = ?", (ad_id,))
    if row:
        row["id"] = int(row["id"])
        row["active"] = int(row["active"] or 0)
    return row


@app.patch("/api/my-ads/{ad_id}/toggle")
def toggle_my_ad(
    ad_id: int,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Flip the ad between active and paused without opening the editor."""
    existing = db.query_one("SELECT id FROM my_ads WHERE id = ?", (ad_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Ad not found")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        "UPDATE my_ads SET active = 1 - active, updated_at = ? WHERE id = ?", (now, ad_id)
    )
    row = db.query_one("SELECT * FROM my_ads WHERE id = ?", (ad_id,))
    if row:
        row["id"] = int(row["id"])
        row["active"] = int(row["active"] or 0)
    return row


@app.delete("/api/my-ads/{ad_id}")
def delete_my_ad(
    ad_id: int,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, str]:
    existing = db.query_one("SELECT image_url FROM my_ads WHERE id = ?", (ad_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Ad not found")
    _drop_ad_image(existing["image_url"])
    db.execute("DELETE FROM my_ads WHERE id = ?", (ad_id,))
    return {"ok": "true", "deleted": str(ad_id)}


@app.post("/api/my-ads/{ad_id}/image")
async def upload_my_ad_image(
    ad_id: int,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Attach a banner image to one of my ads (local disk until Cloudinary is on)."""
    existing = db.query_one("SELECT id FROM my_ads WHERE id = ?", (ad_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Ad not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is larger than 5 MB")

    result = cloudinary_service.upload_image(content, file.filename or "ad.png", "ads")
    old = db.query_one("SELECT image_url FROM my_ads WHERE id = ?", (ad_id,))
    db.execute(
        "UPDATE my_ads SET image_url = ?, cloudinary_id = ?, updated_at = ? WHERE id = ?",
        (result["url"], result.get("public_id"), datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ad_id),
    )
    # replacing a local banner cleans up the old file on disk
    if old and old["image_url"] and old["image_url"] != result["url"]:
        _drop_ad_image(old["image_url"])
    row = db.query_one("SELECT * FROM my_ads WHERE id = ?", (ad_id,))
    if row:
        row["id"] = int(row["id"])
        row["active"] = int(row["active"] or 0)
    return row


@app.get("/api/backup-promos")
def list_backup_promos(
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    """Promo banners / texts the app already had, from the backup (read-only)."""
    rows = db.query_all("SELECT * FROM backup_promos ORDER BY date_from DESC, id DESC")
    for row in rows:
        row["id"] = int(row["id"])
    return rows


@app.get("/api/patients")
def list_patients(
    limit: int = Query(default=100, ge=1, le=500),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    rows = db.query_all(
        "SELECT id, name, email, phone, age, gender, blood_group, city FROM patients ORDER BY name LIMIT ?",
        (limit,),
    )
    for row in rows:
        row["id"] = int(row["id"])
    return rows


@app.get("/api/payments")
def list_payments(
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    """Revenue records – one row per payment, with the doctor it was booked against."""
    sql = """
        SELECT p.id, p.amount, p.method, p.status, p.paid_at, p.notes,
               d.name AS doctor_name, d.specialty
        FROM payments p
        LEFT JOIN doctors d ON d.id = p.doctor_id
        WHERE 1 = 1
    """
    params: list[Any] = []
    if status and status.lower() != "all":
        sql += " AND p.status = ?"
        params.append(status)
    if search:
        sql += " AND (p.notes LIKE ? OR d.name LIKE ? OR p.method LIKE ?)"
        like = f"%{search}%"
        params.extend([like, like, like])
    sql += " ORDER BY p.paid_at DESC, p.id DESC LIMIT ?"
    params.append(limit)
    rows = db.query_all(sql, params)
    for row in rows:
        row["id"] = int(row["id"])
        row["amount"] = float(row["amount"] or 0)
    return rows


@app.get("/api/appointments")
def list_appointments(
    limit: int = Query(default=100, ge=1, le=500),
    status: Optional[str] = Query(default=None),
    doctor_id: Optional[int] = Query(default=None),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    where: list[str] = []
    params: list[Any] = []
    if status and status.lower() != "all":
        where.append("a.status = ?")
        params.append(status)
    if doctor_id:
        where.append("a.doctor_id = ?")
        params.append(doctor_id)
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    rows = db.query_all(
        f"""
        SELECT a.*, p.name AS patient_name, d.name AS doctor_name, d.specialty
        FROM appointments a
        LEFT JOIN patients p ON p.id = a.patient_id
        LEFT JOIN doctors  d ON d.id = a.doctor_id
        {where_sql}
        ORDER BY a.appointment_date DESC, a.id DESC
        LIMIT ?
        """,
        params + [limit],
    )
    for row in rows:
        row["id"] = int(row["id"])
        row["fee"] = float(row["fee"] or 0)
    return rows


@app.post("/api/appointments", status_code=201)
def create_appointment(
    payload: schemas.AppointmentCreate,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    patient_id = payload.patient_id
    if patient_id is None and payload.patient_name:
        patient_id = db.execute(
            "INSERT INTO patients (name, email, phone) VALUES (?,?,?)",
            (payload.patient_name, None, None),
        )
    if patient_id is None:
        raise HTTPException(status_code=400, detail="patient_id or patient_name is required")

    doctor = db.query_one("SELECT id, consultation_fee FROM doctors WHERE id = ?", (payload.doctor_id,))
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    fee = payload.fee or float(doctor["consultation_fee"] or 0)
    appt_id = db.execute(
        """
        INSERT INTO appointments
            (patient_id, doctor_id, appointment_date, time_slot, reason, fee, status, payment_status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)
        """,
        (
            patient_id, doctor_id, payload.appointment_date.isoformat(), payload.time_slot,
            payload.reason, fee, payload.status, payload.payment_status, db.now_iso(),
        ),
    )
    row = db.query_one("SELECT * FROM appointments WHERE id = ?", (appt_id,))
    return row or {}


# ---------------------------------------------------------------------------
# Static front end
# ---------------------------------------------------------------------------
@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(config.FRONTEND_DIR, "index.html"))


app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")
app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")


@app.exception_handler(HTTPException)
def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
