#!/usr/bin/env python3
"""
Install Windsurf Logger hooks automatically.

This script generates the correct hooks.json configuration for the current system
and installs it to the Windsurf hooks directory.
"""

import sys
import argparse
from windsurf_paths import (
    install_hooks,
    generate_hooks_config,
    get_windsurf_hooks_file,
    get_system_paths_info,
)
import json


def main():
    parser = argparse.ArgumentParser(
        description="Install Windsurf Logger hooks configuration"
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
        "--print-config",
        action="store_true",
        help="Print the generated hooks.json to stdout"
    )
    
    args = parser.parse_args()
    
    if args.show_paths:
        print("Discovered Windsurf Paths:")
        print("=" * 50)
        for key, value in get_system_paths_info().items():
            print(f"  {key}: {value}")
        print()
    
    if args.print_config:
        config = generate_hooks_config()
        print(json.dumps(config, indent=2))
        return 0
    
    if args.dry_run:
        result = install_hooks(dry_run=True)
        print(result)
        return 0
    
    # Perform the actual installation
    try:
        result = install_hooks(dry_run=False)
        print(result)
        print("\nHooks installed successfully!")
        print("Restart Windsurf for the changes to take effect.")
        return 0
    except Exception as e:
        print(f"Error installing hooks: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
