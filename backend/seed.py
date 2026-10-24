"""
Seed the SQLite database with realistic demo data.

Run with::

    python backend/seed.py            # only seeds when the DB is empty
    python backend/seed.py --reset    # wipes everything and re-seeds
"""

from __future__ import annotations

import os
import random
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import database as db  # noqa: E402

random.seed(2026)

DEPARTMENTS = [
    ("Cardiology", "heart-pulse", "chart-1", "Heart and blood vessel related care."),
    ("Neurology", "brain", "chart-3", "Brain, spine and nervous system treatment."),
    ("Orthopedics", "bone", "chart-2", "Bone, joint and muscle specialists."),
    ("Pediatrics", "baby", "chart-4", "Healthcare for infants and children."),
    ("Dermatology", "sparkles", "chart-5", "Skin, hair and nail conditions."),
    ("Gynecology", "female", "chart-2", "Women's health and obstetrics."),
    ("ENT", "ear", "chart-3", "Ear, nose and throat care."),
    ("Dentistry", "smile", "chart-1", "Dental and oral health services."),
]

DOCTORS = [
    # name, email, phone, specialty, qualification, exp, hospital, city, fee, rating, status, gender
    ("Dr. Ayesha Khan", "ayesha.khan@doctorapp.pk", "+92 300 2145566", "Cardiology",
     "MBBS, FCPS (Cardiology)", 12, "Hameed Medical Complex", "Lahore", 4500, 4.9, "Active", "Female"),
    ("Dr. Bilal Ahmed", "bilal.ahmed@doctorapp.pk", "+92 321 7788990", "Neurology",
     "MBBS, MD (Neurology)", 15, "City Neuro Centre", "Karachi", 6000, 4.8, "Active", "Male"),
    ("Dr. Hina Aslam", "hina.aslam@doctorapp.pk", "+92 333 1020304", "Pediatrics",
     "MBBS, FCPS (Pediatrics)", 9, "Little Angels Hospital", "Lahore", 3000, 4.9, "Active", "Female"),
    ("Dr. Usman Tariq", "usman.tariq@doctorapp.pk", "+92 301 4455667", "Orthopedics",
     "MBBS, MS (Orthopedics)", 18, "Ortho Care Hospital", "Islamabad", 5500, 4.7, "Active", "Male"),
    ("Dr. Sana Malik", "sana.malik@doctorapp.pk", "+92 345 6677889", "Dermatology",
     "MBBS, FCPS (Dermatology)", 7, "Skin & Laser Clinic", "Karachi", 3500, 4.6, "Active", "Female"),
    ("Dr. Kamran Ali", "kamran.ali@doctorapp.pk", "+92 322 3344556", "ENT",
     "MBBS, DLO (ENT)", 11, "Al-Noor Hospital", "Multan", 2800, 4.4, "On Leave", "Male"),
    ("Dr. Mariam Yousaf", "mariam.yousaf@doctorapp.pk", "+92 336 9900112", "Gynecology",
     "MBBS, FCPS (Gynae)", 13, "Hakeem Hospital", "Peshawar", 4000, 4.8, "Active", "Female"),
    ("Dr. Ahmed Raza", "ahmed.raza@doctorapp.pk", "+92 311 2233445", "Dentistry",
     "BDS, FCPS (Dentistry)", 8, "Smile Dental Studio", "Lahore", 2000, 4.5, "Active", "Male"),
    ("Dr. Zohaib Iqbal", "zohaib.iqbal@doctorapp.pk", "+92 313 5566778", "Cardiology",
     "MBBS, FCPS (Cardiology)", 6, "Iqbal General Hospital", "Rawalpindi", 4200, 4.3, "Active", "Male"),
    ("Dr. Nadia Sheikh", "nadia.sheikh@doctorapp.pk", "+92 332 4455667", "Neurology",
     "MBBS, MD (Neurology)", 10, "Sheikh Neuro Clinic", "Karachi", 5200, 4.6, "Active", "Female"),
    ("Dr. Fahad Iqbal", "fahad.iqbal@doctorapp.pk", "+92 300 9988776", "Orthopedics",
     "MBBS, MS (Orthopedics)", 14, "Iqbal Ortho Institute", "Lahore", 4800, 4.5, "Active", "Male"),
    ("Dr. Rabia Noor", "rabia.noor@doctorapp.pk", "+92 334 7766554", "Pediatrics",
     "MBBS, FCPS (Pediatrics)", 5, "Kids Care Clinic", "Multan", 2800, 4.7, "Inactive", "Female"),
    ("Dr. Yasir Mahmood", "yasir.mahmood@doctorapp.pk", "+92 335 1212121", "ENT",
     "MBBS, FCPS (ENT)", 9, "Mahmood Hospital", "Islamabad", 3200, 4.4, "Active", "Male"),
    ("Dr. Komal Pervaiz", "komal.pervaiz@doctorapp.pk", "+92 342 3434343", "Dermatology",
     "MBBS, FCPS (Dermatology)", 4, "Pervaiz Skin Care", "Lahore", 3000, 4.2, "Active", "Female"),
    ("Dr. Imran Sabir", "imran.sabir@doctorapp.pk", "+92 305 5656565", "Cardiology",
     "MBBS, DPhil (Cardiology)", 20, "Sabir Heart Institute", "Karachi", 8000, 5.0, "Active", "Male"),
    ("Dr. Sadia Nadeem", "sadia.nadeem@doctorapp.pk", "+92 337 2323232", "Gynecology",
     "MBBS, FCPS (Gynae)", 16, "Nadeem Hospital", "Lahore", 4500, 4.8, "Active", "Female"),
]

