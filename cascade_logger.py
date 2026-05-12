#!/usr/bin/env python3
"""
Cascade Logger - Comprehensive logging for all Windsurf Cascade hook events.

Captures all available hook events with complete metadata for filtering and analysis:
- pre_user_prompt: User prompts before processing
- pre_read_code / post_read_code: File read operations
- pre_write_code / post_write_code: Code modifications with full edit details
- pre_run_command / post_run_command: Terminal command executions
- pre_mcp_tool_use / post_mcp_tool_use: MCP tool invocations

Data is stored in JSONL format for easy filtering and UI integration.

Implementation notes:
- Each invocation reads one event from stdin and exits. There is no
  long-running buffering — see write_to_file() for the synchronous
  write-with-lock used here. (BufferedLogWriter was removed because the
  process exits after a single event so buffering provided no benefit.)
- Cross-platform file locking guards against concurrent writes when
  multiple hook invocations land at the same time.
- Files are rotated when they exceed WINDSURF_LOG_MAX_SIZE bytes
  (default 50 MB) and a once-per-day pass removes session logs older
  than WINDSURF_LOG_RETENTION_DAYS (default 90).
"""

import sys
import json
import hashlib
import os
import getpass
import socket
import platform
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

# File locking - platform-specific. Lock the whole file (size is computed at
# call time) so concurrent appenders block each other on the full byte range.
if platform.system() == 'Windows':
    import msvcrt

    def lock_file(f) -> None:
        """Acquire exclusive lock on the entire file (Windows).

        The locked byte range is recorded on the file object as
        ``_locked_size`` so the matching ``unlock_file`` releases the
        exact same range — ``msvcrt.locking(LK_UNLCK, size)`` only
        succeeds when ``size`` matches the originally locked range.
        """
        f.seek(0, os.SEEK_END)
        size = f.tell() or 1
        f.seek(0)
        for attempt in range(5):
            try:
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, size)
                f._locked_size = size  # type: ignore[attr-defined]
                return
            except OSError:
                if attempt < 4:
                    time.sleep(0.1)
                else:
                    raise

    def unlock_file(f) -> None:
        """Release lock on the entire file (Windows).

        Uses the size recorded by ``lock_file`` rather than recomputing
        from the file (which now has more bytes after the write) so the
        unlock range matches the lock range exactly.
        """
        size = getattr(f, "_locked_size", None)
        if size is None:
            return  # lock_file was never called or already unlocked
        f.seek(0)
        try:
            msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, size)
        finally:
            try:
                delattr(f, "_locked_size")
            except AttributeError:
                pass
else:
    import fcntl

    def lock_file(f) -> None:
        """Acquire exclusive lock on file (Unix)."""
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)

    def unlock_file(f) -> None:
        """Release lock on file (Unix)."""
        fcntl.flock(f.fileno(), fcntl.LOCK_UN)


# ---------------------------------------------------------------------------
# Log directory + event metadata
# ---------------------------------------------------------------------------
# The canonical implementations live in `windsurf_paths` and `constants`.
# Hooks run as a subprocess that may not have the repo on sys.path, so we
# fall back to a self-contained local copy when imports fail.

def _standalone_get_log_dir() -> Path:
    """Fallback log directory discovery for hook-subprocess context.

    Used only when windsurf_paths cannot be imported (e.g. the logger was
    copied to the Windsurf data directory and is running outside the repo).
    Mirrors windsurf_paths.get_default_log_output_dir().
    """
    env_dir = os.getenv("WINDSURF_LOG_DIR")
    if env_dir:
        return Path(env_dir).expanduser()
    home = Path.home()
    codeium_logs = home / ".codeium" / "windsurf" / "logs"
    if codeium_logs.parent.exists():
        return codeium_logs
    windsurf_logs = home / ".windsurf" / "logs"
    if windsurf_logs.parent.exists():
        return windsurf_logs
    return codeium_logs


try:
    from windsurf_paths import get_default_log_output_dir as _get_log_dir
except ImportError:
    _get_log_dir = _standalone_get_log_dir

LOG_DIR = _get_log_dir()
if isinstance(LOG_DIR, str):
    LOG_DIR = Path(LOG_DIR)

