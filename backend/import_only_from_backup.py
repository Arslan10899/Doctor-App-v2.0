import json
import os
import re
import sqlite3
import sys
from datetime import datetime

# Windows consoles default to cp1252 – never let a unicode print stop
# the import (Linux hosts are UTF-8 anyway).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover – very old stdlib or non-writable fd
    pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Where the sole data source lives.  Priority:
#   1. DOCTOR_APP_BACKUP environment variable (hosting: point at the
#      bundled copy in data/firestore_backup.json)
#   2. the working copy inside the project
#   3. the original machine-local download (developer desktop)
_backup_candidates = [
    os.environ.get("DOCTOR_APP_BACKUP", ""),
    os.path.join(BASE_DIR, "data", "firestore_backup.json"),
    r"C:\Users\Arslan\Desktop\Aazaz\firestore_backup.json",
]
BACKUP_PATH = next(
    (p for p in _backup_candidates if p and os.path.isfile(p)),
    _backup_candidates[-1],
)

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

def slug_email(name, did):
    slug = re.sub(r'[^a-z0-9]+', '', str(name).lower())[:25]
    if not slug:
        slug = str(did).lower()[:10]
    return f"{slug}@realdoctors.local"

def split_hospital_name(raw):
    """Backup hospital names mix English + Urdu, e.g.
    'D.H.Q. Civil Hospital<spaces>\\tسول ہسپتال...' -> (english, urdu)."""
    s = str(raw or "").strip()
    if "\t" in s:
        en, ur = s.split("\t", 1)
        return en.strip(), ur.strip()
    m = re.search(r"[\u0600-\u06FF]", s)
    if m and m.start() > 2:
        return s[:m.start()].strip(), s[m.start():].strip()
    return s, ""

