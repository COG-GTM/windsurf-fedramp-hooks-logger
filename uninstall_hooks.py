#!/usr/bin/env python3
"""
Uninstall Windsurf Logger hooks.

This script removes the hooks.json configuration and logger script
installed by install_hooks.py, reverting to the pre-install state.
"""

import sys
import argparse
import json
import shutil
from windsurf_paths import (
    get_windsurf_hooks_file,
    get_installed_logger_path,
    get_system_paths_info,
    get_hooks_backup_file,
    get_logger_backup_path,
    get_install_manifest_path,
    generate_hooks_config,
)


def uninstall_hooks(dry_run: bool = False) -> str:
    """
    Remove the hooks configuration and logger script from Windsurf.
    
    Args:
        dry_run: If True, returns what would be done without actually removing
    
    Returns:
        Status message describing what was done
    """
    messages = []

    hooks_file = get_windsurf_hooks_file()
    logger_file = get_installed_logger_path()
    hooks_backup_file = get_hooks_backup_file()
    logger_backup_file = get_logger_backup_path()
    manifest_file = get_install_manifest_path()

    def restore_backup(backup_path, dest_path, description):
        if dry_run:
            messages.append(f"Would restore {description} from {backup_path} to {dest_path}")
            messages.append(f"Would remove backup file: {backup_path}")
            return

        shutil.copy2(backup_path, dest_path)
        backup_path.unlink()
        messages.append(f"Restored {description} from backup to {dest_path}")
        messages.append(f"Removed backup file: {backup_path}")

    def remove_file(path, description):
        if not path.exists():
            messages.append(f"{description} not found (already removed): {path}")
            return

        if dry_run:
            messages.append(f"Would remove {description}: {path}")
            return

        try:
            path.unlink()
            messages.append(f"Removed {description}: {path}")
        except OSError as e:
            messages.append(f"Failed to remove {description} ({path}): {e}")

    def hooks_looks_like_ours() -> bool:
        if not hooks_file.exists():
            return False
        try:
            with open(hooks_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            return False

        expected = generate_hooks_config()
        if data == expected:
            return True

        try:
            hooks = data.get("hooks", {})
            for _, entries in hooks.items():
                for entry in entries or []:
                    cmd = entry.get("command")
                    if cmd and str(logger_file) in cmd:
                        return True
        except Exception:
            return False

        return False

    if manifest_file.exists():
        if hooks_backup_file.exists():
            restore_backup(hooks_backup_file, hooks_file, "hooks configuration")
        else:
            remove_file(hooks_file, "Hooks configuration")

        if logger_backup_file.exists():
            restore_backup(logger_backup_file, logger_file, "logger script")
        else:
            remove_file(logger_file, "Logger script")

        remove_file(manifest_file, "Install manifest")
        return "\n".join(messages)

    if hooks_backup_file.exists():
        restore_backup(hooks_backup_file, hooks_file, "hooks configuration")
    else:
        if hooks_looks_like_ours():
            remove_file(hooks_file, "Hooks configuration")
        else:
            messages.append(
                f"Not removing hooks configuration (no manifest and file does not look like it was installed by this tool): {hooks_file}"
            )

    if logger_backup_file.exists():
        restore_backup(logger_backup_file, logger_file, "logger script")
    else:
        if logger_file.exists():
            remove_file(logger_file, "Logger script")
        else:
            messages.append(f"Logger script not found (already removed): {logger_file}")

    return "\n".join(messages)


def main():
    parser = argparse.ArgumentParser(
        description="Uninstall Windsurf Logger hooks configuration"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--show-paths",
        action="store_true",
        help="Show all discovered paths"
    )
    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="Skip confirmation prompt"
    )
    
    args = parser.parse_args()
    
    if args.show_paths:
        print("Discovered Windsurf Paths:")
        print("=" * 50)
        for key, value in get_system_paths_info().items():
            print(f"  {key}: {value}")
        print()
    
    if args.dry_run:
        result = uninstall_hooks(dry_run=True)
        print("Dry run - no changes made:")
        print(result)
        return 0
    
    # Confirm before uninstalling (unless --force)
    if not args.force:
        hooks_file = get_windsurf_hooks_file()
        logger_file = get_installed_logger_path()
        hooks_backup_file = get_hooks_backup_file()
        logger_backup_file = get_logger_backup_path()
        manifest_file = get_install_manifest_path()
        
        print("This will revert Windsurf to the pre-install state (logs are preserved).")
        print("Files that may be modified:")
        print(f"  - {hooks_file}")
        print(f"  - {logger_file}")
        print(f"  - {hooks_backup_file} (if present)")
        print(f"  - {logger_backup_file} (if present)")
        print(f"  - {manifest_file} (if present)")
        print()
        
        try:
            response = input("Continue? [y/N] ").strip().lower()
            if response not in ('y', 'yes'):
                print("Uninstall cancelled.")
                return 0
        except (EOFError, KeyboardInterrupt):
            print("\nUninstall cancelled.")
            return 0
    
    # Perform the actual uninstallation
    try:
        result = uninstall_hooks(dry_run=False)
        print(result)
        print("\nHooks uninstalled successfully!")
        print("Restart Windsurf for the changes to take effect.")
        return 0
    except Exception as e:
        print(f"Error uninstalling hooks: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
