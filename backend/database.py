"""
SQLite3 layer for the Doctor Application.

The whole persistence layer is intentionally kept on the Python standard
library (``sqlite3``) so the project runs without any native dependency.
When the application moves to Firebase, only this module needs to be
replaced – the REST contract stays exactly the same.
"""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Iterable

from config import DB_PATH

_local = threading.local()
_write_lock = threading.Lock()

SCHEMA = """
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------
-- Departments / specialties
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    icon        TEXT    DEFAULT 'stethoscope',
    color       TEXT    DEFAULT 'chart-1',
    description TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- Admin users (later replaced by Firebase Auth)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    uid           TEXT UNIQUE,                 -- Firebase uid when migrated
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT,
    role          TEXT    NOT NULL DEFAULT 'admin',
    avatar_url    TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- Doctors
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    email            TEXT    NOT NULL UNIQUE,
    phone            TEXT,
    specialty        TEXT    NOT NULL,
    qualification    TEXT,
    experience_years INTEGER DEFAULT 0,
    hospital         TEXT,
    city             TEXT,
    country          TEXT DEFAULT 'Pakistan',
    consultation_fee REAL    DEFAULT 0,
    rating           REAL    DEFAULT 0,
    total_patients   INTEGER DEFAULT 0,
    status           TEXT    NOT NULL DEFAULT 'Active',   -- Active | On Leave | Inactive
    gender           TEXT,
    bio              TEXT,
    avatar_url       TEXT,
    cloudinary_id    TEXT,                            -- filled once Cloudinary is on
    -- Extra doctor fields imported from the local Firestore backup
    urdu_name            TEXT,
    whatsapp             TEXT,
    opd_info             TEXT,
    ot_schedule          TEXT,
    diseases             TEXT,
    clinics_json         TEXT,
    timings_json         TEXT,
    views_count          INTEGER DEFAULT 0,
    total_calls          INTEGER DEFAULT 0,
    sehat_card_empaneled INTEGER DEFAULT 0,
    profile_activity     TEXT,
    doctors_message      TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty);
CREATE INDEX IF NOT EXISTS idx_doctors_status     ON doctors(status);
CREATE INDEX IF NOT EXISTS idx_doctors_name       ON doctors(name);

-- ------------------------------------------------------------------
-- Patients
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT,
    phone       TEXT,
    age         INTEGER,
    gender      TEXT,
    blood_group TEXT,
    address     TEXT,
    city        TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- Appointments
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id       INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id        INTEGER REFERENCES doctors(id)  ON DELETE CASCADE,
    appointment_date TEXT    NOT NULL,                 -- YYYY-MM-DD
    time_slot        TEXT    NOT NULL,
    reason           TEXT,
    fee              REAL    DEFAULT 0,
    status           TEXT    NOT NULL DEFAULT 'Scheduled', -- Scheduled | Completed | Cancelled | Pending
    payment_status   TEXT    NOT NULL DEFAULT 'Unpaid',   -- Unpaid | Paid | Refunded
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appt_date   ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appt_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status);

-- ------------------------------------------------------------------
-- Payments / revenue ledger
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id  INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    amount     REAL NOT NULL DEFAULT 0,
    method     TEXT NOT NULL DEFAULT 'Cash',
    status     TEXT NOT NULL DEFAULT 'Paid',
    paid_at    TEXT NOT NULL DEFAULT (datetime('now')),
    notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- ------------------------------------------------------------------
-- Cities (imported from the local Firestore backup)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cities (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- Hospitals directory (name + city, from the backup's collection)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id   TEXT UNIQUE,                 -- Firestore document id
    name        TEXT NOT NULL,
    urdu_name   TEXT,
    city        TEXT,
    doctor_count INTEGER DEFAULT 0,          -- doctors referencing this hospital (computed on import)
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE INDEX IF NOT EXISTS idx_hospitals_name ON hospitals(name);

-- ------------------------------------------------------------------
-- Hospital OPD / OT duty schedule rows = the appointment slots the
-- mobile app books patients against (from the backup's otSchedules)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital_schedules (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    hospital_id   INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
    doctor_name   TEXT,
    opd_specialty TEXT,
    day           TEXT,
    start_time    TEXT,
    end_time      TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hsched_hospital ON hospital_schedules(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hsched_day      ON hospital_schedules(day);

-- ------------------------------------------------------------------
-- Doctor ↔ hospital links (computed while importing, from every
-- otSchedule / opdMap / opd reference inside each doctor record)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital_doctors (
    hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    doctor_id   INTEGER NOT NULL REFERENCES doctors(id)  ON DELETE CASCADE,
    PRIMARY KEY (hospital_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_hdoc_doctor ON hospital_doctors(doctor_id);

-- ------------------------------------------------------------------
-- Admin's own ads ("My Ads") – created in the panel, later pushed to
-- the mobile app / uploaded to Cloudinary when plugged in
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS my_ads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    content     TEXT,
    image_url   TEXT,
    cloudinary_id TEXT,                          -- filled once Cloudinary is on
    date_from   TEXT,
    date_to     TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- Promo content the app already shipped (from the backup's
-- carousel_images banners + commercial_texts) – read-only reference
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backup_promos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id    TEXT UNIQUE,
    kind         TEXT,                           -- banner | text
    title        TEXT,
    content      TEXT,
    image_url    TEXT,
    storage_path TEXT,
    date_from    TEXT,
    date_to      TEXT,
    admin_name   TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- Mobile app users (from the backup's users collection: mostly FCM
-- device tokens plus a handful of registered users)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id     TEXT UNIQUE,                  -- Firestore document id
    uid           TEXT,                          -- Firebase auth uid (registered users)
    name          TEXT,
    email         TEXT,
    role          TEXT,                          -- user | owner | ...
    earning       REAL DEFAULT 0,
    device_token  TEXT,                           -- FCM push token
    is_registered INTEGER DEFAULT 0,              -- 1 = has a name/email profile
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_reg   ON app_users(is_registered);

-- ------------------------------------------------------------------
-- Push notifications shown inside the mobile app (backup collection)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id              TEXT UNIQUE,         -- Firestore document id
    title                  TEXT,
    description            TEXT,
    type                   TEXT,                 -- updated | created | ...
    image_url              TEXT,
    parent_notification_id TEXT,
    sent_at                TEXT,                  -- createdAt / dateTime of the push
    admin_name             TEXT,                  -- who sent it
    backup_updated_at      TEXT,
    created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_sent ON notifications(sent_at);

-- ------------------------------------------------------------------
-- OPD specialties exactly as the app groups them (English + Urdu)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opd_specialties (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT UNIQUE,                       -- Firestore document id
    name_en   TEXT,                               -- cleaned English part
    name_ur   TEXT,                               -- Urdu / app-side group name
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

# ---------------------------------------------------------------------------
# Connection handling
# ---------------------------------------------------------------------------


def get_connection() -> sqlite3.Connection:
    """Return a thread-local SQLite connection (one per worker thread).

    Self-healing: under uvicorn the thread that ran the lifespan startup
    (MainThread) can have its connection closed before the first async
    request – recreate it instead of crashing every async endpoint with
    "Cannot operate on a closed database".
    """
    conn = getattr(_local, "conn", None)
    if conn is not None:
        try:
            conn.execute("SELECT 1")
        except sqlite3.Error:
            try:
                conn.close()
            except sqlite3.Error:
                pass
            conn = None
            _local.conn = None
    if conn is None:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return conn


def close_connection() -> None:
    conn = getattr(_local, "conn", None)
    if conn is not None:
        conn.close()
        _local.conn = None


def init_db() -> None:
    """Create every table if it does not exist yet and apply light migrations."""
    conn = get_connection()
    with _write_lock:
        conn.executescript(SCHEMA)
        _migrate_doctors(conn)
        _migrate_notifications(conn)
        _migrate_hospital_media(conn)
        _migrate_doctor_media(conn)
        _ensure_admin_user(conn)
        conn.commit()


def _migrate_hospital_media(conn: sqlite3.Connection) -> None:
    """Hospital profile / cover images keyed by the backup's source_id so they
    survive a re-import (the importer deletes and recreates the hospitals
    table, but source ids stay stable)."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS hospital_media (
            source_id   TEXT PRIMARY KEY,        -- hospitals.source_id
            profile_url TEXT,
            cover_url   TEXT,
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )


