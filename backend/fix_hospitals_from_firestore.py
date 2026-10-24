import json
import os
import re
import sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_PATH = r"C:\Users\Arslan\Desktop\Aazaz\firestore_backup.json"
DB_PATH = os.path.join(BASE_DIR, "data", "doctor_app.db")

def norm_email(e):
    if not e:
        return None
    return str(e).strip().lower()

def main():
    print("[*] Loading firestore_backup.json...")
    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    doctors = data.get("doctors", {}) or {}
    updated = 0
    for did, d in doctors.items():
        name = d.get("doctorName") or d.get("name") or d.get("urduName")
        if not name:
            continue
        name = str(name).strip()
        email_n = norm_email(d.get("email"))

        hospital = ""
        clinics = d.get("clinics")
        if isinstance(clinics, list) and clinics:
            for c in clinics:
                if isinstance(c, dict):
                    hname = c.get("clinicName") or c.get("hospitalName") or c.get("name")
                    if hname and hname.strip():
                        hospital = str(hname).strip()
                        break

        if not hospital and isinstance(d.get("opd"), dict):
            for k, v in d["opd"].items():
                if isinstance(v, dict):
                    hname = v.get("hospitalName") or v.get("clinicName")
                    if hname and str(hname).strip():
                        hospital = str(hname).strip()
                        break

        if not hospital:
            continue

        row = None
        if email_n:
            row = cur.execute("SELECT id FROM doctors WHERE lower(email)=?", (email_n,)).fetchone()
        if not row:
            row = cur.execute("SELECT id FROM doctors WHERE lower(trim(name))=lower(trim(?))", (name,)).fetchone()
        if not row:
            continue

        cur.execute("UPDATE doctors SET hospital = ?, updated_at = ? WHERE id = ?", (hospital, now, row['id']))
        updated += cur.rowcount

    conn.commit()
    conn.close()
    print(f"[DONE] Updated hospital for {updated} doctors")

if __name__ == "__main__":
    main()