PATIENTS = [
    ("Ahmed Raza", "ahmed.raza@example.com", "+92 300 1112223", 34, "Male", "B+", "Bahawalpur"),
    ("Fatima Khan", "fatima.khan@example.com", "+92 301 3334445", 28, "Female", "O+", "Lahore"),
    ("Muhammad Ali", "m.ali@example.com", "+92 302 5556667", 51, "Male", "A+", "Karachi"),
    ("Ayesha Siddiqui", "ayesha.s@example.com", "+92 303 7778889", 23, "Female", "AB+", "Islamabad"),
    ("Hassan Mehmood", "hassan.m@example.com", "+92 304 9990001", 45, "Male", "O-", "Multan"),
    ("Zainab Tariq", "zainab.tariq@example.com", "+92 305 1212345", 37, "Female", "B-", "Peshawar"),
    ("Bilal Ahmed", "bilal.ahmed@example.com", "+92 306 3434343", 19, "Male", "A-", "Lahore"),
    ("Sana Yousaf", "sana.yousaf@example.com", "+92 307 5656565", 62, "Female", "O+", "Rawalpindi"),
    ("Omar Farooq", "omar.farooq@example.com", "+92 308 7878787", 41, "Male", "B+", "Karachi"),
    ("Komal Rashid", "komal.rashid@example.com", "+92 309 9090909", 30, "Female", "A+", "Lahore"),
    ("Ali Zaidi", "ali.zaidi@example.com", "+92 310 1212121", 55, "Male", "O-", "Quetta"),
    ("Hina Qureshi", "hina.q@example.com", "+92 311 3434343", 26, "Female", "AB-", "Multan"),
    ("Danish Anwar", "danish.anwar@example.com", "+92 312 5656565", 48, "Male", "B+", "Sialkot"),
    ("Maham Iqbal", "maham.iqbal@example.com", "+92 313 7878787", 22, "Female", "O+", "Lahore"),
    ("Tariq Javed", "tariq.javed@example.com", "+92 314 9090909", 67, "Male", "A+", "Multan"),
    ("Iqra Bibi", "iqra.bibi@example.com", "+92 315 2121212", 39, "Female", "B-", "Karachi"),
    ("Shahzad Khan", "shahzad.k@example.com", "+92 316 4343434", 33, "Male", "O+", "Peshawar"),
    ("Neelam Aslam", "neelam.a@example.com", "+92 317 6565656", 58, "Female", "A-", "Islamabad"),
    ("Waqas Ahmed", "waqas.ahmed@example.com", "+92 318 8787878", 29, "Male", "AB+", "Lahore"),
    ("Ruqayyah Bano", "ruqayyah.b@example.com", "+92 319 0909090", 44, "Female", "B+", "Faisalabad"),
    ("Junaid Akram", "junaid.akram@example.com", "+92 320 2323232", 35, "Male", "O-", "Karachi"),
    ("Sadia Rehman", "sadia.rehman@example.com", "+92 321 4545454", 50, "Female", "A+", "Rawalpindi"),
]

