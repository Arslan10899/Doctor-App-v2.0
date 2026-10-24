@echo off
REM ---------------------------------------------------------------------
REM  Doctor Application - start the server
REM  Usage:  start.bat          (normal)
REM          start.bat --reload (auto reload for development)
REM ---------------------------------------------------------------------
setlocal
cd /d "%~dp0"

echo.
echo   Installing / checking dependencies...
python -m pip install -r backend\requirements.txt --quiet

echo.
echo   Seeding the database (first run only)...
python backend\seed.py

echo.
echo   Starting Doctor Application on http://127.0.0.1:8000
echo.
python run.py %*
