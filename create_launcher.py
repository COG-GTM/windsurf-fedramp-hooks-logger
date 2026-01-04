#!/usr/bin/env python3
"""
Cross-Platform Launcher Creator for Windsurf Logger Dashboard

Creates appropriate desktop launchers for Linux, macOS, and Windows.
"""

import os
import sys
import stat
import platform
from pathlib import Path


def write_windows_text(filepath: Path, content: str):
    """Write text file with Windows line endings (CRLF)."""
    with open(filepath, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(content)


def get_project_dir() -> Path:
    """Get the project directory (where this script is located)."""
    return Path(__file__).parent.resolve()


def get_dashboard_dir() -> Path:
    """Get the dashboard directory."""
    return get_project_dir() / "dashboard"


def create_linux_launcher() -> bool:
    """Create .desktop file for Linux."""
    project_dir = get_project_dir()
    dashboard_start = get_dashboard_dir() / "start.sh"
    
    desktop_content = f"""[Desktop Entry]
Version=1.0
Type=Application
Name=Windsurf Logger Dashboard
Comment=Launch Windsurf Logger Dashboard for reviewing Cascade hook events
Exec=/bin/bash "{dashboard_start}"
Icon=utilities-terminal
Terminal=true
Categories=Development;Utility;
Keywords=windsurf;logger;dashboard;cascade;
"""
    
    # Write .desktop file to project directory
    desktop_file = project_dir / "windsurf-logger.desktop"
    desktop_file.write_text(desktop_content)
    desktop_file.chmod(desktop_file.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    
    # Copy to Desktop if it exists
    desktop_dir = Path.home() / "Desktop"
    if desktop_dir.exists():
        dest = desktop_dir / "windsurf-logger.desktop"
        dest.write_text(desktop_content)
        dest.chmod(dest.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        print(f"✅ Desktop shortcut created: {dest}")
    
    # Copy to applications directory for system integration
    apps_dir = Path.home() / ".local" / "share" / "applications"
    if apps_dir.exists():
        dest = apps_dir / "windsurf-logger.desktop"
        dest.write_text(desktop_content)
        print(f"✅ Application integration created: {dest}")
    
    return True


def create_macos_launcher() -> bool:
    """Create .command file for macOS (double-clickable in Finder)."""
    project_dir = get_project_dir()
    dashboard_start = get_dashboard_dir() / "start.sh"
    
    command_content = f"""#!/bin/bash
# Windsurf Logger Dashboard Launcher for macOS
# Double-click this file in Finder to launch the dashboard

cd "{get_dashboard_dir()}"
"{dashboard_start}"
"""
    
    # Write .command file to project directory
    command_file = project_dir / "Windsurf Logger Dashboard.command"
    command_file.write_text(command_content)
    command_file.chmod(command_file.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    print(f"✅ macOS launcher created: {command_file}")
    
    # Copy to Desktop if it exists
    desktop_dir = Path.home() / "Desktop"
    if desktop_dir.exists():
        dest = desktop_dir / "Windsurf Logger Dashboard.command"
        dest.write_text(command_content)
        dest.chmod(dest.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        print(f"✅ Desktop shortcut created: {dest}")
    
    return True


def create_windows_launcher() -> bool:
    """Create .bat file for Windows."""
    project_dir = get_project_dir()
    dashboard_dir = get_dashboard_dir()
    
    # Create start.bat in dashboard directory
    bat_content = f"""@echo off
REM Windsurf Logger Dashboard Startup Script for Windows

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend
set FRONTEND_DIR=%SCRIPT_DIR%frontend

echo 🚀 Starting Windsurf Logger Dashboard...

REM Check if Python virtual environment exists
if not exist "%BACKEND_DIR%\\venv" (
    echo 📦 Creating Python virtual environment...
    python -m venv "%BACKEND_DIR%\\venv"
)

REM Activate virtual environment and install dependencies
echo 📦 Installing backend dependencies...
call "%BACKEND_DIR%\\venv\\Scripts\\activate.bat"
pip install -q -r "%BACKEND_DIR%\\requirements.txt"

REM Check if node_modules exists
if not exist "%FRONTEND_DIR%\\node_modules" (
    echo 📦 Installing frontend dependencies...
    cd /d "%FRONTEND_DIR%"
    npm install
)

REM Start backend in a new window
echo 🔧 Starting backend server on port 5173...
cd /d "%BACKEND_DIR%"
start "Windsurf Backend" cmd /c "call venv\\Scripts\\activate.bat && python app.py"

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
"""
    
    # Write start.bat to dashboard directory
    bat_file = dashboard_dir / "start.bat"
    write_windows_text(bat_file, bat_content)
    print(f"✅ Windows start script created: {bat_file}")
    
    # Create desktop launcher batch file
    launcher_content = f"""@echo off
REM Windsurf Logger Dashboard Launcher
cd /d "{dashboard_dir}"
call start.bat
"""
    
    launcher_file = project_dir / "Windsurf Logger Dashboard.bat"
    write_windows_text(launcher_file, launcher_content)
    print(f"✅ Windows launcher created: {launcher_file}")
    
    # Copy to Desktop if it exists
    desktop_dir = Path.home() / "Desktop"
    if desktop_dir.exists():
        dest = desktop_dir / "Windsurf Logger Dashboard.bat"
        write_windows_text(dest, launcher_content)
        print(f"✅ Desktop shortcut created: {dest}")
    
    return True


def create_launcher():
    """Create appropriate launcher for the current operating system."""
    system = platform.system()
    
    print(f"🚀 Creating desktop launcher for Windsurf Logger Dashboard...")
    print(f"   Detected OS: {system}")
    print()
    
    if system == "Linux":
        success = create_linux_launcher()
    elif system == "Darwin":  # macOS
        success = create_macos_launcher()
    elif system == "Windows":
        success = create_windows_launcher()
    else:
        print(f"⚠️  Unknown operating system: {system}")
        print("   Manual setup may be required.")
        return False
    
    if success:
        print()
        print("📋 Setup Complete!")
        if system == "Linux":
            print("   • Desktop shortcut: Double-click the desktop icon")
            print("   • Application menu: Find 'Windsurf Logger Dashboard' in your applications")
        elif system == "Darwin":
            print("   • Desktop shortcut: Double-click 'Windsurf Logger Dashboard.command'")
            print("   • Finder: Navigate to project and double-click the .command file")
        elif system == "Windows":
            print("   • Desktop shortcut: Double-click 'Windsurf Logger Dashboard.bat'")
            print("   • Explorer: Navigate to project and double-click the .bat file")
        
        print(f"   • Terminal: Run './dashboard/start.sh' (Unix) or 'dashboard\\start.bat' (Windows)")
        print()
        print("🔧 Note: The launcher will open in a terminal window.")
    
    return success


def create_all_launchers():
    """Create launchers for all platforms (useful for distribution)."""
    print("🚀 Creating launchers for all platforms...")
    print()
    
    create_linux_launcher()
    print()
    create_macos_launcher()
    print()
    create_windows_launcher()
    
    print()
    print("📋 All platform launchers created!")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        create_all_launchers()
    else:
        create_launcher()
