import json
import os
import re
import sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_PATH = r"C:\Users\Arslan\Desktop\Aazaz\firestore_backup.json"
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

def norm_email(e):
    if not e:
        return None
    return str(e).strip().lower()

def main():
    print("[*] Loading firestore_backup.json...")
    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("[*] Connecting to:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    doctors = data.get("doctors", {}) or {}
    print(f"[*] Found {len(doctors)} doctors in backup")

    updated = 0
    matched_by_email = 0
    matched_by_name = 0
    no_match = 0

    for did, d in doctors.items():
        name = d.get("doctorName") or d.get("name") or d.get("urduName")
        if not name:
            continue
        name = str(name).strip()

        email = d.get("email")
        email_n = norm_email(email)

        phone = d.get("phone") or d.get("whatsappNumber") or d.get("mobile") or None
        specialty = d.get("specialty") or None
        qualification = d.get("qualification") or None
        exp = parse_exp_years(d.get("experience"))
        fee = safe_float(d.get("fee") or d.get("consultationFee") or d.get("consultation_fee"))
        rating = safe_float(d.get("rating"))
        gender = d.get("gender") or None
        city = d.get("city") or d.get("hospitalCity") or None
        avatar = d.get("imageUrl") or d.get("avatarUrl") or d.get("photoUrl") or d.get("profilePic") or None
        bio = d.get("doctorsMessage") or d.get("about") or d.get("bio") or None

        hospital = None
        clinics = d.get("clinics")
        if isinstance(clinics, list) and clinics:
            for c in clinics:
                if isinstance(c, dict):
                    hname = c.get("hospitalName") or c.get("name")
                    if hname:
                        hospital = str(hname).strip()
                        break
        if not hospital and isinstance(d.get("opd"), dict):
            for k, v in d["opd"].items():
                if isinstance(v, dict):
                    hname = v.get("hospitalName")
                    if hname:
                        hospital = str(hname).strip()
                        break

        row = None
        if email_n:
            row = cur.execute("SELECT id, email FROM doctors WHERE lower(email)=?", (email_n,)).fetchone()
            if row:
                matched_by_email += 1

        if not row:
            # try exact name match (case-insensitive)
            row = cur.execute("SELECT id, name FROM doctors WHERE lower(trim(name))=lower(trim(?))", (name,)).fetchone()
            if row:
                matched_by_name += 1

        if not row:
            no_match += 1
            continue

        try:
            cur.execute("""
                UPDATE doctors SET
                    name = COALESCE(?, name),
                    phone = COALESCE(?, phone),
                    specialty = COALESCE(NULLIF(?,''), specialty),
                    qualification = COALESCE(NULLIF(?,''), qualification),
                    experience_years = CASE WHEN ? > 0 THEN ? ELSE experience_years END,
                    hospital = COALESCE(NULLIF(?,''), hospital),
                    city = COALESCE(NULLIF(?,''), city),
                    consultation_fee = CASE WHEN ? > 0 THEN ? ELSE consultation_fee END,
                    rating = CASE WHEN ? > 0 THEN ? ELSE rating END,
                    gender = COALESCE(?, gender),
                    bio = COALESCE(?, bio),
                    avatar_url = COALESCE(?, avatar_url),
                    updated_at = ?
                WHERE id = ?
            """, (
                name,
                phone,
                specialty or '',
                qualification or '',
                exp, exp,
                hospital or '',
                city or '',
                fee, fee,
                rating, rating,
                gender,
                bio,
                avatar,
                now,
                row['id']
            ))
            updated += cur.rowcount
        except Exception as e:
            print("   [update err]", row['id'], e)

    conn.commit()
    conn.close()

    print(f"\n[*] Matched by email: {matched_by_email}")
    print(f"[*] Matched by name:  {matched_by_name}")
    print(f"[*] No match:         {no_match}")
    print(f"[*] Rows updated:     {updated}")
    print("\n[DONE] Doctor profiles updated from firestore_backup.json")

if __name__ == "__main__":
    main()
