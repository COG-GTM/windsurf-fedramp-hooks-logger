#!/bin/bash

# Windsurf Logger Dashboard Startup Script
# Compatible with Linux and macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
DASHBOARD_URL="http://localhost:5174"

# Detect OS for any platform-specific handling
OS_TYPE="$(uname -s)"

echo "🚀 Starting Windsurf Logger Dashboard..."
echo "   Platform: $OS_TYPE"

# Find Python 3 command (python3 on most systems, python on some)
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    # Verify it's Python 3
    if python --version 2>&1 | grep -q "Python 3"; then
        PYTHON_CMD="python"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ Error: Python 3 is required but not found."
    echo "   Please install Python 3 and try again."
    exit 1
fi

echo "   Using: $PYTHON_CMD ($(${PYTHON_CMD} --version 2>&1))"

# Check if Python virtual environment exists
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "📦 Creating Python virtual environment..."
    $PYTHON_CMD -m venv "$BACKEND_DIR/venv"
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to create Python virtual environment."
        exit 1
    fi
fi

# Activate virtual environment and install dependencies
echo "📦 Installing backend dependencies..."
if [ ! -f "$BACKEND_DIR/venv/bin/activate" ]; then
    echo "❌ Error: Virtual environment activation script not found."
    echo "   Try deleting $BACKEND_DIR/venv and running again."
    exit 1
fi

# Source the activation script - if it fails, the script exits due to set -e
source "$BACKEND_DIR/venv/bin/activate"

# Verify we're in a virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo "❌ Error: Failed to activate virtual environment."
    exit 1
fi

pip install -q -r "$BACKEND_DIR/requirements.txt"

# Check for npm/node
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is required but not found."
    echo "   Please install Node.js and npm, then try again."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to install frontend dependencies."
        exit 1
    fi
fi

# Start backend (venv already activated above)
echo "🔧 Starting backend server on port 5173..."
cd "$BACKEND_DIR"
"$PYTHON_CMD" app.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "🎨 Starting frontend dev server on port 5174..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

# Open dashboard in default browser (best-effort)
FOUND_DASHBOARD_URL=""
for _ in $(seq 1 40); do
    for p in $(seq 5174 5190); do
        if command -v curl &> /dev/null; then
            if curl -fsS --max-time 1 "http://localhost:${p}/" >/dev/null 2>&1; then
                FOUND_DASHBOARD_URL="http://localhost:${p}"
                break
            fi
        else
            if "$PYTHON_CMD" - <<PY >/dev/null 2>&1
import urllib.request
try:
    urllib.request.urlopen("http://localhost:${p}/", timeout=1)
    raise SystemExit(0)
except Exception:
    raise SystemExit(1)
PY
            then
                FOUND_DASHBOARD_URL="http://localhost:${p}"
                break
            fi
        fi
    done
    [ -n "$FOUND_DASHBOARD_URL" ] && break
    sleep 0.5
done

if [ -n "$FOUND_DASHBOARD_URL" ]; then
    DASHBOARD_URL="$FOUND_DASHBOARD_URL"
fi

if [ "$OS_TYPE" = "Darwin" ]; then
    (open "$DASHBOARD_URL" >/dev/null 2>&1 || true) &
elif command -v xdg-open &> /dev/null; then
    (xdg-open "$DASHBOARD_URL" >/dev/null 2>&1 || true) &
elif command -v sensible-browser &> /dev/null; then
    (sensible-browser "$DASHBOARD_URL" >/dev/null 2>&1 || true) &
fi

echo ""
echo "✅ Dashboard is starting!"
echo "   Frontend: $DASHBOARD_URL"
echo "   Backend API: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Cleanup on exit
trap '([ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null) || true; ([ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null) || true' EXIT

wait
