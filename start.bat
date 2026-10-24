@echo off
REM ---------------------------------------------------------------------
REM  Doctor Application - start the server
REM  Usage:  start.bat          (normal)
REM          start.bat --reload (auto reload for development)
REM ---------------------------------------------------------------------
setlocal
title Doctor Application
cd /d "%~dp0"

echo.
echo   ================= Doctor Application v1.0 =================
echo.

REM ---- 1 - python available? --------------------------------------------
where python >nul 2>nul
if errorlevel 1 (
    echo   [X] Python nahi mila. python.org se install karein aur dobara chalayein.
    echo.
    pause
    exit /b 1
)

REM ---- 2 - stop any old server still holding port 8010 ------------------
set APP_PORT=8010
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%APP_PORT%" ^| findstr "LISTENING"') do (
    echo   [*] Purana server port %APP_PORT% par chal raha tha PID %%P - band kar raha hoon...
    taskkill /F /PID %%P >nul 2>nul
)

REM ---- 3 - install / check dependencies ---------------------------------
echo   [*] Dependencies check/install ho rahi hain...
python -m pip install -r backend\requirements.txt --quiet --disable-pip-version-check
if errorlevel 1 (
    echo   [!] pip install chhup gaya - online na hone par bhi chalta rahega
)
echo.

REM ---- 4 - seed database (first run only) -------------------------------
echo   [*] Seeding the database (first run only)...
python backend\seed.py

REM ---- 5 - start the server ---------------------------------------------
echo.
echo   =================  Server start ho raha hai  =================
echo.
echo   Dashboard   :  http://127.0.0.1:%APP_PORT%
echo   API docs    :  http://127.0.0.1:%APP_PORT%/docs
echo   Band karne ke liye: Ctrl+C dabayen
echo.
echo   ===========================================================
echo.
python run.py %*

REM ---- 6 - window band na ho jaye, error parhne ka moqa do --------------
echo.
echo   Server band ho gaya. Ghalti ka message upar dekh sakte hain.
echo.
pause