REASONS = [
    "Routine check-up and consultation",
    "Chest pain and breathing difficulty",
    "Fever with body aches since 4 days",
    "Skin allergy and itching",
    "Follow-up visit for blood pressure",
    "Knee joint pain while walking",
    "Headache and migraine review",
    "Child vaccination schedule",
    "Dental cleaning and cavity filling",
    "Antenatal check-up",
    "Hearing loss in left ear",
    "Post-operative review",
]

TIME_SLOTS = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "12:00 PM", "01:00 PM", "01:30 PM", "02:00 PM", "03:00 PM", "04:00 PM",
    "05:00 PM", "06:00 PM", "07:00 PM",
]

STATUS_WEIGHTS = [
    ("Completed", 0.46),
    ("Scheduled", 0.26),
    ("Pending", 0.16),
    ("Cancelled", 0.12),
]


def _weighted_status() -> str:
    r = random.random()
    cumulative = 0.0
    for label, weight in STATUS_WEIGHTS:
        cumulative += weight
        if r <= cumulative:
            return label
    return "Completed"


def reset_database() -> None:
    conn = db.get_connection()
    with db._write_lock:
        conn.executescript(
            "DELETE FROM payments;"
            "DELETE FROM appointments;"
            "DELETE FROM patients;"
            "DELETE FROM doctors;"
            "DELETE FROM departments;"
            "DELETE FROM users;"
        )
        conn.commit()


