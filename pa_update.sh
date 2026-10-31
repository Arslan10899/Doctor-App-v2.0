#!/bin/bash
# ----------------------------------------------------------------------------
# Doctor App - PythonAnywhere deploy/update helper
#
# Usage (every time GitHub has new code):
#     cd ~/Doctor-App-v2.0 && bash pa_update.sh
#
# Web app reload happens via "touch" on the WSGI config file (PA watches it),
# so no `pa` CLI tool is required.
# ----------------------------------------------------------------------------
set -u

cd "$HOME/Doctor-App-v2.0" || { echo "Repo folder nahi mila ~/Doctor-App-v2.0"; exit 1; }

# --- venv -------------------------------------------------------------------
if command -v workon >/dev/null 2>&1; then
    workon doctor-app 2>/dev/null || source "$HOME/.virtualenvs/doctor-app/bin/activate" 2>/dev/null || true
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
    echo "   (PA ka purana DB backup ban gaya)"
fi
git fetch origin || { echo ">> git fetch fail (net?)"; }
git reset --hard origin/main

# --- requirements in case they changed ---------------------------------------
echo ""
echo "== pip install (requirements.txt) =="
"$PY" -m pip install --user -r backend/requirements.txt
echo ">> pip: exit code $? (0 = ok)"

# --- reload the website via touch (PA watches the WSGI file) -------------------
echo ""
echo "== website reload (touch WSGI config) =="
WSGI_FILE="$HOME/Doctorv2_pythonanywhere_com_wsgi.py"
if [ -f "$WSGI_FILE" ]; then
    touch "$WSGI_FILE"
    echo "   touched $WSGI_FILE -> PA will reload the web app"
else
    echo "   WSGI file nahi mila: $WSGI_FILE"
    echo "   PA -> Web tab -> green 'Reload' button manually click karo"
fi

# --- status + last errors -----------------------------------------------------
echo ""
echo "== last log lines =="
for f in /var/log/*doctorv2*error.log /var/log/*doctorv2*server.log; do
    [ -f "$f" ] || continue
    echo "---- $f ----"
    tail -n 15 "$f"
done

echo ""
echo "== Done. Dashboard refresh karo, R2 card check karo. =="