MAX_CONTENT_LENGTH = int(os.getenv("WINDSURF_MAX_CONTENT_LENGTH", "100000"))

# Log rotation / retention configuration.
LOG_MAX_SIZE_BYTES = int(os.getenv("WINDSURF_LOG_MAX_SIZE", str(50 * 1024 * 1024)))
LOG_MAX_FILES = int(os.getenv("WINDSURF_LOG_MAX_FILES", "5"))
LOG_RETENTION_DAYS = int(os.getenv("WINDSURF_LOG_RETENTION_DAYS", "90"))

# Event category / phase mappings — single source of truth in constants.py.
_FALLBACK_EVENT_CATEGORIES = {
    "pre_user_prompt": "prompt",
    "pre_read_code": "file_read",
    "post_read_code": "file_read",
    "pre_write_code": "file_write",
    "post_write_code": "file_write",
    "pre_run_command": "command",
    "post_run_command": "command",
    "pre_mcp_tool_use": "mcp",
    "post_mcp_tool_use": "mcp",
}
_FALLBACK_EVENT_PHASES = {
    "pre_user_prompt": "pre",
    "pre_read_code": "pre",
    "post_read_code": "post",
    "pre_write_code": "pre",
    "post_write_code": "post",
    "pre_run_command": "pre",
    "post_run_command": "post",
    "pre_mcp_tool_use": "pre",
    "post_mcp_tool_use": "post",
}
try:
    from constants import EVENT_CATEGORIES, EVENT_PHASES
except ImportError:
    EVENT_CATEGORIES = _FALLBACK_EVENT_CATEGORIES
    EVENT_PHASES = _FALLBACK_EVENT_PHASES


# ---------------------------------------------------------------------------
# File rotation + retention
# ---------------------------------------------------------------------------
def rotate_if_needed(filepath: Path, max_size_bytes: int = LOG_MAX_SIZE_BYTES,
                     max_files: int = LOG_MAX_FILES) -> None:
    """Rotate `filepath` if it exceeds `max_size_bytes`.

    Rotation scheme:
        foo.jsonl   -> foo.jsonl.1
        foo.jsonl.1 -> foo.jsonl.2
        ...
        foo.jsonl.N -> deleted when N > max_files
    """
    try:
        if not filepath.exists():
            return
        if filepath.stat().st_size < max_size_bytes:
            return
    except OSError:
        return

    # Shift existing rotated files outward, oldest first.
    for i in range(max_files, 0, -1):
        src = filepath.with_suffix(filepath.suffix + f".{i}")
        if i >= max_files:
            # Anything at or past max_files is deleted.
            if src.exists():
                try:
                    src.unlink()
                except OSError:
                    pass
            continue
        dst = filepath.with_suffix(filepath.suffix + f".{i + 1}")
        if src.exists():
            try:
                if dst.exists():
                    dst.unlink()
                src.rename(dst)
            except OSError:
                pass

    rotated = filepath.with_suffix(filepath.suffix + ".1")
    try:
        if rotated.exists():
            rotated.unlink()
        filepath.rename(rotated)
    except OSError:
        pass


def cleanup_old_session_logs(retention_days: int = LOG_RETENTION_DAYS) -> None:
    """Delete session logs older than `retention_days`.

    Tracked via a timestamp file (`.last_cleanup`) so the pass only runs
    once per day even when called on every hook invocation.
    """
    if retention_days <= 0:
        return
    sessions_dir = LOG_DIR / "sessions"
    if not sessions_dir.exists():
        return

    marker = LOG_DIR / ".last_cleanup"
    now = time.time()
    try:
        if marker.exists() and (now - marker.stat().st_mtime) < 86400:
            return
    except OSError:
        return

    cutoff = now - retention_days * 86400
    try:
        for entry in sessions_dir.iterdir():
            try:
                if entry.is_file() and entry.stat().st_mtime < cutoff:
                    entry.unlink()
            except OSError:
                continue
    except OSError:
        pass

    try:
        marker.touch()
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Synchronous write-with-lock
# ---------------------------------------------------------------------------
def write_to_file(filepath: Path, content: str) -> None:
    """Append `content` to `filepath` with an exclusive lock.

    Rotation runs before the write so a single oversized line does not
    grow the file past max_size by more than one record.
    """
    filepath.parent.mkdir(parents=True, exist_ok=True)
    rotate_if_needed(filepath)
    try:
        with open(filepath, 'a', encoding='utf-8') as f:
            lock_file(f)
            try:
                f.write(content)
            finally:
                unlock_file(f)
    except (IOError, OSError) as e:
        # Best-effort error log; don't crash the hook subprocess.
        error_log = LOG_DIR / "errors.log"
        try:
            with open(error_log, 'a', encoding='utf-8') as ef:
                ef.write(f"[{datetime.now().isoformat()}] Write error to {filepath}: {e}\n")
        except (IOError, OSError):
            pass