def main():
    print("[*] Reading ONLY from: " + BACKUP_PATH)
    print("[*] NOT using serviceAccountKey.json")
    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("[*] Connecting to local DB: " + DB_PATH)
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    try:
        import database  # same folder; creates the schema on a fresh DB

        database.init_db()
    except Exception as exc:  # pragma: no cover – schema may already exist
        print("   [schema]", exc)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("PRAGMA foreign_keys = OFF")
    conn.commit()

    print("[*] Removing existing web data to avoid duplicates...")
    cur.execute("DELETE FROM appointments")
    cur.execute("DELETE FROM payments")
    cur.execute("DELETE FROM patients")
    cur.execute("DELETE FROM hospital_doctors")
    cur.execute("DELETE FROM doctors")
    cur.execute("DELETE FROM departments")
    cur.execute("DELETE FROM hospital_schedules")
    cur.execute("DELETE FROM hospitals")
    cur.execute("DELETE FROM cities")
    cur.execute("DELETE FROM app_users")
    # backup's push history is wiped, but notifications sent from the
    # admin panel (origin='panel') are the admin's own data – keep them
    cur.execute("DELETE FROM notifications WHERE origin IS NULL OR origin <> 'panel'")
    cur.execute("DELETE FROM opd_specialties")
    cur.execute("DELETE FROM backup_promos")   # my_ads is the admin's own data – never wiped
    conn.commit()
    cur.execute("PRAGMA foreign_keys = ON")
    conn.commit()

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1) Specialties -> departments
    print("[*] Importing specialties/departments...")
    dept_set = set()
    for coll in ["specialties", "opd-specialties"]:
        if coll in data and isinstance(data[coll], dict):
            for sid, sp in data[coll].items():
                name = sp.get("name") or sp.get("specialty") or sp.get("title")
                if not name:
                    continue
                name = str(name).strip()
                if name:
                    dept_set.add(name)

    for name in sorted(dept_set):
        try:
            cur.execute("INSERT OR IGNORE INTO departments (name, icon, color, created_at) VALUES (?,?,?,?)",
                        (name, "stethoscope", "chart-1", now))
        except Exception as e:
            print("   [dept err]", e)

    conn.commit()
    print(f"   -> Departments: {cur.execute('SELECT COUNT(*) FROM departments').fetchone()[0]}")

    # 2) Import doctors
    print("[*] Importing ALL doctors from backup...")
    doc_added = 0
    doc_skipped = 0

    doctors = data.get("doctors", {}) or {}
    doc_row_ids = {}   # backup doc id -> local sqlite doctors.id (for doctor↔hospital links)
    for did, d in doctors.items():
        name = d.get("doctorName") or d.get("name") or d.get("urduName")
        if not name:
            continue
        name = str(name).strip()

        email = d.get("email")
        if not email:
            email = slug_email(name, did)
        email = str(email).strip()

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

        try:
            cur.execute("""
                INSERT INTO doctors
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
            doc_added += 1
            doc_row_ids[str(did)] = cur.lastrowid
        except sqlite3.IntegrityError:
            doc_skipped += 1
        except Exception as e:
            print("   [doctor err]", did, e)
            doc_skipped += 1

    conn.commit()
    conn.close()

    print(f"   -> Doctors added: {doc_added} | Skipped: {doc_skipped}")

    # 3) Cities + hospitals + OPD/OT duty schedules (appointment slots)
    print("[*] Importing cities, hospitals and hospital schedules...")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = OFF")

    city_names = {}
    for cid, c in (data.get("cities", {}) or {}).items():
        name = str(c.get("name") or "").strip()
        if name:
            city_names[name] = True
    hospitals = data.get("hospitals", {}) or {}
    for h in hospitals.values():
        c = str(h.get("hospitalCity") or "").strip()
        if c:
            city_names[c] = True
    for name in city_names:
        cur.execute("INSERT OR IGNORE INTO cities (name) VALUES (?)", (name,))
    print(f"   -> Cities: {cur.execute('SELECT COUNT(*) FROM cities').fetchone()[0]}")

    # base-name matching helper for doctor counts
    def hospital_base(raw):
        en, _ = split_hospital_name(raw)
        return en.lower()

    for hid, h in hospitals.items():
        en, ur = split_hospital_name(h.get("hospitalName"))
        city = str(h.get("hospitalCity") or "").strip()
        cur.execute(
            "INSERT OR IGNORE INTO hospitals (source_id, name, urdu_name, city) VALUES (?,?,?,?)",
            (str(hid), en or str(h.get("hospitalName")).strip(), ur or None, city or None),
        )
    print(f"   -> Hospitals: {cur.execute('SELECT COUNT(*) FROM hospitals').fetchone()[0]}")

    schedules = 0
    for hid, h in hospitals.items():
        row = cur.execute("SELECT id FROM hospitals WHERE source_id = ?", (str(hid),)).fetchone()
        if not row:
            continue
        for slot in (h.get("otSchedules") or []):
            if not isinstance(slot, dict):
                continue
            day_value = str(slot.get("day") or "").strip()
            # the backup itself contains "Tueday" – normalise so the day
            # filter on the appointments page can reach those rows
            day_value = {"tueday": "Tuesday"}.get(day_value.lower(), day_value)
            cur.execute(
                """
                INSERT INTO hospital_schedules
                (hospital_id, doctor_name, opd_specialty, day, start_time, end_time)
                VALUES (?,?,?,?,?,?)
                """,
                (
                    row["id"],
                    str(slot.get("doctorName") or "").strip() or None,
                    str(slot.get("opdSpecialty") or "").strip() or None,
                    day_value or None,
                    str(slot.get("startTime") or "").strip() or None,
                    str(slot.get("endTime") or "").strip() or None,
                ),
            )
            schedules += 1
    print(f"   -> Hospital schedule slots: {schedules}")

    # 4) Mobile app users (device tokens + registered accounts)
    print("[*] Importing mobile app users...")
    app_users = 0
    registered = 0
    for uid_key, u in (data.get("users", {}) or {}).items():
        if not isinstance(u, dict):
            continue
        device_token = str(u.get("deviceToken") or "").strip() or None
        name = str(u.get("name") or "").strip() or None
        email = str(u.get("email") or "").strip() or None
        role = str(u.get("role") or "").strip() or None
        is_reg = 1 if (name or email) else 0
        earning = safe_float(u.get("earning"))
        cur.execute(
            """
            INSERT OR IGNORE INTO app_users
            (source_id, uid, name, email, role, earning, device_token, is_registered)
            VALUES (?,?,?,?,?,?,?,?)
            """,
            (
                str(uid_key),
                str(u.get("uid") or "").strip() or None,
                name,
                email,
                role,
                earning,
                device_token,
                is_reg,
            ),
        )
        app_users += 1
        registered += is_reg
    print(f"   -> App users: {app_users} (registered: {registered}, device tokens only: {app_users - registered})")

    # 5) Push notifications shown inside the app
    print("[*] Importing notifications...")
    notif_count = 0
    for nid, n in (data.get("notifications", {}) or {}).items():
        if not isinstance(n, dict):
            continue
        cur.execute(
            """
            INSERT OR IGNORE INTO notifications
            (source_id, title, description, type, image_url, parent_notification_id,
             sent_at, admin_name, backup_updated_at, origin)
            VALUES (?,?,?,?,?,?,?,?,?, 'backup')
            """,
            (
                str(nid),
                str(n.get("title") or "").strip() or None,
                str(n.get("description") or "").strip() or None,
                str(n.get("type") or "").strip() or None,
                str(n.get("imageUrl") or "").strip() or None,
                str(n.get("parentNotificationId") or "").strip() or None,
                str(n.get("createdAt") or n.get("dateTime") or "").strip() or None,
                str(n.get("adminName") or "").strip() or None,
                str(n.get("updatedAt") or "").strip() or None,
            ),
        )
        notif_count += 1
    print(f"   -> Notifications: {notif_count}")

    # 5b) Promo content from the backup (carousel banners + promo texts),
    #     shown read-only on the My Ads page. my_ads is never touched here.
    print("[*] Importing backup promos (carousel banners + promo texts)...")
    promo_count = 0
    for pid, p in (data.get("carousel_images", {}) or {}).items():
        if not isinstance(p, dict):
            continue
        cur.execute(
            """
            INSERT OR IGNORE INTO backup_promos
            (source_id, kind, title, content, image_url, storage_path, date_from, date_to, admin_name)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                str(pid),
                "banner",
                str(p.get("title") or "").strip() or None,
                None,
                str(p.get("imageUrl") or "").strip() or None,
                str(p.get("storagePath") or "").strip() or None,
                str(p.get("from") or "").strip() or None,
                str(p.get("to") or "").strip() or None,
                None,
            ),
        )
        promo_count += 1
    for pid, p in (data.get("commercial_texts", {}) or {}).items():
        if not isinstance(p, dict):
            continue
        cur.execute(
            """
            INSERT OR IGNORE INTO backup_promos
            (source_id, kind, title, content, image_url, storage_path, date_from, date_to, admin_name)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                str(pid),
                "text",
                str(p.get("title") or "").strip() or None,
                str(p.get("content") or "").strip() or None,
                None,
                None,
                str(p.get("from") or "").strip() or None,
                str(p.get("to") or "").strip() or None,
                str(p.get("adminEmail") or "").strip() or None,
            ),
        )
        promo_count += 1
    print(f"   -> Backup promos: {promo_count}")

    # 6) OPD specialty groups exactly as the app shows them
    print("[*] Importing OPD specialties...")
    opd_count = 0
    for oid, sp in (data.get("opd-specialties", {}) or {}).items():
        if not isinstance(sp, dict):
            continue
        raw_en = str(sp.get("specialtyEnglish") or "").strip()
        en, ur_tail = split_hospital_name(raw_en)
        urdu = str(sp.get("specialtyUrdu") or "").strip() or ur_tail or None
        if not en and not urdu:
            continue
        cur.execute(
            "INSERT OR IGNORE INTO opd_specialties (source_id, name_en, name_ur) VALUES (?,?,?)",
            (str(oid), en or None, urdu),
        )
        opd_count += 1
    print(f"   -> OPD specialties: {opd_count}")

    # count doctors that reference each hospital in otSchedule / opdMap entries
    # and store the doctor ↔ hospital pairs in the link table
    doctor_refs = {}
    doctor_bases = {}   # backup doc id -> set of hospital base names referenced
    for did, d in doctors.items():
        names = []

        def collect_hospitals(obj):
            if isinstance(obj, dict):
                if "hospitalName" in obj:
                    names.append(obj.get("hospitalName"))
                for v in obj.values():
                    collect_hospitals(v)
            elif isinstance(obj, list):
                for v in obj:
                    collect_hospitals(v)

        collect_hospitals(d.get("otSchedule"))
        collect_hospitals(d.get("opdMap"))
        collect_hospitals(d.get("opd") if isinstance(d.get("opd"), (dict, list)) else None)
        bases = {hospital_base(n) for n in names if n}
        doctor_bases[str(did)] = bases
        for b in bases:
            doctor_refs[b] = doctor_refs.get(b, 0) + 1

    rows = cur.execute("SELECT id, source_id, name FROM hospitals").fetchall()
    base_to_hospital_id = {}
    for row in rows:
        raw_name = (hospitals.get(row["source_id"], {}) or {}).get("hospitalName") or row["name"]
        base_to_hospital_id[hospital_base(raw_name)] = row["id"]
        count = doctor_refs.get(hospital_base(raw_name), 0)
        cur.execute("UPDATE hospitals SET doctor_count = ? WHERE id = ?", (count, row["id"]))

    # Doctor ↔ hospital link rows (same matching the counts above use)
    links = 0
    for did, bases in doctor_bases.items():
        local_id = doc_row_ids.get(did)
        if not local_id:
            continue
        for b in bases:
            hid_row = base_to_hospital_id.get(b)
            if hid_row:
                cur.execute(
                    "INSERT OR IGNORE INTO hospital_doctors (hospital_id, doctor_id) VALUES (?,?)",
                    (hid_row, local_id),
                )
                links += 1

    # Keep directory counts consistent with the actual linked doctors
    # (a few backup rows are skipped as duplicates and have no local id).
    cur.execute(
        "UPDATE hospitals SET doctor_count = "
        "(SELECT COUNT(*) FROM hospital_doctors WHERE hospital_id = hospitals.id)"
    )
    conn.commit()
    conn.close()

    print(f"   -> Doctor counts linked to hospitals: {doctor_refs}")
    print(f"   -> Doctor-hospital link rows: {links}")

    # Fill the extended backup fields (clinics, timings, OT, OPD, diseases,
    # Sehat flag, stats...) using the same mapper as the re-sync script, so a
    # fresh install needs only this one command.
    try:
        import sync_full_doctor_data

        print("[*] Filling extended fields (clinics, OT, OPD, diseases, stats)...")
        sync_full_doctor_data.main()
    except Exception as exc:  # pragma: no cover
        print("   [sync]", exc)
        print("   Run: python backend/sync_full_doctor_data.py")

    print("\n[DONE] Only from firestore_backup.json | No serviceAccountKey used | Duplicates removed")
    print(f"DB: {DB_PATH}")
    print("Ab Doctors page par sirf backup se liya hua data dikh raha hoga.")
    print("Koi link nahi hua, sirf local file se read hua.")

if __name__ == "__main__":
    main()
