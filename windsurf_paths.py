"""
Windsurf Paths Discovery - Automatically detect Windsurf configuration paths.

This module discovers Windsurf installation and configuration paths dynamically
based on the current user and operating system, without hardcoding any paths.
"""

import os
import json
import platform
from pathlib import Path
from typing import Optional, Dict, Any


def get_home_dir() -> Path:
    """Get the current user's home directory."""
    return Path.home()


def get_windsurf_data_dir() -> Path:
    """
    Get the Windsurf data directory based on the user's system.
    
    Primary location: ~/.codeium/windsurf/
    Fallback: ~/.windsurf/
    """
    home = get_home_dir()
    
    # Primary location (Codeium-based Windsurf)
    codeium_dir = home / ".codeium" / "windsurf"
    if codeium_dir.exists():
        return codeium_dir
    
    # Fallback location
    windsurf_dir = home / ".windsurf"
    if windsurf_dir.exists():
        return windsurf_dir
    
    # Default to primary (will be created if needed)
    return codeium_dir


def get_windsurf_app_support_dir() -> Path:
    """
    Get the Windsurf Application Support directory (contains user settings).
    
    macOS: ~/Library/Application Support/Windsurf/
    Linux: ~/.config/Windsurf/
    Windows: %APPDATA%/Windsurf/
    """
    home = get_home_dir()
    system = platform.system()
    
    if system == "Darwin":  # macOS
        return home / "Library" / "Application Support" / "Windsurf"
    elif system == "Linux":
        return home / ".config" / "Windsurf"
    elif system == "Windows":
        appdata = os.environ.get("APPDATA", str(home / "AppData" / "Roaming"))
        return Path(appdata) / "Windsurf"
    else:
        # Fallback for unknown systems
        return home / ".windsurf"


def get_windsurf_hooks_dir() -> Path:
    """Get the directory where Windsurf stores hooks configuration."""
    return get_windsurf_data_dir()


def get_windsurf_hooks_file() -> Path:
    """Get the path to the Windsurf hooks.json file."""
    return get_windsurf_hooks_dir() / "hooks.json"


def get_windsurf_user_settings_file() -> Path:
    """Get the path to Windsurf user settings.json."""
    return get_windsurf_app_support_dir() / "User" / "settings.json"


def get_windsurf_logs_dir() -> Path:
    """Get the Windsurf logs directory."""
    return get_windsurf_data_dir() / "logs"


def read_windsurf_user_settings() -> Dict[str, Any]:
    """
    Read Windsurf user settings from settings.json.
    
    Returns an empty dict if settings file doesn't exist or can't be read.
    """
    settings_file = get_windsurf_user_settings_file()
    
    if not settings_file.exists():
        return {}
    
    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError, OSError):
        return {}


def get_setting(key: str, default: Any = None) -> Any:
    """
    Get a specific setting from Windsurf user settings.
    
    Args:
        key: The setting key to look up
        default: Default value if setting doesn't exist
    
    Returns:
        The setting value or the default
    """
    settings = read_windsurf_user_settings()
    return settings.get(key, default)


def get_logger_script_path() -> Path:
    """
    Get the path to the cascade_logger.py script in the source repo.
    
    This returns the path relative to where this module is installed.
    """
    return Path(__file__).parent.resolve() / "cascade_logger.py"


def get_installed_logger_path() -> Path:
    """
    Get the path where the logger script will be installed.
    
    The logger is copied to the Windsurf data directory so it works
    independently of the original repo location.
    """
    return get_windsurf_data_dir() / "cascade_logger.py"


def get_hooks_backup_file() -> Path:
    return get_windsurf_hooks_dir() / "hooks.json.windsurf-logger.bak"


def get_logger_backup_path() -> Path:
    return get_windsurf_data_dir() / "cascade_logger.py.windsurf-logger.bak"


def get_install_manifest_path() -> Path:
    return get_windsurf_data_dir() / "windsurf-logger-install-manifest.json"


def get_default_log_output_dir() -> Path:
    """
    Get the default directory for logger output.
    
    Priority:
    1. WINDSURF_LOG_DIR environment variable
    2. ~/.codeium/windsurf/logs (if exists)
    3. ~/.windsurf/logs (if exists)
    4. Falls back to ~/.codeium/windsurf/logs
    """
    # Check environment variable first
    env_dir = os.environ.get("WINDSURF_LOG_DIR")
    if env_dir:
        return Path(env_dir).expanduser()
    
    # Check standard Windsurf locations
    data_dir = get_windsurf_data_dir()
    logs_dir = data_dir / "logs"
    
    return logs_dir


def generate_hooks_config() -> Dict[str, Any]:
    """
    Generate a hooks.json configuration with the correct paths for the current system.
    
    Uses the installed logger path (in Windsurf data directory) so the hooks
    work independently of the original repo location.
    """
    script_path = get_installed_logger_path()
    
    hook_entry = {
        "command": f"python3 {script_path}",
        "timeout_ms": 5000
    }
    
    return {
        "hooks": {
            "pre_user_prompt": [hook_entry],
            "pre_read_code": [hook_entry],
            "post_read_code": [hook_entry],
            "pre_write_code": [hook_entry],
            "post_write_code": [hook_entry],
            "pre_run_command": [hook_entry],
            "post_run_command": [hook_entry],
            "pre_mcp_tool_use": [hook_entry],
            "post_mcp_tool_use": [hook_entry],
        }
    }


