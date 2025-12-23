#!/bin/bash

# Windsurf Logger Dashboard Startup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "🚀 Starting Windsurf Logger Dashboard..."

# Check if Python virtual environment exists
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv "$BACKEND_DIR/venv"
fi

# Activate virtual environment and install dependencies
echo "📦 Installing backend dependencies..."
source "$BACKEND_DIR/venv/bin/activate"
pip install -q -r "$BACKEND_DIR/requirements.txt"

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
python app.py &
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