def get_system_info() -> dict:
    """Collect comprehensive system and user information."""
    return {
        "username": getpass.getuser(),
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "platform_version": platform.version(),
        "python_version": platform.python_version(),
        "machine": platform.machine(),
    }


def generate_event_id(action: str, timestamp: str, content_hash: str) -> str:
    """Generate a unique event ID for deduplication and referencing."""
    unique_str = f"{action}_{timestamp}_{content_hash}"
    return hashlib.sha256(unique_str.encode()).hexdigest()[:16]


def compute_content_hash(content: Any) -> str:
    """Compute a SHA-256 prefix hash of content for deduplication tracking.

    SHA-256 is used (instead of MD5) for FedRAMP/STIG compliance. The hash
    is truncated to 12 hex chars; collisions are not security-critical
    here (this is a content-fingerprint for dedup, not authentication).
    """
    content_str = json.dumps(content, sort_keys=True, default=str)
    return hashlib.sha256(content_str.encode()).hexdigest()[:12]


def truncate_content(content: str, max_length: int = MAX_CONTENT_LENGTH) -> tuple:
    """Truncate content if too long, return content and truncation flag."""
    if len(content) > max_length:
        return content[:max_length], True
    return content, False


def extract_file_info(file_path: str) -> dict:
    """Extract metadata about a file path."""
    path = Path(file_path)
    return {
        "file_path": file_path,
        "file_name": path.name,
        "file_extension": path.suffix.lstrip(".") if path.suffix else None,
        "directory": str(path.parent),
        "is_hidden": path.name.startswith("."),
    }


def process_edits(edits: list) -> dict:
    """Process code edits and extract statistics."""
    if not edits:
        return {"edits": [], "edit_count": 0, "total_lines_removed": 0, "total_lines_added": 0}

    processed_edits = []
    total_lines_removed = 0
    total_lines_added = 0

    for edit in edits:
        old_string = edit.get("old_string", "")
        new_string = edit.get("new_string", "")

        old_lines = old_string.count("\n") + (1 if old_string else 0)
        new_lines = new_string.count("\n") + (1 if new_string else 0)

        old_truncated, old_was_truncated = truncate_content(old_string)
        new_truncated, new_was_truncated = truncate_content(new_string)

        processed_edits.append({
            "old_string": old_truncated,
            "new_string": new_truncated,
            "old_string_truncated": old_was_truncated,
            "new_string_truncated": new_was_truncated,
            "old_length": len(old_string),
            "new_length": len(new_string),
            "old_lines": old_lines,
            "new_lines": new_lines,
            "lines_delta": new_lines - old_lines,
            "char_delta": len(new_string) - len(old_string),
        })

        total_lines_removed += old_lines
        total_lines_added += new_lines

    return {
        "edits": processed_edits,
        "edit_count": len(processed_edits),
        "total_lines_removed": total_lines_removed,
        "total_lines_added": total_lines_added,
        "net_lines_delta": total_lines_added - total_lines_removed,
    }


def process_pre_user_prompt(tool_info: dict) -> dict:
    """Process pre_user_prompt event data."""
    user_prompt = tool_info.get("user_prompt", "")
    prompt_truncated, was_truncated = truncate_content(user_prompt)

    return {
        "user_prompt": prompt_truncated,
        "prompt_truncated": was_truncated,
        "prompt_length": len(user_prompt),
        "prompt_word_count": len(user_prompt.split()),
        "prompt_line_count": user_prompt.count("\n") + 1,
        "prompt_hash": compute_content_hash(user_prompt),
    }


