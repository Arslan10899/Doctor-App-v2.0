"""
Hospital media seed for fresh deployments (e.g. Render free tier).

The panel stores hospital cover / profile images in the `hospital_media`
table (SQLite) plus the `backend/uploads/hospitals` directory. Neither the
SQLite database nor that directory is rebuilt by the Firestore backup
import, so on a fresh cloud deployment the directory cards would lose
their covers.

The matching image files are committed to git (small, ~2 MB total); this
module re-links them into `hospital_media` the first time the database
boots with the table still empty.
"""

from __future__ import annotations

import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads", "hospitals")

# --------------------------------------------------------------------------- #
# data/firestore_backup.json hospitals (stable Firestore source_id keys)
# --------------------------------------------------------------------------- #
SEED: list[dict[str, str]] = [
    {
        "source_id": "9W9EfDy2eF6rr9G69PeT",  # Mufti Mahmood Memorial Hospital
        "cover_url": "/uploads/hospitals/e18b9031d19e4c21bcb16fce25cad195.jpg",
        "profile_url": "/uploads/hospitals/0eef32ecdb374521a855590e9a604407.jpg",
    },
    {
        "source_id": "EF4Je2vs9hKE8Q36okIG",  # D.H.Q. Civil Hospital
        "cover_url": "/uploads/hospitals/64ef66e5f5f74978823523552836b00e.jpg",
        "profile_url": "/uploads/hospitals/4a19cced38534447a243f9133b600704.jpg",
    },
    {
        "source_id": "VglqOWDnMnsfP2l6yFO2",  # D.H.Q. Hospital, Tank
        "cover_url": "/uploads/hospitals/16a6c7cbc4cc47f285838059480cc527.jpg",
        "profile_url": "/uploads/hospitals/5b24a06037134ea9b2e6cd185dc06d23.jpg",
    },
    {
        "source_id": "WZ9JGxg0GXMzWYPzzXdJ",  # D.H.Q. Hospital Wana
        "cover_url": "/uploads/hospitals/4227ed58f6244dacb3e6fe01dc06b09c.png",
        "profile_url": "/uploads/hospitals/e66ac20529a34d11b06bca0ac722e253.jpg",
    },
    {
        "source_id": "XjcUUQdXSnKN0YTxF2Z9",  # Institute of Kidney Diseases
        "cover_url": "/uploads/hospitals/9948f5a3bd924b01af4418280fa06d5f.jpg",
        "profile_url": "/uploads/hospitals/995976e18d1642ada61426f35eeca64d.jpg",
    },
    {
        "source_id": "ZCr2bu4QzZbPP9oCgpEY",  # Women & Child Hospital
        "cover_url": "/uploads/hospitals/cb67055ae4574b86a45666e03f57f7b9.jpg",
        "profile_url": "/uploads/hospitals/642c1829fd774b67bea1c0a2cb1607a4.jpg",
    },
    {
        "source_id": "bBLUoiK5mIABYPX5qQyY",  # Mehmood Eye Hospital
        "cover_url": "/uploads/hospitals/9eeb9ba5e6264bc7824fd12d15808bf2.jpg",
        "profile_url": "/uploads/hospitals/39598385d0674784a44d057897ea9985.jpg",
    },
    {
        "source_id": "kJ38gklTq8kZk13OKEP9",  # Lady Reading Hospital
        "cover_url": "/uploads/hospitals/c9e5ef2f9d3640ddb598fe3ad508b2f0.jpg",
        "profile_url": "/uploads/hospitals/45d654df737c47348868a2b626b990dd.jpg",
    },
    {
        "source_id": "oCZ3f7MV2bz4NNcC9ZAG",  # Govt Hospital Paharpur
        "cover_url": "/uploads/hospitals/cbd24c57900842faa1497607a6fb80cb.jpg",
        "profile_url": "/uploads/hospitals/bfed538ecbc342f3ad95aeb3b3dfe8b6.jpg",
    },
]


def _file_exists(url: str) -> bool:
    """`url` looks like /uploads/hospitals/<name>. BASE_DIR is the backend
    directory, so "/uploads/..." maps onto it (absolute -> cwd independent)."""
    rel = url.lstrip("/").replace("/", os.sep)
    return os.path.isfile(os.path.join(BASE_DIR, rel))


def apply_if_empty() -> int:
    """Insert the seed rows only when `hospital_media` is completely empty.
    Returns the number of rows inserted (0 when the table already has data
    or nothing useful to insert)."""
    import database

    conn = database.get_connection()
    try:
        row = conn.execute("SELECT COUNT(*) FROM hospital_media").fetchone()
        if row[0]:
            return 0

        inserted = 0
        for entry in SEED:
            cover_ok = _file_exists(entry["cover_url"])
            profile_ok = _file_exists(entry["profile_url"])
            if not (cover_ok or profile_ok):
                continue
            conn.execute(
                """
                INSERT OR REPLACE INTO hospital_media
                    (source_id, profile_url, cover_url, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                """,
                (
                    entry["source_id"],
                    entry["profile_url"] if profile_ok else None,
                    entry["cover_url"] if cover_ok else None,
                ),
            )
            inserted += 1
        conn.commit()
        return inserted
    finally:
        conn.close()
