"""Smoke test: login-first flow + account (own profile) endpoints.

Run with the server already started:  python run.py --port 8010
The script restores the original name, email and password afterwards.
"""

import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8010/api"
ORIGINAL_EMAIL = "admin@doctorapp.com"
ORIGINAL_PASSWORD = "admin123"
ORIGINAL_NAME = "Admin"
TEMP_EMAIL = "temp-clash@realdoctors.local"
TEMP_PASSWORD = "newpass123"


def call(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        return exc.code, (json.loads(raw) if raw else None)


def expect(condition, label):
    passed = bool(condition)
    print(("PASS " if passed else "FAIL ") + label)
    return passed


ok = True

# 0. Safety: make sure the account uses the original password to start with.
status, probe = call("/auth/login", "POST", {"email": ORIGINAL_EMAIL, "password": ORIGINAL_PASSWORD})
if status != 200:
    status, probe = call("/auth/login", "POST", {"email": ORIGINAL_EMAIL, "password": TEMP_PASSWORD})
    if status == 200:
        call(
            "/auth/change-password",
            "POST",
            {"current_password": TEMP_PASSWORD, "new_password": ORIGINAL_PASSWORD},
            token=probe["token"],
        )
        status, probe = call("/auth/login", "POST", {"email": ORIGINAL_EMAIL, "password": ORIGINAL_PASSWORD})

ok &= expect(bool(probe and probe.get("token")), " login with demo credentials")
token = probe["token"]

# 1. Unauthenticated access is rejected (login-first enforced by the API).
ok &= expect(call("/doctors?limit=1")[0] == 401, " doctors list without token -> 401")
ok &= expect(call("/auth/me")[0] == 401, " /auth/me without token -> 401")

# 2. Current user.
status, me = call("/auth/me", token=token)
ok &= expect(status == 200 and me.get("email") == ORIGINAL_EMAIL, " /auth/me returns the user")
original_name = me["name"]
original_avatar = me.get("avatar_url")

# 3. Update name only.
status, updated = call("/auth/me", "PUT", {"name": "Admin Account", "email": ORIGINAL_EMAIL}, token=token)
ok &= expect(status == 200 and updated.get("name") == "Admin Account", " PUT /auth/me updates the name")

# 4. Switch email, then sign in with it while the password is unchanged.
status, changed = call("/auth/me", "PUT", {"name": "Admin Account", "email": TEMP_EMAIL}, token=token)
ok &= expect(status == 200 and changed.get("email") == TEMP_EMAIL, " email change works")
status, _ = call("/auth/login", "POST", {"email": TEMP_EMAIL, "password": ORIGINAL_PASSWORD})
ok &= expect(status == 200, " sign in with the new email")
status, _ = call("/auth/login", "POST", {"email": ORIGINAL_EMAIL, "password": ORIGINAL_PASSWORD})
ok &= expect(status == 401, " old email no longer accepts the login")

# 5. Validation errors.
status, _ = call("/auth/me", "PUT", {"name": "A", "email": TEMP_EMAIL}, token=token)
ok &= expect(status == 422, " too-short name -> 422")
status, _ = call("/auth/me", "PUT", {"name": "Admin Account", "email": "not-an-email"}, token=token)
ok &= expect(status == 422, " invalid email -> 422")

# 6. Password change: wrong current password is rejected.
status, _ = call(
    "/auth/change-password",
    "POST",
    {"current_password": "wrong-password", "new_password": TEMP_PASSWORD},
    token=token,
)
ok &= expect(status == 400, " wrong current password -> 400")

# 7. Correct password change, then sign in with the new password.
status, _ = call(
    "/auth/change-password",
    "POST",
    {"current_password": ORIGINAL_PASSWORD, "new_password": TEMP_PASSWORD},
    token=token,
)
ok &= expect(status == 200, " change password -> 200")
status, _ = call("/auth/login", "POST", {"email": TEMP_EMAIL, "password": ORIGINAL_PASSWORD})
ok &= expect(status == 401, " old password no longer works")
status, relogin = call("/auth/login", "POST", {"email": TEMP_EMAIL, "password": TEMP_PASSWORD})
ok &= expect(status == 200 and relogin.get("token"), " sign in with the new password + email")
token = relogin["token"]

# 8. Restore the original name, email and password.
status, _ = call(
    "/auth/me",
    "PUT",
    {"name": original_name, "email": ORIGINAL_EMAIL, "avatar_url": original_avatar or ""},
    token=token,
)
ok &= expect(status == 200, " restore name + email")
status, _ = call(
    "/auth/change-password",
    "POST",
    {"current_password": TEMP_PASSWORD, "new_password": ORIGINAL_PASSWORD},
    token=token,
)
ok &= expect(status == 200, " restore password")

status, final = call("/auth/login", "POST", {"email": ORIGINAL_EMAIL, "password": ORIGINAL_PASSWORD})
ok &= expect(status == 200, " demo login works again")

print("\n" + ("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED"))
