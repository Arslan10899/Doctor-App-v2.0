import json
import time
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8010/api"


def call(path, method="GET", body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


# wait for the server
last = None
for _ in range(40):
    try:
        call("/health")
        break
    except Exception as exc:  # noqa: BLE001
        last = exc
        time.sleep(0.5)
else:
    raise SystemExit("server not up: %r" % last)

login = call("/auth/login", "POST", {"email": "admin@doctorapp.com", "password": "admin123"})
token = login["token"]
print("login ok")

page = call("/doctors?limit=1", token=token)
doctor_id = page["items"][0]["id"]
original = call(f"/doctors/{doctor_id}", token=token)
print("doctor:", doctor_id, original["name"])

keys = [
    "urdu_name", "whatsapp", "opd_info", "ot_schedule", "diseases",
    "clinics_json", "timings_json", "views_count", "total_calls",
    "sehat_card_empaneled", "profile_activity", "doctors_message",
]
print("payload keys present:", all(k in original for k in keys))

# --- round trip: write a marker into doctors_message and a clinic list
test_clinics = [
    {
        "clinicName": "TEST CLINIC",
        "address": "Test address, D.I. Khan",
        "timings": {
            "Monday": {"isClosed": False, "open": "2:00 PM", "close": "8:00 PM"},
            "Tuesday": {"isClosed": True, "open": "", "close": ""},
        },
    }
]
test_ot = [
    {
        "hospitalCity": "Dera Ismail Khan",
        "hospitalName": "TEST HOSPITAL",
        "specialty": "Surgery",
        "days": ["Monday", "Wednesday"],
        "time": "8:00 PM - 2:00 PM",
        "yesNo": "Yes",
    }
]
payload = {
    "doctors_message": "TEST MARKER MESSAGE",
    "clinics_json": json.dumps(test_clinics, ensure_ascii=False),
    "timings_json": json.dumps(test_clinics[0]["timings"], ensure_ascii=False),
    "ot_schedule": json.dumps(test_ot, ensure_ascii=False),
    "opd_info": json.dumps(
        {
            "hospitalName": "TEST OPD",
            "specialty": "Surgery",
            "days": ["Tuesday"],
            "time": "08:00 AM - 01:00 PM",
            "yesNo": "Yes",
        },
        ensure_ascii=False,
    ),
    "sehat_card_empaneled": 1,
    "views_count": 4242,
}
updated = call(f"/doctors/{doctor_id}", "PUT", payload, token=token)

ok = (
    updated["doctors_message"] == "TEST MARKER MESSAGE"
    and json.loads(updated["clinics_json"])[0]["clinicName"] == "TEST CLINIC"
    and json.loads(updated["ot_schedule"])[0]["hospitalName"] == "TEST HOSPITAL"
    and json.loads(updated["opd_info"])["hospitalName"] == "TEST OPD"
    and updated["sehat_card_empaneled"] == 1
    and updated["views_count"] == 4242
)
print("UPDATE persisted:", ok)

# --- also test dict (not string) payload acceptance
updated2 = call(
    f"/doctors/{doctor_id}",
    "PUT",
    {"ot_schedule": [{"hospitalName": "DICT FORM", "days": ["Friday"], "time": "10:00 AM - 1:00 PM"}],
     "clinics_json": [{"clinicName": "DICT CLINIC", "address": "x", "timings": {}}]},
    token=token,
)
ok2 = (
    json.loads(updated2["ot_schedule"])[0]["hospitalName"] == "DICT FORM"
    and json.loads(updated2["clinics_json"])[0]["clinicName"] == "DICT CLINIC"
)
print("dict payload accepted:", ok2)

# --- restore original values
restore = {k: original[k] for k in keys if original.get(k) is not None}
restored = call(f"/doctors/{doctor_id}", "PUT", restore, token=token)
print("restored message:", restored["doctors_message"] == original["doctors_message"],
      "| restored clinics:", restored["clinics_json"] == original["clinics_json"],
      "| restored views:", restored["views_count"] == original["views_count"],
      "| restored sehat:", restored["sehat_card_empaneled"] == original["sehat_card_empaneled"])