def process_read_code(tool_info: dict, is_post: bool) -> dict:
    """Process pre_read_code or post_read_code event data."""
    file_path = tool_info.get("file_path", "")
    result = extract_file_info(file_path)
    result["operation"] = "read"
    result["completed"] = is_post
    return result


def process_write_code(tool_info: dict, is_post: bool) -> dict:
    """Process pre_write_code or post_write_code event data."""
    file_path = tool_info.get("file_path", "")
    edits = tool_info.get("edits", [])

    result = extract_file_info(file_path)
    result["operation"] = "write"
    result["completed"] = is_post
    result.update(process_edits(edits))

    return result


def process_run_command(tool_info: dict, is_post: bool) -> dict:
    """Process pre_run_command or post_run_command event data."""
    command_line = tool_info.get("command_line", "")
    cwd = tool_info.get("cwd", "")

    # Extract command name (first word)
    command_parts = command_line.split()
    command_name = command_parts[0] if command_parts else ""

    return {
        "command_line": command_line,
        "command_name": command_name,
        "command_args": command_parts[1:] if len(command_parts) > 1 else [],
        "cwd": cwd,
        "operation": "command",
        "completed": is_post,
        "command_length": len(command_line),
        "command_hash": compute_content_hash(command_line),
    }


def process_mcp_tool(tool_info: dict, is_post: bool) -> dict:
    """Process pre_mcp_tool_use or post_mcp_tool_use event data."""
    server_name = tool_info.get("mcp_server_name", "")
    tool_name = tool_info.get("mcp_tool_name", "")
    tool_args = tool_info.get("mcp_tool_arguments", {})

    result = {
        "mcp_server_name": server_name,
        "mcp_tool_name": tool_name,
        "mcp_tool_arguments": tool_args,
        "mcp_full_tool": f"{server_name}.{tool_name}" if server_name and tool_name else tool_name,
        "operation": "mcp",
        "completed": is_post,
        "arguments_hash": compute_content_hash(tool_args),
    }

    # Include result for post events
    if is_post and "mcp_result" in tool_info:
        mcp_result = tool_info.get("mcp_result", "")
        result_truncated, was_truncated = truncate_content(str(mcp_result))
        result["mcp_result"] = result_truncated
        result["mcp_result_truncated"] = was_truncated
        result["mcp_result_length"] = len(str(mcp_result))

    return result


def process_event(data: dict) -> dict:
    """Process incoming hook event and create structured log entry."""
    action_name = data.get("agent_action_name", "unknown")
    trajectory_id = data.get("trajectory_id", "")
    execution_id = data.get("execution_id", "")
    timestamp = data.get("timestamp", datetime.now().isoformat())
    tool_info = data.get("tool_info", {})

    # Get system info
    system_info = get_system_info()

    # Determine event category and phase
    category = EVENT_CATEGORIES.get(action_name, "unknown")
    phase = EVENT_PHASES.get(action_name, "unknown")
    is_post = phase == "post"

    # Process event-specific data
    event_data = {}
    if action_name == "pre_user_prompt":
        event_data = process_pre_user_prompt(tool_info)
    elif action_name in ("pre_read_code", "post_read_code"):
        event_data = process_read_code(tool_info, is_post)
    elif action_name in ("pre_write_code", "post_write_code"):
        event_data = process_write_code(tool_info, is_post)
    elif action_name in ("pre_run_command", "post_run_command"):
        event_data = process_run_command(tool_info, is_post)
    elif action_name in ("pre_mcp_tool_use", "post_mcp_tool_use"):
        event_data = process_mcp_tool(tool_info, is_post)

    # Compute content hash for the event
    content_hash = compute_content_hash(event_data)
    event_id = generate_event_id(action_name, timestamp, content_hash)

    log_entry = {
        # Core metadata
        "event_id": event_id,
        "timestamp": timestamp,
        "trajectory_id": trajectory_id,
        "execution_id": execution_id,
        "action": action_name,
        "category": category,
        "phase": phase,

        # System context
        "system": system_info,

        # Event-specific data
        "data": event_data,

        # Raw tool_info preserved for completeness
        "raw_tool_info": tool_info,
    }

    return log_entry