def seed(force: bool = False) -> None:
    db.init_db()

    existing = db.query_one("SELECT COUNT(*) AS c FROM doctors")
    if existing and existing["c"] > 0 and not force:
        print(f"[seed] database already has {existing['c']} doctors - nothing to do.")
        return

    if force:
        reset_database()

    # ------------------------------------------------------------------
    # Departments
    # ------------------------------------------------------------------
    for name, icon, color, description in DEPARTMENTS:
        db.execute(
            "INSERT OR IGNORE INTO departments (name, icon, color, description) VALUES (?,?,?,?)",
            (name, icon, color, description),
        )

    # ------------------------------------------------------------------
    # Admin user (password: admin123)
    # ------------------------------------------------------------------
    import hashlib

    def _hash(pwd: str) -> str:
        return hashlib.sha256(f"doctor-app::{pwd}".encode()).hexdigest()

    db.execute(
        "INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?,?,?,?)",
        ("Admin", "admin@doctorapp.com", _hash("admin123"), "admin"),
    )

    # ------------------------------------------------------------------
    # Doctors
    # ------------------------------------------------------------------
    doctor_ids: list[int] = []
    doctor_fees: dict[int, float] = {}
    for (
        name, email, phone, specialty, qualification, exp, hospital, city,
        fee, rating, status, gender,
    ) in DOCTORS:
        bio = (
            f"{name} is a highly experienced {specialty.lower()} consultant with {exp} years "
            f"of clinical practice at {hospital}. Known for a patient-first approach and "
            f"evidence based treatment planning."
        )
        created = datetime.now() - timedelta(days=random.randint(40, 900))
        doctor_ids.append(
            db.execute(
                """
                INSERT INTO doctors
                    (name, email, phone, specialty, qualification, experience_years, hospital,
                     city, country, consultation_fee, rating, total_patients, status, gender, bio,
                     avatar_url, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    name, email, phone, specialty, qualification, exp, hospital, city,
                    "Pakistan", fee, rating, 0, status, gender, bio, None,
                    created.isoformat(timespec="seconds"), created.isoformat(timespec="seconds"),
                ),
            )
        )
        doctor_fees[doctor_ids[-1]] = fee

    # ------------------------------------------------------------------
    # Patients
    # ------------------------------------------------------------------
    patient_ids: list[int] = []
    for (name, email, phone, age, gender, blood, city) in PATIENTS:
        created = datetime.now() - timedelta(days=random.randint(5, 720))
        patient_ids.append(
            db.execute(
                """
                INSERT INTO patients
                    (name, email, phone, age, gender, blood_group, address, city, created_at)
                VALUES (?,?,?,?,?,?,?,?,?)
                """,
                (
                    name, email, phone, age, gender, blood, f"{random.randint(1, 90)} Street, {city}",
                    city, created.isoformat(timespec="seconds"),
                ),
            )
        )

    # ------------------------------------------------------------------
    # Appointments – 14 months of history so the charts have real data
    # ------------------------------------------------------------------
    today = date.today()
    payments: list[tuple] = []
    doctor_counts = {d: 0 for d in doctor_ids}

    start = today - timedelta(days=420)
    day = start
    while day <= today:
        # Weekends are busier in a clinic, and the trend grows over time.
        base = 6 if day.weekday() < 5 else 9
        growth = 1 + (420 - (day - start).days) / 420 * 0.9
        count = max(2, int(random.gauss(base * growth, 2.4)))

        for _ in range(count):
            doctor_id = random.choice(doctor_ids)
            patient_id = random.choice(patient_ids)
            status = _weighted_status()
            fee = doctor_fees[doctor_id]
            slot = random.choice(TIME_SLOTS)
            reason = random.choice(REASONS)

            appt_id = db.execute(
                """
                INSERT INTO appointments
                    (patient_id, doctor_id, appointment_date, time_slot, reason, fee,
                     status, payment_status, created_at)
                VALUES (?,?,?,?,?,?,?,?,?)
                """,
                (
                    patient_id, doctor_id, day.isoformat(), slot, reason, fee, status,
                    "Paid" if status == "Completed" else random.choice(["Unpaid", "Unpaid", "Paid"]),
                    datetime.now().isoformat(timespec="seconds"),
                ),
            )

            doctor_counts[doctor_id] += 1

            if status == "Completed":
                payments.append(
                    (
                        doctor_id,
                        fee,
                        random.choice(["Cash", "JazzCash", "Easypaisa", "Card", "Bank Transfer"]),
                        "Paid",
                        datetime.combine(day, datetime.min.time()).isoformat(timespec="seconds"),
                        f"Appointment #{appt_id}",
                    )
                )

        day += timedelta(days=1)

    if payments:
        db.execute_many(
            "INSERT INTO payments (doctor_id, amount, method, status, paid_at, notes) VALUES (?,?,?,?,?,?)",
            payments,
        )

    for doctor_id, count in doctor_counts.items():
        db.execute("UPDATE doctors SET total_patients = ? WHERE id = ?", (count, doctor_id))

    print(
        "[seed] done ->",
        f"{len(doctor_ids)} doctors,",
        f"{len(patient_ids)} patients,",
        f"{db.query_one('SELECT COUNT(*) c FROM appointments')['c']} appointments,",
        f"{len(payments)} payments.",
    )


if __name__ == "__main__":
    seed(force="--reset" in sys.argv)
