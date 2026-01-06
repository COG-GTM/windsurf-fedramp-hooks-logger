#!/bin/bash

# Create Desktop Launcher for Windsurf Logger Dashboard
# This script creates a desktop shortcut for easy dashboard access
# Compatible with Linux and macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="Windsurf Logger Dashboard"
DESKTOP_DIR="$HOME/Desktop"

# Detect operating system
OS_TYPE="$(uname -s)"

echo "🚀 Creating desktop launcher for $PROJECT_NAME..."
echo "   Detected OS: $OS_TYPE"

# Clean up non-applicable desktop shortcut files
case "$OS_TYPE" in
    Linux)
        rm -f "$DESKTOP_DIR/Windsurf Logger Dashboard.command" "$DESKTOP_DIR/Windsurf Logger Dashboard.bat" 2>/dev/null || true
        ;;
    Darwin)
        rm -f "$DESKTOP_DIR/windsurf-logger.desktop" "$DESKTOP_DIR/Windsurf Logger Dashboard.bat" 2>/dev/null || true
        ;;
esac

case "$OS_TYPE" in
    Linux)
        # Linux: Create .desktop file
        DESKTOP_FILE="$SCRIPT_DIR/windsurf-logger.desktop"
        APPLICATIONS_DIR="$HOME/.local/share/applications"
        
        # Generate .desktop file with correct absolute paths
        cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Windsurf Logger Dashboard
Comment=Launch Windsurf Logger Dashboard for reviewing Cascade hook events
Exec=/bin/bash "$SCRIPT_DIR/dashboard/start.sh"
Icon=utilities-terminal
Terminal=true
Categories=Development;Utility;
Keywords=windsurf;logger;dashboard;cascade;
Path=$SCRIPT_DIR
EOF
        
        chmod +x "$DESKTOP_FILE"
        
        # Copy to desktop
        if [ -d "$DESKTOP_DIR" ]; then
            cp "$DESKTOP_FILE" "$DESKTOP_DIR/"
            chmod +x "$DESKTOP_DIR/windsurf-logger.desktop"
            echo "✅ Desktop shortcut created: $DESKTOP_DIR/windsurf-logger.desktop"
        fi
        
        # Copy to applications directory for system integration
        if [ -d "$APPLICATIONS_DIR" ]; then
            cp "$DESKTOP_FILE" "$APPLICATIONS_DIR/"
            echo "✅ Application integration created: $APPLICATIONS_DIR/windsurf-logger.desktop"
        fi
        ;;
        
    Darwin)
        # macOS: Create .command file (double-clickable in Finder)
        COMMAND_FILE="$SCRIPT_DIR/Windsurf Logger Dashboard.command"
        
        # In-repo version uses SCRIPT_DIR (works when run from repo)
        cat > "$COMMAND_FILE" << 'EOF'
#!/bin/bash
# Windsurf Logger Dashboard Launcher for macOS
# Double-click this file in Finder to launch the dashboard

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/dashboard"
"$SCRIPT_DIR/dashboard/start.sh"
EOF
        
        chmod +x "$COMMAND_FILE"
        echo "✅ macOS launcher created: $COMMAND_FILE"
        
        # Desktop version uses absolute path (works from anywhere)
        if [ -d "$DESKTOP_DIR" ]; then
            cat > "$DESKTOP_DIR/Windsurf Logger Dashboard.command" << EOF
#!/bin/bash
# Windsurf Logger Dashboard Launcher for macOS
# Double-click this file in Finder to launch the dashboard

# Absolute path to the windsurf-fedramp-hooks-logger repo
REPO_DIR="$SCRIPT_DIR"
cd "\$REPO_DIR/dashboard"
"\$REPO_DIR/dashboard/start.sh"
EOF
            chmod +x "$DESKTOP_DIR/Windsurf Logger Dashboard.command"
            echo "✅ Desktop shortcut created: $DESKTOP_DIR/Windsurf Logger Dashboard.command"
        fi
        ;;
        
    MINGW*|MSYS*|CYGWIN*)
        # Windows (Git Bash/MSYS/Cygwin) - recommend using .bat file
        echo "⚠️  Windows detected via Unix shell."
        echo "   For native Windows support, use: dashboard\\start.bat"
        echo "   Or run: python create_launcher.py"
        ;;
        
    *)
        echo "⚠️  Unknown operating system: $OS_TYPE"
        echo "   Try running: python3 create_launcher.py"
        exit 1
        ;;
esac

echo ""
echo "📋 Setup Complete!"
case "$OS_TYPE" in
    Linux)
        echo "   • Desktop shortcut: Double-click the desktop icon"
        echo "   • Application menu: Find '$PROJECT_NAME' in your applications"
        ;;
    Darwin)
        echo "   • Desktop shortcut: Double-click 'Windsurf Logger Dashboard.command'"
        echo "   • Finder: Navigate to project and double-click the .command file"
        ;;
esac
echo "   • Terminal: Run './dashboard/start.sh'"
echo ""
echo "🔧 Note: The launcher will open in a terminal window."
echo ""
echo "💡 For cross-platform launcher creation, use: python3 create_launcher.py"
