import base64
import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8010/api"
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


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


def upload(path, token, filename, content):
    boundary = "----doctorapptest"
    body = (
        f"--{boundary}\r\n".encode()
        + f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
        + b"Content-Type: image/png\r\n\r\n"
        + content
        + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(BASE + path, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Accept", "application/json")
    req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8") or "null")


# 0. restore the display name first
_, login = call("/auth/login", "POST", {"email": "admin@doctorapp.com", "password": "admin123"})
token = login["token"]
status, me = call("/auth/me", "PUT", {"name": "Admin", "email": "admin@doctorapp.com"}, token=token)
print("name restored:", status, me["name"])

# 1. upload own avatar
status, result = upload("/auth/avatar", token, "pixel.png", PNG)
print("upload:", status, result)

status, me = call("/auth/me", token=token)
print("me avatar:", status, me.get("avatar_url"))
url = me.get("avatar_url")
full = ("http://127.0.0.1:8010" + url) if url and url.startswith("/") else url
with urllib.request.urlopen(full, timeout=15) as resp:
    print("served bytes match:", resp.read() == PNG)

# 2. remove picture via PUT /auth/me avatar_url:""
status, me = call("/auth/me", "PUT", {"name": "Admin", "email": "admin@doctorapp.com", "avatar_url": ""}, token=token)
print("remove:", status, "avatar now:", me.get("avatar_url"))

# 3. oversize guard (5 MB limit)
status, result = upload("/auth/avatar", token, "big.png", b"0" * (5 * 1024 * 1024 + 10))
print("oversize:", status, result)
