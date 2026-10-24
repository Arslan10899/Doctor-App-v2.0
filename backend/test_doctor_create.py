import json
import urllib.request

BASE = "http://127.0.0.1:8010/api"


def call(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8")
        return resp.status, (json.loads(raw) if raw else None)


_, login = call("/auth/login", "POST", {"email": "admin@doctorapp.com", "password": "admin123"})
token = login["token"]

payload = {
    "name": "Dr Temp Create Test",
    "email": "temp.create.test@realdoctors.local",
    "specialty": "General Physician",
    "phone": "+920000000000",
    "city": "Dera Ismail Khan",
    "country": "Pakistan",
    "consultation_fee": 100,
    "rating": 4.2,
    "status": "Active",
    "gender": "Male",
    "urdu_name": "ٹیسٹ",
    "whatsapp": "+920000000000",
    "opd_info": {"hospitalName": "Test Hospital", "days": ["Monday"], "time": "9-1", "yesNo": "Yes"},
    "ot_schedule": [{"hospitalName": "OT Test", "days": ["Friday"], "time": "6-9", "yesNo": "Yes"}],
    "clinics_json": [{"clinicName": "C1", "address": "A1", "timings": {"Monday": {"isClosed": False, "open": "9:00 AM", "close": "1:00 PM"}}}],
    "timings_json": {"Monday": {"isClosed": False, "open": "9:00 AM", "close": "1:00 PM"}},
    "diseases": "Fever, Flu",
    "views_count": 7,
    "total_calls": 3,
    "sehat_card_empaneled": 1,
    "doctors_message": "Hello",
}

status, created = call("/doctors", "POST", payload, token=token)
print("create status:", status, "id:", created.get("id"))
checks = {
    "urdu_name": created.get("urdu_name") == "ٹیسٹ",
    "opd is json": json.loads(created.get("opd_info") or "{}").get("hospitalName") == "Test Hospital",
    "ot is json": json.loads(created.get("ot_schedule") or "[]")[0].get("hospitalName") == "OT Test",
    "clinics": json.loads(created.get("clinics_json") or "[]")[0].get("clinicName") == "C1",
    "views": created.get("views_count") == 7,
    "sehat": created.get("sehat_card_empaneled") == 1,
    "message": created.get("doctors_message") == "Hello",
}
print("create fields correct:", checks)

status, _ = call(f"/doctors/{created['id']}", "DELETE", token=token)
print("delete status:", status)
status, _ = call("/doctors?search=Temp%20Create%20Test", token=token)
print("remaining matches:", len(_["items"]) if _ else None)