def write_logs(log_entry: dict) -> None:
    """Write log entry to category, action, and session JSONL files."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    cleanup_old_session_logs()

    action = log_entry["action"]
    category = log_entry["category"]
    json_line = json.dumps(log_entry) + "\n"

    # 1. Master log - all events
    write_to_file(LOG_DIR / "all_events.jsonl", json_line)

    # 2. Category-specific logs for easy filtering
    write_to_file(LOG_DIR / f"{category}.jsonl", json_line)

    # 3. Action-specific logs for granular analysis
    write_to_file(LOG_DIR / f"{action}.jsonl", json_line)

    # 4. Session log (grouped by trajectory)
    trajectory_id = log_entry.get("trajectory_id")
    if trajectory_id:
        session_dir = LOG_DIR / "sessions"
        session_dir.mkdir(exist_ok=True)
        # Sanitize trajectory_id to prevent path traversal
        safe_trajectory_id = "".join(c for c in trajectory_id if c.isalnum() or c in "-_")
        write_to_file(session_dir / f"{safe_trajectory_id}.jsonl", json_line)

    # 5. Code changes log (only write events with edits)
    if category == "file_write" and log_entry["data"].get("edit_count", 0) > 0:
        write_to_file(LOG_DIR / "code_changes.jsonl", json_line)

    # 6. Human-readable summary log
    write_human_readable(log_entry)


def write_human_readable(log_entry: dict) -> None:
    """Write a human-readable summary for quick review."""
    summary_log = LOG_DIR / "summary.log"

    action = log_entry["action"]
    timestamp = log_entry["timestamp"]
    system = log_entry["system"]
    data = log_entry["data"]

    lines = [
        f"\n{'='*80}",
        f"[{timestamp}] {action}",
        f"User: {system['username']}@{system['hostname']}",
    ]

    if log_entry.get("trajectory_id"):
        lines.append(f"Trajectory: {log_entry['trajectory_id']}")

    if action == "pre_user_prompt":
        prompt = data.get("user_prompt", "")[:500]
        lines.append(f"Prompt ({data.get('prompt_length', 0)} chars):")
        lines.append(prompt)
        if data.get("prompt_truncated"):
            lines.append("... [truncated]")

    elif action in ("pre_read_code", "post_read_code"):
        lines.append(f"File: {data.get('file_path', 'unknown')}")

    elif action in ("pre_write_code", "post_write_code"):
        lines.append(f"File: {data.get('file_path', 'unknown')}")
        lines.append(f"Edits: {data.get('edit_count', 0)}, Lines: +{data.get('total_lines_added', 0)}/-{data.get('total_lines_removed', 0)}")

    elif action in ("pre_run_command", "post_run_command"):
        lines.append(f"Command: {data.get('command_line', 'unknown')}")
        lines.append(f"CWD: {data.get('cwd', 'unknown')}")

    elif action in ("pre_mcp_tool_use", "post_mcp_tool_use"):
        lines.append(f"MCP Tool: {data.get('mcp_full_tool', 'unknown')}")
        lines.append(f"Arguments: {json.dumps(data.get('mcp_tool_arguments', {}))[:200]}")

    write_to_file(summary_log, '\n'.join(lines) + '\n')


def log_error(message: str) -> None:
    """Log an error message to the error log."""
    error_log = LOG_DIR / "errors.log"
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with open(error_log, "a", encoding='utf-8') as f:
            lock_file(f)
            try:
                f.write(f"[{datetime.now().isoformat()}] {message}\n")
            finally:
                unlock_file(f)
    except (IOError, OSError):
        pass  # Can't log the error, just continue


def main():
    """Main entry point for the Cascade logger."""
    input_data = ""
    try:
        input_data = sys.stdin.read()

        if not input_data.strip():
            sys.exit(0)

        data = json.loads(input_data)
        log_entry = process_event(data)
        write_logs(log_entry)

        sys.exit(0)

    except json.JSONDecodeError as e:
        log_error(f"JSON parse error: {e}\nInput: {input_data[:1000]}")
        sys.exit(1)

    except Exception as e:
        log_error(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
