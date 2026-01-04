@echo off
REM Windsurf Logger Dashboard Startup Script for Windows

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend
set FRONTEND_DIR=%SCRIPT_DIR%frontend

echo 🚀 Starting Windsurf Logger Dashboard...

REM Check if Python virtual environment exists
if not exist "%BACKEND_DIR%\venv" (
    echo 📦 Creating Python virtual environment...
    python -m venv "%BACKEND_DIR%\venv"
)

REM Activate virtual environment and install dependencies
echo 📦 Installing backend dependencies...
call "%BACKEND_DIR%\venv\Scripts\activate.bat"
pip install -q -r "%BACKEND_DIR%\requirements.txt"

REM Check if node_modules exists
if not exist "%FRONTEND_DIR%\node_modules" (
    echo 📦 Installing frontend dependencies...
    cd /d "%FRONTEND_DIR%"
    npm install
)

REM Start backend in a new window
echo 🔧 Starting backend server on port 5173...
cd /d "%BACKEND_DIR%"
start "Windsurf Backend" cmd /c "call venv\Scripts\activate.bat && python app.py"

REM Wait for backend to start
timeout /t 2 /nobreak > nul

REM Start frontend in a new window
echo 🎨 Starting frontend dev server on port 5174...
cd /d "%FRONTEND_DIR%"
start "Windsurf Frontend" cmd /c "npm run dev"

echo.
echo ✅ Dashboard is starting!
echo    Frontend: http://localhost:5174
echo    Backend API: http://localhost:5173
echo.
echo Close the terminal windows to stop the servers.
pause
