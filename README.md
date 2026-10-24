# Doctor Application

A **Shadcn Dashboard**-styled admin panel for a clinic management system, built with
plain **HTML + CSS + JavaScript** on the front end and **Python (FastAPI) + SQLite3** on
the back end.

The visual design, layout patterns and dashboard data model are taken from the
[`shadcndashboard/shadcndashboard`](https://github.com/shadcndashboard/shadcndashboard)
project (oklch design tokens, Geist fonts, collapsible sidebar, stat cards, area + doughnut
charts, data tables) — but re-implemented without React/Tailwind so that it runs anywhere
with a Python interpreter.

---

## Table of contents

- [Screens](#screens)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running the app](#running-the-app)
- [Demo credentials](#demo-credentials)
- [Database & seeding](#database--seeding)
- [API reference](#api-reference)
- [Design system](#design-system)
- [Adding Firebase (later)](#adding-firebase-later)
- [Adding Cloudinary (later)](#adding-cloudinary-later)
- [Configuration reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)

---

## Screens

| Route | File | What it does |
| --- | --- | --- |
| `/` | `frontend/index.html` | **Dashboard** – live stat cards, 12‑month appointment area chart, status doughnut chart, specialty bar chart, recent appointments table, top doctors list, export CSV |
| `/doctors.html` | `frontend/doctors.html` | **Doctors** – searchable / filterable / sortable / paginated table, add / delete, CSV export, links to the full profile and full editor |
| `/doctor-profile.html?id=…` | `frontend/doctor-profile.html` | **Doctor profile** – identity card, quick stats, full details, bio, diseases, OPD, OT schedule, clinics with weekly timings, contact links and record meta |
| `/doctor-edit.html?id=…` | `frontend/doctor-edit.html` | **Full doctor editor** – every column of the record, including repeatable clinics with per‑day timings, OT schedule rows, OPD toggle and statistics |
| `/hospitals.html` | `frontend/hospitals.html` | **Hospital directory** – large professional cards per hospital (name + Urdu + city, doctors / duty-slot metrics, specialty chips); every card opens the hospital profile |
| `/hospital-profile.html?id=…` | `frontend/hospital-profile.html` | **Hospital profile** – one hospital at a glance: stats header, every attached doctor (links into the doctor profiles) and all its OPD/OT duty slots; `#doctors` / `#slots` anchors scroll straight to the section |
| `/appointments.html` | `frontend/appointments.html` | **Appointments / duty schedule** – OPD/OT duty slots per hospital from the backup (`otSchedules`), with hospital/day filter and search; doctor names link into the Doctors page |
| `/app-users.html` | `frontend/app-users.html` | **Mobile app users** – registered accounts (name/email/role/earning) plus the FCM device-token audience; search + account-type filter + pagination + **one-click "Copy tokens"** (all 821 FCM tokens to the clipboard for a push campaign) |

| `/notifications.html` | `frontend/notifications.html` | **Push notifications** – the backup's history shows read-only cards, and the **"New notification"** button composes a fresh one (title, description, type, banner link) that is saved for the app audience; panel-sent cards carry a "Sent from panel" chip and can be deleted (two-step), backup cards never can |
| `/my-ads.html` | `frontend/my-ads.html` | **My Ads** – the admin's own ads: add / edit / delete with title, details, date range and pause/resume. Banner can be an uploaded file (max 5 MB) or a pasted link (direct image URL from any website, or a YouTube link whose thumbnail is auto-used) with live preview. Re-importing the backup never touches them. Below, the backup's promo banners + commercial texts appear as large banner-first read-only cards (kind chip overlay, date-range chips, source footer – dead Firebase banner images show a clean "Image unavailable" tile) |
| `/specialties.html` | `frontend/specialties.html` | **Specialties** – departments with doctor counts + the OPD specialty groups exactly as the app shows them (English + Urdu), linking into filtered doctor lists |
| `/account.html` | `frontend/account.html` | **Account** – the signed-in user's own profile: picture upload / remove, name + email, change password, session facts and sign‑out |
| `/login.html` | `frontend/login.html` | Sign-in screen with demo-credential helper and light/dark toggle |

Every app page (`index`, `doctors`, `doctor-profile`, `doctor-edit`, `account`) is behind
an auth gate: without a valid token the browser is redirected to `login.html`, and only
after a successful sign-in does the dashboard open. "Sign out" clears the session properly.
No fake data is seeded on a blank database – only the `admin@doctorapp.com / admin123`
login is created.

Everything on the dashboard is live data pulled from SQLite through the REST API — no
hard-coded numbers anywhere in the markup.

---

## Tech stack

**Backend**

- Python 3.10+
- [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/)
- SQLite3 via the Python standard library (`sqlite3`, WAL mode, thread-local connections)
- Pydantic v2 for request/response validation
- `python-multipart` for avatar uploads

**Frontend**

- Vanilla HTML5, CSS3 (custom properties, `oklch()` colors, container-free grid)
- Vanilla ES6+ JavaScript, no bundler, no framework, no npm
- Hand-rolled SVG charts (`frontend/js/charts.js`) — no Chart.js / Recharts
- Geist + Geist Mono fonts vendored locally in `frontend/assets/fonts`
- Lucide-style inline SVG icon set (`frontend/js/icons.js`)

**Deliberately not used:** React, Tailwind, jQuery, any chart library, any CSS framework.

---

## Project structure

```
Website/
├── run.py                       # launcher (uvicorn + convenience flags)
├── start.bat                    # one-click Windows launcher
├── README.md
├── .gitignore
│
├── backend/
│   ├── main.py                  # FastAPI app: all REST endpoints + static mounts
│   ├── config.py                # env-var driven configuration
│   ├── database.py              # SQLite schema + query helpers
│   ├── schemas.py               # Pydantic models
│   ├── seed.py                  # demo data generator
│   ├── import_only_from_backup.py   # clean wipe + import from firestore_backup.json
│   ├── sync_full_doctor_data.py     # re-sync every doctor field from the backup
│   ├── extend_doctors_schema.py     # ALTER TABLE helper for the extra doctor columns
│   ├── requirements.txt
│   └── services/
│       ├── firebase_service.py  # optional Firebase Auth adapter (stub → real)
│       └── cloudinary_service.py# optional Cloudinary image storage (stub → real)
│
├── data/
│   └── doctor_app.db            # SQLite database (created on first run)
│
└── frontend/
    ├── index.html               # Dashboard
    ├── doctors.html             # Doctors
    ├── doctor-profile.html      # Full doctor profile (view)
    ├── doctor-edit.html         # Full doctor editor (edit)
    ├── hospitals.html           # Hospital directory (bigger cards)
    ├── hospital-profile.html    # One hospital: doctors + duty slots
    ├── appointments.html        # OPD/OT duty slots (appointment details)
    ├── app-users.html           # Mobile app users + FCM device tokens
    ├── notifications.html       # Push notifications shown in the app
    ├── my-ads.html              # Admin's own ads + read-only backup promos
    ├── specialties.html         # Departments + OPD specialty groups (EN/UR)
    ├── account.html             # Own account: picture, details, password
    ├── login.html               # Login
    ├── assets/
    │   ├── fonts/               # Geist, Geist Mono (woff2)
    │   └── avatar-placeholder.svg
    ├── css/
    │   ├── theme.css            # oklch tokens, light/dark themes, base styles
    │   ├── layout.css           # app shell, sidebar, topbar, grid
    │   ├── components.css       # buttons, cards, tables, modals, badges…
    │   └── doctor-edit.css      # editor-specific layout (timings, day picker)
    └── js/
        ├── api.js               # fetch wrapper (token, error normalisation, port fallback)
        ├── utils.js             # formatting helpers (money, dates, escaping)
        ├── icons.js             # inline SVG icon set
        ├── theme.js             # light/dark theme logic
        ├── layout.js            # sidebar + topbar rendering, nav config
        ├── charts.js            # SVG area chart, doughnut chart, bar chart
        ├── dashboard.js         # Dashboard page logic
        ├── doctors.js           # Doctors page logic
        ├── doctor-profile.js    # Full profile page logic
        ├── doctor-edit.js       # Full editor page logic
        └── auth.js              # Login page logic
```

---

## Requirements

- **Python 3.10 or newer** (developed on 3.12)
- A modern browser (Chrome / Edge / Firefox)

```bash
pip install fastapi uvicorn pydantic python-multipart
```

or simply:

```bash
pip install -r backend/requirements.txt
```

---

## Installation

```bash
cd "Doctor Application v2/Website"
python -m venv .venv            # optional
pip install -r backend/requirements.txt
```

That is all — the database is created and seeded automatically the first time the server
starts.

---

## Running the app

```bash
python run.py
```

Then open **<http://127.0.0.1:8010/>**.

### Why port 8010?

Port **8000 is already occupied on this machine** by an unrelated local Python service.
The default port was therefore moved to **8010**. If you want the classic port:

```bash
python run.py --port 8000
```

### All launcher options

```bash
python run.py                      # start on http://127.0.0.1:8010
python run.py --port 8000          # start on a different port
python run.py --host 0.0.0.0       # expose on the LAN
python run.py --reload              # auto-reload on file changes
python run.py --seed               # (re)seed the database and exit
python run.py --reset              # wipe the database, re-seed, and exit
```

On Windows you can also double-click **`start.bat`**.

### Opening the pages directly

The FastAPI server serves the whole front end, so `/`, `/doctors.html` and `/login.html`
all work from `http://127.0.0.1:8010/`.

If you prefer a plain static server (e.g. Live Server on port 5500), the front end
automatically falls back to `http://<host>:8000/api` and then `:8010/api` — no code change
needed.

---

## Demo credentials

| Field | Value |
| --- | --- |
| Email | `admin@doctorapp.com` |
| Password | `admin123` |

The login page has a **“Use demo credentials”** button that fills these in for you.

> **Auth note:** the backend issues an HMAC-signed session token stored in
> `localStorage`. For demo convenience the API falls back to the first admin user when no
> token is supplied. Tighten this by removing the fallback in `current_user()`
> (`backend/main.py`) before deploying anywhere public, or switch to Firebase Auth
> (see below), which is already wired up.

---

## Deploy for free

**Recommended: Render.com** (PythonAnywhere's free plan only supports WSGI — this app is
FastAPI/ASGI, so it is not a fit; PythonAnywhere's ASGI support is beta/API-only).

1. Push this folder to a GitHub repo (the 2 MB `data/firestore_backup.json` ships with it).
2. On render.com: **New + → Blueprint** → select the repo — it reads `render.yaml`
   (npm-style one-click: `pip install -r backend/requirements.txt`, start `python run.py`).
3. Done: `https://doctor-app-admin.onrender.com`. Render injects `PORT`/`HOST` and the
   server binds them automatically; a random `DOCTOR_APP_SECRET` is generated.

How it works on a fresh host:

- the database (SQLite) is rebuilt automatically **once per boot** from
  `data/firestore_backup.json` (`_autoseed_from_backup` in `backend/main.py`, disable with
  `DOCTOR_APP_AUTOSEED=0`). `serviceAccountKey.json` is never needed.
- default login is `admin@doctorapp.com` / `admin123` — change the password on the account
  page immediately after the first deploy.

Free-plan caveats (all free hosts work this way):

| Note | Detail |
| --- | --- |
| Spin-down | after ~15 min idle the free instance sleeps; first visit warms up in ~30–60 s and the seed runs again |
| Ephemeral disk | files written at runtime (uploaded ad banners) and admin-side data (My Ads, panel-sent notifications, edited passwords/doctors) reset on restart/deploy — **use link-based banners** meanwhile, or plug Cloudinary for media |
| Persistence upgrade | a paid plan (or any host with a persistent disk, e.g. PythonAnywhere + a WSGI framework) keeps the DB file across restarts |

---

## Database & seeding

The SQLite file lives at `data/doctor_app.db` (override with `DOCTOR_APP_DB`).

**Tables**

| Table | Purpose |
| --- | --- |
| `departments` | Specialties / departments with icon + colour |
| `users` | Admin accounts (`uid` column is reserved for the Firebase uid) |
| `doctors` | Doctor profiles + all imported backup fields (see below) |
| `patients` | Patient records |
| `appointments` | Appointment book (status, fee, payment status) |
| `payments` | Revenue ledger used by the dashboard totals |

**Extra doctor columns** (imported from the backup, editable in `doctor-edit.html`)

| Column | Contents |
| --- | --- |
| `urdu_name`, `whatsapp` | Urdu spelling of the name and WhatsApp number |
| `opd_info` | JSON object with the OPD hospital, specialty, days and time (or `"No"`) |
| `ot_schedule` | JSON array of OT rows (`hospitalCity`, `hospitalName`, `specialty`, `days[]`, `time`) |
| `clinics_json` | JSON array of clinics (`clinicName`, `address`, per‑day `timings`) |
| `timings_json` | Mirror of the first clinic's timings (kept for backwards compatibility) |
| `diseases` | Conditions / procedures treated |
| `doctors_message` | Public message shown on the profile |
| `views_count`, `total_calls` | Profile statistics |
| `sehat_card_empaneled` | `1` when the doctor is Sehat Card empaneled |
| `profile_activity` | Raw activity JSON from the backup |

**Seed data** (`backend/seed.py`)

- 8 departments / specialties
- 16 doctors across 16 hospitals
- 22 patients
- ~3,900 appointments spread over 14 months (so the charts have real history)
- ~1,850 payments

Re-seed at any time:

```bash
python backend/seed.py --reset     # wipe + regenerate
python backend/seed.py              # only fill what is missing
```

### Importing the real backup data

The live database is populated **only** from a local `firestore_backup.json` file. No
network call is made and `serviceAccountKey.json` is never read, so editing the local
SQLite database can never affect the Firebase project.

```bash
python backend/import_only_from_backup.py   # wipe doctors/patients/appointments + import
python backend/sync_full_doctor_data.py     # re-sync every field for all doctors
```

`import_only_from_backup.py` clears the web data first (so no duplicates are created),
then imports all doctors and specialties from the backup **plus** the directory data:
**cities** (10), **hospitals** with English + Urdu name and city (9) and every hospital's
`otSchedules` as OPD/OT **duty slots** (23) – the appointment details the mobile app
books patients against. The data typo `Tueday` in the backup is normalised to
`Tuesday` on import. `sync_full_doctor_data.py` can
be re-run at any time to restore every doctor column from the backup file.

Current totals: **437 doctors**, **36 departments**, **29 OPD specialty groups**, **10
cities**, **9 hospitals**, **23 hospital duty slots**, **157 doctor↔hospital links**,
**826 app users** (5 registered, 821 device tokens), **9 push notifications**,
**22 backup promos** (13 carousel banners + 9 commercial texts; the banner images point at
Firebase Storage URLs that no longer resolve, so those cards show an "Image unavailable"
placeholder tile), **0 patients / booked
appointments / payments**. Four backup
entries were skipped because they duplicated an existing email or name. Static
HTML/CSS/JS is served with `Cache-Control: no-store`, so edits to the frontend show up
on a normal refresh. Admin-owned **My Ads** live in a separate `my_ads` table that a
re-import never wipes, and push notifications **sent from the panel** (`origin='panel'`)
survive a re-import too – only the backup's own history is refilled.

### API smoke tests

With the server running:

```bash
python backend/test_doctor_update.py   # GET -> PUT (string + dict blobs) -> restore
python backend/test_doctor_create.py   # POST with all extra fields -> DELETE
```

Both scripts log in with the demo admin, exercise the JSON-blob columns and clean up
after themselves (`test_doctor_update.py` restores the original values).

---

## API reference

Base URL: `http://127.0.0.1:8010/api`
Interactive docs: <http://127.0.0.1:8010/docs>

### Meta

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Status, version, database name, provider flags |
| `GET` | `/api/config` | Public app config + enabled providers |

### Auth

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/login` | `{ email, password }` → `{ token, expires_in, user }` |
| `GET` | `/api/auth/me` | Current user profile (includes `created_at`) |
| `PUT` | `/api/auth/me` | Update own name / email; sending `avatar_url: ""` removes the picture |
| `POST` | `/api/auth/change-password` | `{ current_password, new_password }` (min 6 chars) |
| `POST` | `/api/auth/avatar` | Multipart `file` upload – local disk now, Cloudinary when configured |

All `/api/*` endpoints other than `/health` and `/auth/login` require a
`Authorization: Bearer <token>` header and return **401** otherwise. The frontend
client clears the stored session and redirects to the login page once, and every
page verifies the token on load, so the dashboard never opens before sign-in.

### Dashboard

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/dashboard/stats` | All stat-card values in one call |
| `GET` | `/api/dashboard/charts/appointments?months=12` | Monthly appointment counts by status |
| `GET` | `/api/dashboard/charts/revenue?months=12` | Monthly paid revenue |
| `GET` | `/api/dashboard/charts/specialties` | Doctors + appointments per specialty |
| `GET` | `/api/dashboard/recent-appointments?limit=8` | Latest appointments |
| `GET` | `/api/dashboard/top-doctors?limit=5` | Busiest doctors by appointment count |

### Doctors

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/doctors` | Paginated list. Query: `search`, `specialty`, `status`, `hospital`, `sort_by`, `sort_dir`, `page`, `limit` |
| `GET` | `/api/doctors/{id}` | Single doctor — includes every imported field (clinics, timings, OPD, OT, stats) |
| `POST` | `/api/doctors` | Create |
| `PUT` | `/api/doctors/{id}` | Update (partial — only the fields you send). The JSON‑blob columns (`opd_info`, `ot_schedule`, `clinics_json`, `timings_json`) accept either a JSON string or a real object/array |
| `DELETE` | `/api/doctors/{id}` | Delete |
| `POST` | `/api/doctors/{id}/avatar` | `multipart/form-data` upload, field name `file` |

### Lookups, patients, appointments

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/specialties` | Departments with doctor counts |
| `GET` | `/api/hospitals` | Distinct hospital names (used by the doctors filter) |
| `GET` | `/api/hospitals/directory` | Hospital directory from the backup: name, Urdu name, city, doctor + slot counts, specialty chips |
| `GET` | `/api/hospitals/{id}` | One hospital with its attached doctors (via the doctor↔hospital link table) and all duty slots; includes `profile_image_url` / `cover_image_url` |
| `POST` | `/api/hospitals` | **Add hospital** from the panel (name required, Urdu name, city) – gets a stable `panel:` id so it survives backup re-imports; blocking duplicate names with 409 |
| `PUT` | `/api/hospitals/{id}` | Edit hospital name / Urdu name / city |
| `DELETE` | `/api/hospitals/{id}` | Delete a panel-added hospital (and its local cover/logo files, plus its city row if unused) – backup hospitals answer 403 |
| `POST` | `/api/hospitals/{id}/profile-image` | Hospital logo / profile photo upload (multipart `file`, max 5 MB; stored in `hospital_media`, survives a re-import) |
| `POST` | `/api/hospitals/{id}/cover-image` | Hospital cover / banner upload (multipart `file`, max 5 MB) – shown across the top of the profile page |
| `GET` | `/api/cities` | Cities from the backup with hospital and doctor counts |
| `GET` | `/api/hospital-schedules?hospital=…&day=…&search=…` | OPD/OT duty slots per hospital (the appointment details from the backup) |
| `GET` | `/api/app-users?search=…&registered=yes|no&page=…` | Mobile app users: registered accounts + FCM device tokens (826 total) |
| `GET` | `/api/app-users/tokens` | Every valid FCM device token – one click "Copy tokens" pastes it into a push campaign |
| `GET` | `/api/notifications?search=…&type=…&origin=backup|panel` | Push notifications: the backup's 9-card history (read-only) plus panel-sent ones on top |
| `POST` / `DELETE` | `/api/notifications` / `/api/notifications/{id}` | Send a new notification (origin `panel`, saved until FCM is plugged in) / delete – **panel rows only**, backup rows answer 403 |
| `GET` | `/api/my-ads` | The admin's own ads (title, content, image, date range, active) |
| `POST` | `/api/my-ads` | Create an ad (`title` required; content, date range, active) |
| `PUT` | `/api/my-ads/{id}` / `?remove_image` | Update an ad; a banner can also be set as a **link** – `image_url` accepts a direct image URL or a YouTube link (auto-converted to its thumbnail), an empty string clears it |
| `PATCH` | `/api/my-ads/{id}/toggle` | Flip an ad between active and paused |
| `DELETE` | `/api/my-ads/{id}` | Delete an ad (local banner file is removed too) |
| `POST` | `/api/my-ads/{id}/image` | Attach a banner image (multipart, max 5 MB; local disk until Cloudinary is on) |
| `GET` | `/api/backup-promos` | Promo banners + commercial texts from the backup (22, read-only) |
| `GET` | `/api/opd-specialties` | OPD specialty groups exactly as the app shows them (29, English + Urdu) |
| `GET` | `/api/hospitals` | Distinct hospital names (for the filter dropdown) |
| `GET` | `/api/patients?limit=100` | Patient list |
| `GET` | `/api/payments?status=…&search=…&limit=…` | Revenue records per payment (doctor, amount, method, status, notes) |
| `GET` | `/api/appointments` | Appointments, filter by `status` / `doctor_id` |
| `POST` | `/api/appointments` | Book an appointment |

### Static

| Path | Served from |
| --- | --- |
| `/`, `/doctors.html`, `/login.html`, `/css/*`, `/js/*`, `/assets/*` | `frontend/` |
| `/uploads/*` | `backend/uploads/` (local avatar storage) |

---

## Design system

Ported from the upstream shadcn dashboard and rebuilt as plain CSS custom properties in
`frontend/css/theme.css`.

- **Colors** — `oklch()` tokens (`--background`, `--foreground`, `--primary`, `--muted`,
  `--border`, `--ring`, `--chart-1…5`, …) with a `.dark` class variant.
- **Radius** — `--radius: 8px`, with `--radius-sm/md/lg/xl` derived from it.
- **Typography** — Geist (UI) and Geist Mono (numbers), served locally from
  `frontend/assets/fonts`.
- **Layout** — 16 rem sidebar that collapses to 3 rem, 3.5 rem top bar, active nav item uses
  `bg-primary text-background` exactly like the reference project.
- **Dark mode** — toggled from the top bar, persisted in `localStorage`
  (`doctor_app_theme`), defaults to the OS preference.

---

## Adding Firebase (later)

Firebase Auth is already isolated in `backend/services/firebase_service.py`. Nothing else in
the code base needs to change.

**1. Install the optional SDK**

```bash
pip install firebase-admin
```

**2. Create a service account** in the Firebase console
(Project settings → Service accounts → *Generate new private key*) and save the JSON as
`data/firebase-credentials.json`.

**3. Set the environment variables**

```bash
FIREBASE_ENABLED=1
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS_FILE=./data/firebase-credentials.json
```

**4. What happens automatically**

- `GET /api/auth/me` and every protected endpoint now accept a **Firebase ID token**
  (`Authorization: Bearer <firebase-id-token>`). The token is verified server-side through
  `firebase_service.verify_id_token()`.
- `POST /api/auth/login` falls back to Firebase user lookup by e-mail for accounts that
  have no local password hash.
- The `users.uid` column is used to link a local row to a Firebase account.

**5. Front end (optional)**

`frontend/js/auth.js` already hints at this: swap the `Api.login()` call for
`firebase.auth().signInWithEmailAndPassword()` and store the resulting ID token with
`Api.setToken(token)`. The rest of the app is unaware of the change.

---

## Adding Cloudinary (later)

Image storage is already isolated in `backend/services/cloudinary_service.py`.

**1. Install the optional SDK**

```bash
pip install cloudinary
```

**2. Set the environment variables**

```bash
CLOUDINARY_ENABLED=1
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=doctor-application
```

**3. What happens automatically**

- `POST /api/doctors/{id}/avatar` uploads to Cloudinary instead of the local disk.
- Both paths return the exact same payload, so the front end never changes:

```json
{ "url": "https://res.cloudinary.com/...", "public_id": "avatars/abc123", "provider": "cloudinary" }
```

- If the SDK is missing or the upload fails, the service logs the error and falls back to
  the local disk — the request still succeeds.
- The `doctors.cloudinary_id` column is ready to store the `public_id` for later deletion.

---

## Configuration reference

All variables are optional — the app runs with sensible defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DOCTOR_APP_DB` | `data/doctor_app.db` | SQLite file location |
| `DOCTOR_APP_SECRET` | `doctor-app-dev-secret-change-me` | HMAC key for session tokens |
| `DOCTOR_APP_TOKEN_TTL` | `12` | Token lifetime in hours |
| `DOCTOR_APP_CORS` | `…:8000,…:5500` | Comma-separated allowed origins |
| `FIREBASE_ENABLED` | `0` | Turn Firebase Auth on |
| `FIREBASE_PROJECT_ID` | – | Firebase project id |
| `FIREBASE_CREDENTIALS_FILE` | `data/firebase-credentials.json` | Service-account JSON |
| `FIREBASE_DATABASE_URL` | – | Realtime Database URL (optional) |
| `CLOUDINARY_ENABLED` | `0` | Turn Cloudinary on |
| `CLOUDINARY_CLOUD_NAME` | – | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | – | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | – | Cloudinary API secret |
| `CLOUDINARY_FOLDER` | `doctor-application` | Folder inside the cloud |

---

## Troubleshooting

**`Address already in use` on port 8000**
Another local application is bound to 8000. Run `python run.py --port 8010` instead (this is
already the default).

**Dashboard shows zeros / "Network error"**
The front end could not reach the API. Confirm the server is running and
<http://127.0.0.1:8010/api/health> returns `{"status":"ok"}`.

**Charts are empty**
Expected — there are no appointments/payments in the backup; the dashboard shows
zeros. To visualize data you'd need to import appointments separately.

**"no such column" errors**
Reset and re-import only from the backup: delete `data/doctor_app.db*`, then run
`python backend/import_only_from_backup.py`.

**Want to start from scratch**
Delete `data/doctor_app.db*` and `backend/uploads/*`, then run
`python backend/import_only_from_backup.py` (creates schema + imports only from
`firestore_backup.json`). The app seeds no fake data; the demo login is
`admin@doctorapp.com` / `admin123`.

**Browser keeps showing an old page after code changes**
The app serves all frontend files with `Cache-Control: no-store`, so freshly
fetched pages are never cached. A browser that loaded the app *before* a big
change may keep old copies for a while (they were cached when the files were
days old) — one **Ctrl+F5** fixes it. For heavier frontend edits, re-apply the
link versioning so every internal link points at a fresh URL:

```
python backend/bump_frontend_versions.py 3     # links: doctors.html -> doctors.html?v=3 (etc.)
```

After running with a new version you must also update the `?v=` suffixes on the
`<link rel="stylesheet">` / `<script src="js/...">` tags (same number) — e.g. an
editor-wide replace of `?v=2` with `?v=3` inside `frontend/*.html`.

---

## Credits

Design, layout and dashboard data model inspired by
[`shadcndashboard/shadcndashboard`](https://github.com/shadcndashboard/shadcndashboard) ·
Icons after [Lucide](https://lucide.dev) · Fonts: [Geist](https://vercel.com/font).
