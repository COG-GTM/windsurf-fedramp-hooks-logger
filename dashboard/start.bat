@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
REM Windsurf Logger Dashboard Startup Script for Windows

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend
set FRONTEND_DIR=%SCRIPT_DIR%frontend

echo [START] Starting Windsurf Logger Dashboard...

REM Check for Python 3
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo    Please install Python 3 and try again.
    pause
    exit /b 1
)

REM Verify it's Python 3
python --version 2>&1 | findstr /R "Python 3\." >nul
if errorlevel 1 (
    echo [ERROR] Python 3 is required but a different version was found.
    echo    Please install Python 3 and try again.
    pause
    exit /b 1
)

echo    Using: Python
for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo    %%i

REM Check if Python virtual environment exists
if not exist "%BACKEND_DIR%\venv" (
    echo [SETUP] Creating Python virtual environment...
    python -m venv "%BACKEND_DIR%\venv"
    if errorlevel 1 (
        echo [ERROR] Failed to create Python virtual environment.
        pause
        exit /b 1
    )
)

REM Activate virtual environment and install dependencies
echo [SETUP] Installing backend dependencies...
call "%BACKEND_DIR%\venv\Scripts\activate.bat"
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment.
    pause
    exit /b 1
)
pip install -q -r "%BACKEND_DIR%\requirements.txt"

REM Check for npm/node
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is required but not found.
    echo    Please install Node.js and npm, then try again.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [SETUP] Installing frontend dependencies...
    cd /d "%FRONTEND_DIR%"
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies.
        pause
        exit /b 1
    )
)

REM Start backend in a new window
echo [BACKEND] Starting backend server on port 5173...
cd /d "%BACKEND_DIR%"
start "Windsurf Backend" cmd /c "call venv\Scripts\activate.bat && python app.py"

REM Wait for backend to start
timeout /t 2 /nobreak > nul

REM Start frontend in a new window
echo [FRONTEND] Starting frontend dev server on port 5174...
cd /d "%FRONTEND_DIR%"
start "Windsurf Frontend" cmd /c "npm run dev"

set DASHBOARD_URL=
REM Wait for frontend to start before checking ports
timeout /t 3 /nobreak > nul
for /L %%P in (5174,1,5190) do (
    powershell -NoProfile -Command "try { $null = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri ('http://localhost:%%P/'); exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set "DASHBOARD_URL=http://localhost:%%P"
        goto :OPEN_BROWSER
    )
)

:OPEN_BROWSER
if "%DASHBOARD_URL%"=="" set DASHBOARD_URL=http://localhost:5174
start "" "%DASHBOARD_URL%"

echo.
echo [OK] Dashboard is starting!
echo    Frontend: %DASHBOARD_URL%
echo    Backend API: http://localhost:5173
echo.
echo Close the terminal windows to stop the servers.
pause
