#!/bin/bash

# Windsurf Logger Dashboard Startup Script
# Compatible with Linux and macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

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
fi

# Activate virtual environment and install dependencies
echo "📦 Installing backend dependencies..."
source "$BACKEND_DIR/venv/bin/activate"
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
fi

# Start backend
echo "🔧 Starting backend server on port 5173..."
cd "$BACKEND_DIR"
source venv/bin/activate
$PYTHON_CMD app.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "🎨 Starting frontend dev server on port 5174..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Dashboard is starting!"
echo "   Frontend: http://localhost:5174"
echo "   Backend API: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
