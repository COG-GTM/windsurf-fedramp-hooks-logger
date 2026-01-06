#!/bin/bash
# Windsurf Logger Dashboard Launcher for macOS
# Double-click this file in Finder to launch the dashboard

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/dashboard"
"$SCRIPT_DIR/dashboard/start.sh"