def _migrate_doctor_media(conn: sqlite3.Connection) -> None:
    """Doctor profile media gallery: photos + short videos (uploaded files
    or external video links), shown on the doctor's full profile page."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS doctor_media (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id   INTEGER NOT NULL,
            kind        TEXT NOT NULL CHECK (kind IN ('image', 'video')),
            url         TEXT NOT NULL,
            provider    TEXT,
            public_id   TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_docmedia_doctor ON doctor_media(doctor_id, kind)"
    )


def _ensure_admin_user(conn: sqlite3.Connection) -> None:
    """Make sure a login exists on a brand-new database (no demo data)."""
    import hashlib

    existing = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if existing:
        return
    password_hash = hashlib.sha256(b"doctor-app::admin123").hexdigest()
    conn.execute(
        "INSERT OR IGNORE INTO users (name, email, password_hash, role) "
        "VALUES (?,?,?,?)",
        ("Admin", "admin@doctorapp.com", password_hash, "admin"),
    )


# Columns added after the first release.  ``CREATE TABLE IF NOT EXISTS`` does
# not touch existing tables, so older databases need a small ALTER pass.
_DOCTOR_EXTRA_COLUMNS = {
    "urdu_name": "TEXT",
    "whatsapp": "TEXT",
    "opd_info": "TEXT",
    "ot_schedule": "TEXT",
    "diseases": "TEXT",
    "clinics_json": "TEXT",
    "timings_json": "TEXT",
    "views_count": "INTEGER DEFAULT 0",
    "total_calls": "INTEGER DEFAULT 0",
    "sehat_card_empaneled": "INTEGER DEFAULT 0",
    "profile_activity": "TEXT",
    "doctors_message": "TEXT",
}


def _migrate_notifications(conn: sqlite3.Connection) -> None:
    """Mark where each notification came from: 'backup' (read-only) or
    'panel' (sent from this admin panel, wipes must not remove it)."""
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(notifications)")}
    if "origin" not in existing:
        conn.execute("ALTER TABLE notifications ADD COLUMN origin TEXT DEFAULT 'backup'")


def _migrate_doctors(conn: sqlite3.Connection) -> None:
    """Add any missing doctor columns without touching existing data."""
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(doctors)")}
    for column, column_type in _DOCTOR_EXTRA_COLUMNS.items():
        if column not in existing:
            conn.execute(f"ALTER TABLE doctors ADD COLUMN {column} {column_type}")


def query_all(sql: str, params: Iterable[Any] = ()) -> list[dict]:
    cur = get_connection().execute(sql, tuple(params))
    try:
        return [dict(row) for row in cur.fetchall()]
    finally:
        cur.close()


def query_one(sql: str, params: Iterable[Any] = ()) -> dict | None:
    cur = get_connection().execute(sql, tuple(params))
    try:
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()


def execute(sql: str, params: Iterable[Any] = ()) -> int:
    """Run a write statement and return the last inserted row id."""
    conn = get_connection()
    with _write_lock:
        cur = conn.execute(sql, tuple(params))
        conn.commit()
        try:
            return int(cur.lastrowid)
        finally:
            cur.close()


def execute_many(sql: str, seq_of_params: Iterable[Iterable[Any]]) -> None:
    conn = get_connection()
    with _write_lock:
        conn.executemany(sql, [tuple(p) for p in seq_of_params])
        conn.commit()


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row is not None else None


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
