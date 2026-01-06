#!/usr/bin/env python3
"""
Uninstall Windsurf Logger hooks.

This script removes the hooks.json configuration and logger script
installed by install_hooks.py, reverting to the pre-install state.

Optional deletion targets:
- --delete-logs: Remove all log files
- --delete-repo: Remove the local repository
- --delete-all: Remove everything (hooks, logs, and repo)
"""

import sys
import argparse
import json
import shutil
from pathlib import Path
from windsurf_paths import (
    get_windsurf_hooks_file,
    get_installed_logger_path,
    get_system_paths_info,
    get_hooks_backup_file,
    get_logger_backup_path,
    get_install_manifest_path,
    generate_hooks_config,
    get_windsurf_logs_dir,
)


def get_repo_dir() -> Path:
    """Get the local repository directory (where this script lives)."""
    return Path(__file__).parent.resolve()


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


def delete_logs(dry_run: bool = False) -> str:
    """
    Delete all log files from the Windsurf logs directory.
    
    Args:
        dry_run: If True, returns what would be done without actually deleting
    
    Returns:
        Status message describing what was done
    """
    messages = []
    logs_dir = get_windsurf_logs_dir()
    
    if not logs_dir.exists():
        messages.append(f"Logs directory not found: {logs_dir}")
        return "\n".join(messages)
    
    # Count files and calculate size
    log_files = list(logs_dir.rglob("*"))
    file_count = sum(1 for f in log_files if f.is_file())
    total_size = sum(f.stat().st_size for f in log_files if f.is_file())
    size_mb = total_size / (1024 * 1024)
    
    if dry_run:
        messages.append(f"Would delete logs directory: {logs_dir}")
        messages.append(f"  Contains {file_count} files ({size_mb:.2f} MB)")
        return "\n".join(messages)
    
    try:
        shutil.rmtree(logs_dir)
        messages.append(f"Deleted logs directory: {logs_dir}")
        messages.append(f"  Removed {file_count} files ({size_mb:.2f} MB)")
    except OSError as e:
        messages.append(f"Failed to delete logs directory ({logs_dir}): {e}")
    
    return "\n".join(messages)


def delete_repo(dry_run: bool = False) -> str:
    """
    Delete the local repository directory.
    
    Args:
        dry_run: If True, returns what would be done without actually deleting
    
    Returns:
        Status message describing what was done
    """
    messages = []
    repo_dir = get_repo_dir()
    
    if not repo_dir.exists():
        messages.append(f"Repository directory not found: {repo_dir}")
        return "\n".join(messages)
    
    # Count files and calculate size
    all_files = list(repo_dir.rglob("*"))
    file_count = sum(1 for f in all_files if f.is_file())
    total_size = sum(f.stat().st_size for f in all_files if f.is_file())
    size_mb = total_size / (1024 * 1024)
    
    if dry_run:
        messages.append(f"Would delete repository directory: {repo_dir}")
        messages.append(f"  Contains {file_count} files ({size_mb:.2f} MB)")
        return "\n".join(messages)
    
    try:
        shutil.rmtree(repo_dir)
        messages.append(f"Deleted repository directory: {repo_dir}")
        messages.append(f"  Removed {file_count} files ({size_mb:.2f} MB)")
    except OSError as e:
        messages.append(f"Failed to delete repository directory ({repo_dir}): {e}")
    
    return "\n".join(messages)


def main():
    parser = argparse.ArgumentParser(
        description="Uninstall Windsurf Logger hooks configuration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 uninstall_hooks.py                    # Uninstall hooks only
  python3 uninstall_hooks.py --delete-logs      # Uninstall hooks and delete logs
  python3 uninstall_hooks.py --delete-repo      # Uninstall hooks and delete local repo
  python3 uninstall_hooks.py --delete-all       # Remove everything
  python3 uninstall_hooks.py --dry-run --delete-all  # Preview full removal
"""
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
    parser.add_argument(
        "--delete-logs",
        action="store_true",
        help="Also delete all log files in the Windsurf logs directory"
    )
    parser.add_argument(
        "--delete-repo",
        action="store_true",
        help="Also delete the local repository (source code)"
    )
    parser.add_argument(
        "--delete-all",
        action="store_true",
        help="Delete everything: hooks, logs, and local repository"
    )
    
    args = parser.parse_args()
    
    # --delete-all implies both --delete-logs and --delete-repo
    if args.delete_all:
        args.delete_logs = True
        args.delete_repo = True
    
    if args.show_paths:
        print("Discovered Windsurf Paths:")
        print("=" * 50)
        for key, value in get_system_paths_info().items():
            print(f"  {key}: {value}")
        print(f"  logs_dir: {get_windsurf_logs_dir()}")
        print(f"  repo_dir: {get_repo_dir()}")
        print()
    
    if args.dry_run:
        print("Dry run - no changes made:")
        print()
        
        print("=== Hooks Uninstall ===")
        result = uninstall_hooks(dry_run=True)
        print(result)
        print()
        
        if args.delete_logs:
            print("=== Delete Logs ===")
            result = delete_logs(dry_run=True)
            print(result)
            print()
        
        if args.delete_repo:
            print("=== Delete Repository ===")
            result = delete_repo(dry_run=True)
            print(result)
            print()
        
        return 0
    
    # Build list of what will be affected for confirmation
    hooks_file = get_windsurf_hooks_file()
    logger_file = get_installed_logger_path()
    hooks_backup_file = get_hooks_backup_file()
    logger_backup_file = get_logger_backup_path()
    manifest_file = get_install_manifest_path()
    logs_dir = get_windsurf_logs_dir()
    repo_dir = get_repo_dir()
    
    # Confirm before uninstalling (unless --force)
    if not args.force:
        print("This will perform the following actions:")
        print()
        print("  [Hooks - always removed]")
        print(f"    - {hooks_file}")
        print(f"    - {logger_file}")
        print(f"    - {hooks_backup_file} (if present)")
        print(f"    - {logger_backup_file} (if present)")
        print(f"    - {manifest_file} (if present)")
        
        if args.delete_logs:
            print()
            print("  [Logs - will be DELETED]")
            print(f"    - {logs_dir}/ (entire directory)")
        
        if args.delete_repo:
            print()
            print("  [Repository - will be DELETED]")
            print(f"    - {repo_dir}/ (entire directory)")
        
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
        print("=== Uninstalling Hooks ===")
        result = uninstall_hooks(dry_run=False)
        print(result)
        print()
        
        if args.delete_logs:
            print("=== Deleting Logs ===")
            result = delete_logs(dry_run=False)
            print(result)
            print()
        
        if args.delete_repo:
            print("=== Deleting Repository ===")
            result = delete_repo(dry_run=False)
            print(result)
            print()
        
        print("Uninstall completed successfully!")
        print("Restart Windsurf for the changes to take effect.")
        return 0
    except Exception as e:
        print(f"Error during uninstall: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
