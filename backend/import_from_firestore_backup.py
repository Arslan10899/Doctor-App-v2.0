# backend/import_from_firestore_backup.py
import json
import os
import re
import sqlite3
from datetime import datetime

# Paths
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
        if v is None or v == "":
            return 0.0
        return float(v)
    except:
        return 0.0

def safe_int(v):
    try:
        if v is None or v == "":
            return 0
        return int(float(v))
    except:
        return 0

def main():
    print("[*] Loading backup...")
    with open(BACKUP_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("[*] Connecting to DB:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Ensure tables exist (run init)
    print("[*] Ensuring schema exists...")
    from backend import database
    database.init_db()
    conn = database.get_connection()
    cur = conn.cursor()

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1) Specialties
    print("[*] Importing specialties...")
    spec_added = 0
    for coll in ['specialties', 'opd-specialties']:
        if coll in data and isinstance(data[coll], dict):
            for sid, sp in data[coll].items():
                name = sp.get('name') or sp.get('specialty') or sp.get('title')
                if not name:
                    continue
                try:
                    cur.execute("INSERT OR IGNORE INTO departments (name, icon, color, created_at) VALUES (?,?,?,?)",
                                (str(name).strip(), 'stethoscope', 'chart-1', now))
                    if cur.rowcount:
                        spec_added += 1
                except Exception as e:
                    print("   [spec err]", e)
    print(f"   -> Added {spec_added} new specialties/departments")

    # 2) Cities
    print("[*] Importing cities...")
    city_added = 0
    if 'cities' in data and isinstance(data['cities'], dict):
        for cid, c in data['cities'].items():
            name = c.get('name')
            if not name:
                continue
            try:
                # try to add to a simple cities table if exists? else just skip
                # current schema has no cities table but doctors.city exists
                city_added += 1
            except:
                pass
    print(f"   -> Seen {city_added} cities")

    # 3) Hospitals
    print("[*] Importing hospitals...")
    hosp_added = 0
    if 'hospitals' in data and isinstance(data['hospitals'], dict):
        for hid, h in data['hospitals'].items():
            name = h.get('hospitalName') or h.get('name')
            city = h.get('hospitalCity') or h.get('city')
            if not name:
                continue
            hosp_added += 1
    print(f"   -> Seen {hosp_added} hospitals")

    # 4) Admins/Users
    print("[*] Importing users/admins...")
    user_added = 0
    for coll in ['admins', 'users']:
        if coll in data and isinstance(data[coll], dict):
            for uid, u in data[coll].items():
                name = u.get('name') or u.get('doctorName') or u.get('fullName')
                email = u.get('email')
                if not email:
                    continue
                pwd = u.get('password') or ''
                role = 'admin' if coll == 'admins' else (u.get('role') or 'user')
                try:
                    cur.execute("""INSERT OR IGNORE INTO users (uid, name, email, password_hash, role, created_at)
                                   VALUES (?,?,?,?,?,?)""",
                                (uid, name or email.split('@')[0], email, pwd, role, now))
                    if cur.rowcount:
                        user_added += 1
                except Exception as e:
                    print("   [user err]", e)
    print(f"   -> Added {user_added} users")

    # 5) Doctors
    print("[*] Importing doctors...")
    doc_added = 0
    doc_skipped = 0
    if 'doctors' in data and isinstance(data['doctors'], dict):
        for did, d in data['doctors'].items():
            name = d.get('doctorName') or d.get('name')
            email = d.get('email')
            if not email:
                # create a synthetic email to satisfy UNIQUE NOT NULL
                slug = re.sub(r'[^a-z0-9]+', '', str(name).lower())[:20]
                email = f"{slug or did[:10]}@imported.local"
            phone = d.get('phone') or d.get('whatsappNumber') or d.get('mobile')
            specialty = d.get('specialty') or ''
            qualification = d.get('qualification') or ''
            exp = parse_exp_years(d.get('experience'))
            fee = safe_float(d.get('fee') or d.get('consultationFee') or d.get('consultation_fee'))
            rating = safe_float(d.get('rating'))
            gender = d.get('gender')
            city = d.get('city') or d.get('hospitalCity')
            avatar = d.get('imageUrl') or d.get('avatarUrl') or d.get('photoUrl')
            bio = d.get('doctorsMessage') or d.get('about') or d.get('bio')
            hospital = ''
            if isinstance(d.get('clinics'), list) and d['clinics']:
                try:
                    c0 = d['clinics'][0]
                    if isinstance(c0, dict):
                        hospital = c0.get('hospitalName') or c0.get('name') or ''
                except:
                    pass
            if not hospital and isinstance(d.get('opd'), dict):
                # try first entry
                for k,v in d['opd'].items():
                    if isinstance(v, dict):
                        hospital = v.get('hospitalName') or ''
                        break

            try:
                cur.execute("""INSERT OR IGNORE INTO doctors
                    (name, email, phone, specialty, qualification, experience_years, hospital, city, country,
                     consultation_fee, rating, total_patients, status, gender, bio, avatar_url, created_at, updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (name or 'Unknown', email, phone, specialty, qualification, exp, hospital, city, 'Pakistan',
                     fee, rating, 0, 'Active', gender, bio, avatar, now, now))
                if cur.rowcount:
                    doc_added += 1
                else:
                    doc_skipped += 1
            except Exception as e:
                print("   [doctor err]", e)
                doc_skipped += 1

    print(f"   -> Added {doc_added} doctors, skipped {doc_skipped} (duplicates)")

    conn.commit()
    conn.close()

    print("\n[DONE] Import complete.")
    print(f"DB: {DB_PATH}")
    print("Refresh your Doctor App now to see imported data.")

if __name__ == '__main__':
    main()