def install_logger_script(dry_run: bool = False) -> str:
    """
    Copy the logger script to the Windsurf data directory.
    
    This makes the logger work independently of the original repo location.
    
    Args:
        dry_run: If True, returns what would be done without actually copying
    
    Returns:
        Status message describing what was done
    """
    import shutil
    
    source_path = get_logger_script_path()
    dest_path = get_installed_logger_path()
    
    if dry_run:
        return f"Would copy {source_path} to {dest_path}"
    
    # Ensure directory exists
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy the logger script
    shutil.copy2(source_path, dest_path)
    
    return f"Logger script installed to {dest_path}"


def install_hooks(dry_run: bool = False) -> str:
    """
    Install the hooks configuration and logger script to Windsurf.
    
    This copies the logger script to the Windsurf data directory and
    creates the hooks.json configuration pointing to it.
    
    Args:
        dry_run: If True, returns what would be written without actually writing
    
    Returns:
        Status message describing what was done
    """
    import shutil

    messages = []

    hooks_file = get_windsurf_hooks_file()
    installed_logger_path = get_installed_logger_path()
    hooks_backup_file = get_hooks_backup_file()
    logger_backup_path = get_logger_backup_path()
    install_manifest_path = get_install_manifest_path()

    had_existing_hooks = hooks_file.exists()
    had_existing_logger = installed_logger_path.exists()

    if dry_run:
        if not install_manifest_path.exists():
            if had_existing_hooks:
                messages.append(
                    f"Would back up existing hooks configuration from {hooks_file} to {hooks_backup_file}"
                )
            if had_existing_logger:
                messages.append(
                    f"Would back up existing logger script from {installed_logger_path} to {logger_backup_path}"
                )
            messages.append(f"Would write install manifest to {install_manifest_path}")
        else:
            messages.append(
                f"Install manifest already exists at {install_manifest_path} (would not create backups)"
            )

        logger_result = install_logger_script(dry_run=True)
        messages.append(logger_result)

        config = generate_hooks_config()
        config_json = json.dumps(config, indent=2)
        messages.append(f"Would write to {hooks_file}:\n{config_json}")
        return "\n".join(messages)

    if not install_manifest_path.exists():
        if had_existing_hooks and not hooks_backup_file.exists():
            hooks_backup_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(hooks_file, hooks_backup_file)
            messages.append(f"Backed up existing hooks configuration to {hooks_backup_file}")

        if had_existing_logger and not logger_backup_path.exists():
            logger_backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(installed_logger_path, logger_backup_path)
            messages.append(f"Backed up existing logger script to {logger_backup_path}")

        install_manifest = {
            "hooks_file": str(hooks_file),
            "hooks_backup_file": str(hooks_backup_file),
            "installed_logger_path": str(installed_logger_path),
            "logger_backup_path": str(logger_backup_path),
            "had_existing_hooks": had_existing_hooks,
            "had_existing_logger": had_existing_logger,
        }

        install_manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(install_manifest_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(install_manifest, indent=2))
        messages.append(f"Install manifest written to {install_manifest_path}")

    # First, install the logger script
    logger_result = install_logger_script(dry_run=dry_run)
    messages.append(logger_result)

    # Then, install the hooks config
    config = generate_hooks_config()
    config_json = json.dumps(config, indent=2)

    # Ensure directory exists
    hooks_file.parent.mkdir(parents=True, exist_ok=True)

    # Write the config
    with open(hooks_file, 'w', encoding='utf-8') as f:
        f.write(config_json)

    messages.append(f"Hooks installed to {hooks_file}")
    return "\n".join(messages)


def get_system_paths_info() -> Dict[str, str]:
    """
    Get a summary of all relevant paths for debugging/display.
    """
    return {
        "home_dir": str(get_home_dir()),
        "windsurf_data_dir": str(get_windsurf_data_dir()),
        "windsurf_app_support_dir": str(get_windsurf_app_support_dir()),
        "windsurf_hooks_file": str(get_windsurf_hooks_file()),
        "windsurf_hooks_backup_file": str(get_hooks_backup_file()),
        "windsurf_user_settings_file": str(get_windsurf_user_settings_file()),
        "windsurf_logs_dir": str(get_windsurf_logs_dir()),
        "logger_script_path_source": str(get_logger_script_path()),
        "logger_script_path_installed": str(get_installed_logger_path()),
        "logger_script_path_backup": str(get_logger_backup_path()),
        "install_manifest_path": str(get_install_manifest_path()),
        "default_log_output_dir": str(get_default_log_output_dir()),
    }


if __name__ == "__main__":
    # When run directly, show discovered paths
    import json
    print("Windsurf Paths Discovery")
    print("=" * 50)
    for key, value in get_system_paths_info().items():
        print(f"{key}: {value}")
    print()
    print("Generated hooks.json:")
    print(json.dumps(generate_hooks_config(), indent=2))
