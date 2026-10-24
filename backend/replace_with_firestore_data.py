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

def slug_email(name, did):
    slug = re.sub(r'[^a-z0-9]+', '', str(name).lower())[:25]
    if not slug:
        slug = str(did).lower()[:10]
    return f"{slug}@realdoctors.local"

def main():
    print("[*] Loading firestore_backup.json...")
    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("[*] Connecting to:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Disable FKs so we can clear cleanly
    cur.execute("PRAGMA foreign_keys = OFF")
    conn.commit()

    print("[*] Removing fake/demo data (appointments, payments, patients, doctors)...")
    cur.execute("DELETE FROM appointments")
    cur.execute("DELETE FROM payments")
    cur.execute("DELETE FROM patients")
    cur.execute("DELETE FROM doctors")
    conn.commit()

    cur.execute("PRAGMA foreign_keys = ON")
    conn.commit()

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1) Specialties -> departments
    print("[*] Syncing specialties to departments...")
    dept_set = set()
    for coll in ["specialties", "opd-specialties"]:
        if coll in data and isinstance(data[coll], dict):
            for sid, sp in data[coll].items():
                name = sp.get("name") or sp.get("specialty") or sp.get("title")
                if not name:
                    continue
                name = str(name).strip()
                if not name:
                    continue
                dept_set.add(name)

    for name in sorted(dept_set):
        try:
            cur.execute("INSERT OR IGNORE INTO departments (name, icon, color, created_at) VALUES (?,?,?,?)",
                        (name, "stethoscope", "chart-1", now))
        except Exception as e:
            print("   [dept err]", e)

    conn.commit()
    print(f"   -> Done. Total departments now: {cur.execute('SELECT COUNT(*) FROM departments').fetchone()[0]}")

    # 2) Import real doctors
    print("[*] Importing real doctors from backup...")
    doc_added = 0
    doc_dup = 0

    doctors = data.get("doctors", {}) or {}
    for did, d in doctors.items():
        name = d.get("doctorName") or d.get("name") or d.get("urduName")
        if not name:
            continue
        name = str(name).strip()

        email = d.get("email")
        if not email:
            email = slug_email(name, did)

        phone = d.get("phone") or d.get("whatsappNumber") or d.get("mobile") or ""
        specialty = d.get("specialty") or ""
        qualification = d.get("qualification") or ""
        exp = parse_exp_years(d.get("experience"))
        fee = safe_float(d.get("fee") or d.get("consultationFee") or d.get("consultation_fee"))
        rating = safe_float(d.get("rating"))
        gender = d.get("gender") or ""
        city = d.get("city") or d.get("hospitalCity") or ""

        avatar = d.get("imageUrl") or d.get("avatarUrl") or d.get("photoUrl") or d.get("profilePic") or None

        bio = d.get("doctorsMessage") or d.get("about") or d.get("bio") or None

        hospital = ""
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

        try:
            cur.execute("""
                INSERT OR IGNORE INTO doctors
                (name, email, phone, specialty, qualification, experience_years, hospital, city, country,
                 consultation_fee, rating, total_patients, status, gender, bio, avatar_url, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                name,
                email,
                phone,
                specialty,
                qualification,
                exp,
                hospital,
                city,
                "Pakistan",
                fee,
                rating,
                0,
                "Active",
                gender,
                bio,
                avatar,
                now,
                now
            ))
            if cur.rowcount > 0:
                doc_added += 1
            else:
                doc_dup += 1
        except Exception as e:
            print("   [doctor err]", did, e)
            doc_dup += 1

    conn.commit()
    conn.close()

    print(f"   -> Added: {doc_added} | Skipped (duplicate/email): {doc_dup}")
    print("\n[DONE] Fake data removed and real doctors imported from firestore_backup.json")
    print(f"DB: {DB_PATH}")
    print("Ab app kholo, Doctors page par real data dikh raha hoga.")

if __name__ == "__main__":
    main()
