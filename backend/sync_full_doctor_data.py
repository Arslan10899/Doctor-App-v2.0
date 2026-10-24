import json
import os
import re
import sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_PATH = r"C:\Users\Arslan\Desktop\Aazaz\firestore_backup.json"

try:  # honour DOCTOR_APP_DB like the API does
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from config import DB_PATH
except Exception:  # pragma: no cover
    DB_PATH = os.path.join(BASE_DIR, "data", "doctor_app.db")

def parse_exp_years(exp_str):
    if not exp_str:
        return 0
    s = str(exp_str).lower()
    m = re.findall(r'(\d+)', s)
    if m:
        try:
            return int(m[0])
        except:
            return 0
    return 0

def safe_float(v):
    try:
        if v in (None, ""):
            return 0.0
        return float(v)
    except:
        return 0.0

def safe_int(v):
    try:
        if v in (None, ""):
            return 0
        return int(v)
    except:
        return 0

def norm_email(e):
    if not e:
        return None
    return str(e).strip().lower()

def main():
    print("[*] Reading from firestore_backup.json (local only)")
    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    doctors = data.get("doctors", {}) or {}
    updated = 0
    touched = set()
    for did, d in doctors.items():
        name = d.get("doctorName") or d.get("name") or d.get("urduName")
        if not name:
            continue
        name = str(name).strip()
        email_n = norm_email(d.get("email"))

        phone = d.get("phone") or ""
        whatsapp = d.get("whatsappNumber") or ""
        urdu_name = d.get("urduName") or ""
        specialty = d.get("specialty") or ""
        qualification = d.get("qualification") or ""
        exp = parse_exp_years(d.get("experience"))
        fee = safe_float(d.get("fee") or d.get("consultationFee") or d.get("consultation_fee"))
        rating = safe_float(d.get("rating"))
        gender = d.get("gender") or ""
        city = d.get("city") or d.get("hospitalCity") or ""
        avatar = d.get("imageUrl") or d.get("avatarUrl") or d.get("photoUrl") or None
        bio = d.get("doctorsMessage") or d.get("about") or d.get("bio") or ""
        opd_info = json.dumps(d.get("opd"), ensure_ascii=False) if d.get("opd") is not None else ""
        diseases = d.get("diseases") or ""
        views_count = safe_int(d.get("views"))
        total_calls = safe_int(d.get("totalCalls"))
        sehat_card_empaneled = 1 if str(d.get("sehatCardEmpaneled") or "").strip().lower() == "yes" else 0
        profile_activity = json.dumps(d.get("profileActivity"), ensure_ascii=False) if d.get("profileActivity") is not None else None
        doctors_message = d.get("doctorsMessage") or ""

        ot_schedule = json.dumps(d.get("otSchedule"), ensure_ascii=False) if d.get("otSchedule") is not None else None
        clinics_json = json.dumps(d.get("clinics"), ensure_ascii=False) if d.get("clinics") is not None else None

        hospital = ""
        clinics = d.get("clinics")
        if isinstance(clinics, list) and clinics:
            for c in clinics:
                if isinstance(c, dict):
                    hname = c.get("clinicName") or c.get("hospitalName") or c.get("name")
                    if hname and str(hname).strip():
                        hospital = str(hname).strip()
                        break
        if not hospital and isinstance(d.get("opd"), dict):
            for k, v in d["opd"].items():
                if isinstance(v, dict):
                    hname = v.get("hospitalName") or v.get("clinicName")
                    if hname and str(hname).strip():
                        hospital = str(hname).strip()
                        break

        timings_json = None
        if isinstance(clinics, list) and clinics and isinstance(clinics[0], dict):
            if clinics[0].get("timings"):
                timings_json = json.dumps(clinics[0].get("timings"), ensure_ascii=False)

        row = None
        if email_n:
            row = cur.execute("SELECT id FROM doctors WHERE lower(email)=?", (email_n,)).fetchone()
        if not row:
            row = cur.execute("SELECT id FROM doctors WHERE lower(trim(name))=lower(trim(?))", (name,)).fetchone()
        if not row:
            continue

        cur.execute("""
            UPDATE doctors SET
                name = ?,
                phone = ?,
                whatsapp = ?,
                urdu_name = ?,
                specialty = ?,
                qualification = ?,
                experience_years = ?,
                hospital = ?,
                city = ?,
                consultation_fee = ?,
                rating = ?,
                gender = ?,
                bio = ?,
                doctors_message = ?,
                avatar_url = ?,
                opd_info = ?,
                ot_schedule = ?,
                diseases = ?,
                clinics_json = ?,
                timings_json = ?,
                views_count = ?,
                total_calls = ?,
                sehat_card_empaneled = ?,
                profile_activity = ?,
                updated_at = ?
            WHERE id = ?
        """, (
            name, phone, whatsapp, urdu_name, specialty, qualification, exp, hospital, city,
            fee, rating, gender, bio, doctors_message, avatar, opd_info,
            ot_schedule, diseases, clinics_json, timings_json,
            views_count, total_calls, sehat_card_empaneled, profile_activity,
            now, row['id']
        ))
        updated += cur.rowcount
        touched.add(row["id"])

    conn.commit()
    conn.close()
    print(
        f"[DONE] Applied {updated} backup records to {len(touched)} doctors "
        f"(local DB only)"
    )

if __name__ == "__main__":
    main()
