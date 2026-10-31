#!/bin/bash
# ----------------------------------------------------------------------------
# Doctor App - PythonAnywhere deploy/update helper
#
# One-time before first run (inside any Bash console):
#     echo 'YOUR_PA_API_TOKEN' > ~/.pa_token
#
# Usage (every time GitHub has new code):
#     cd ~/Doctor-App-v2.0 && bash pa_update.sh
# ----------------------------------------------------------------------------
set -u

cd "$HOME/Doctor-App-v2.0" || { echo "Repo folder nahi mila ~/Doctor-App-v2.0"; exit 1; }

# --- API token (file lives in your home folder, never in the repo) ----------
if [ -f "$HOME/.pa_token" ]; then
    export API_TOKEN="$(cat "$HOME/.pa_token")"
fi
if [ -z "${API_TOKEN:-}" ]; then
    echo ">> API_TOKEN nahi mila. Ek dafa ye chalao:"
    echo "   echo 'APNA_PA_TOKEN' > ~/.pa_token"
    exit 1
fi

# --- venv -------------------------------------------------------------------
if command -v workon >/dev/null 2>&1; then
    workon doctor-app 2>/dev/null || source "$HOME/.virtualenvs/doctor-app/bin/activate"
fi
PY="$(command -v python)"
echo ">> Python: $PY"

# --- new code + data from GitHub --------------------------------------------
# Repo DB is the single source of truth: whatever DB was pushed is adopted.
# The database that PA had until now is backed up first (~/Doctor-App-v2.0-backups)
# so panel changes made on PA are never lost, they just get replaced.
echo ""
echo "== git sync (fetch + hard reset to origin/main) =="
if [ -f data/doctor_app.db ]; then
    mkdir -p "$HOME/Doctor-App-v2.0-backups"
    cp -f data/doctor_app.db "$HOME/Doctor-App-v2.0-backups/doctor_app_$(date +%Y%m%d_%H%M%S).db"
fi
git fetch origin || { echo ">> git fetch fail (net?)"; }
git reset --hard origin/main

# --- requirements in case they changed ---------------------------------------
"$PY" -m pip install -q -r backend/requirements.txt 2>/dev/null
echo ">> pip: ok"

# --- reload the website -------------------------------------------------------
echo ""
echo "== website reload =="
pa website reload --domain Doctorv2.pythonanywhere.com || true

# --- status + last errors -----------------------------------------------------
echo ""
echo "== website status =="
pa website get

echo ""
echo "== last log lines (errors first) =="
for f in /var/log/*doctorv2*error.log /var/log/*doctorv2*server.log; do
    [ -f "$f" ] || continue
    echo "---- $f ----"
    tail -n 20 "$f"
done

echo ""
echo "== Done. Agar upar red/Traceback dikhe to wo copy kar ke bhejo =="
