import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "doctor_app.db")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cols = [
    ("urdu_name", "TEXT"),
    ("whatsapp", "TEXT"),
    ("opd_info", "TEXT"),
    ("ot_schedule", "TEXT"),
    ("diseases", "TEXT"),
    ("clinics_json", "TEXT"),
    ("timings_json", "TEXT"),
    ("views_count", "INTEGER DEFAULT 0"),
    ("total_calls", "INTEGER DEFAULT 0"),
    ("sehat_card_empaneled", "INTEGER DEFAULT 0"),
    ("profile_activity", "TEXT"),
    ("doctors_message", "TEXT"),
]

for name, ctype in cols:
    try:
        cur.execute(f"ALTER TABLE doctors ADD COLUMN {name} {ctype}")
        print("Added", name)
    except Exception as e:
        print("Skip", name, e)

conn.commit()
conn.close()
print("Done")
