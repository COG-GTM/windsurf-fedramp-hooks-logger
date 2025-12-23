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
"""

import sys
import json
import hashlib
import os
import getpass
import socket
import platform
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

# Configuration
LOG_DIR = Path("/Users/chasedalton/CascadeProjects/windsurf-logger/logs")
MAX_CONTENT_LENGTH = 100000  # Truncate extremely large content

# Event categories for filtering
EVENT_CATEGORIES = {
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

EVENT_PHASES = {
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
    """Compute a hash of content for deduplication tracking."""
    content_str = json.dumps(content, sort_keys=True, default=str)
    return hashlib.md5(content_str.encode()).hexdigest()[:12]


def truncate_content(content: str, max_length: int = MAX_CONTENT_LENGTH) -> tuple[str, bool]:
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
    
    # Build comprehensive log entry
    log_entry = {
        # Identifiers
        "event_id": event_id,
        "trajectory_id": trajectory_id or None,
        "execution_id": execution_id or None,
        
        # Timing
        "timestamp": timestamp,
        "logged_at": datetime.now().isoformat(),
        
        # Classification (for filtering)
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
    """Write log entry to various log files for different use cases."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    
    action = log_entry["action"]
    category = log_entry["category"]
    
    # 1. Master log - all events
    master_log = LOG_DIR / "all_events.jsonl"
    with open(master_log, "a") as f:
        f.write(json.dumps(log_entry) + "\n")
    
    # 2. Category-specific logs for easy filtering
    category_log = LOG_DIR / f"{category}.jsonl"
    with open(category_log, "a") as f:
        f.write(json.dumps(log_entry) + "\n")
    
    # 3. Action-specific logs for granular analysis
    action_log = LOG_DIR / f"{action}.jsonl"
    with open(action_log, "a") as f:
        f.write(json.dumps(log_entry) + "\n")
    
    # 4. Session log (grouped by trajectory)
    trajectory_id = log_entry.get("trajectory_id")
    if trajectory_id:
        session_dir = LOG_DIR / "sessions"
        session_dir.mkdir(exist_ok=True)
        session_log = session_dir / f"{trajectory_id}.jsonl"
        with open(session_log, "a") as f:
            f.write(json.dumps(log_entry) + "\n")
    
    # 5. Code changes log (only write events with edits)
    if category == "file_write" and log_entry["data"].get("edit_count", 0) > 0:
        code_log = LOG_DIR / "code_changes.jsonl"
        with open(code_log, "a") as f:
            f.write(json.dumps(log_entry) + "\n")
    
    # 6. Human-readable summary log
    write_human_readable(log_entry)


def write_human_readable(log_entry: dict) -> None:
    """Write a human-readable summary for quick review."""
    summary_log = LOG_DIR / "summary.log"
    
    action = log_entry["action"]
    timestamp = log_entry["timestamp"]
    system = log_entry["system"]
    data = log_entry["data"]
    
    with open(summary_log, "a") as f:
        f.write(f"\n{'='*80}\n")
        f.write(f"[{timestamp}] {action}\n")
        f.write(f"User: {system['username']}@{system['hostname']}\n")
        
        if log_entry.get("trajectory_id"):
            f.write(f"Trajectory: {log_entry['trajectory_id']}\n")
        
        if action == "pre_user_prompt":
            prompt = data.get("user_prompt", "")[:500]
            f.write(f"Prompt ({data.get('prompt_length', 0)} chars):\n{prompt}\n")
            if data.get("prompt_truncated"):
                f.write("... [truncated]\n")
        
        elif action in ("pre_read_code", "post_read_code"):
            f.write(f"File: {data.get('file_path', 'unknown')}\n")
        
        elif action in ("pre_write_code", "post_write_code"):
            f.write(f"File: {data.get('file_path', 'unknown')}\n")
            f.write(f"Edits: {data.get('edit_count', 0)}, ")
            f.write(f"Lines: +{data.get('total_lines_added', 0)}/-{data.get('total_lines_removed', 0)}\n")
        
        elif action in ("pre_run_command", "post_run_command"):
            f.write(f"Command: {data.get('command_line', 'unknown')}\n")
            f.write(f"CWD: {data.get('cwd', 'unknown')}\n")
        
        elif action in ("pre_mcp_tool_use", "post_mcp_tool_use"):
            f.write(f"MCP Tool: {data.get('mcp_full_tool', 'unknown')}\n")
            f.write(f"Arguments: {json.dumps(data.get('mcp_tool_arguments', {}))[:200]}\n")


def main():
    """Main entry point for the Cascade logger."""
    try:
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            sys.exit(0)
        
        data = json.loads(input_data)
        log_entry = process_event(data)
        write_logs(log_entry)
        
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        error_log = LOG_DIR / "errors.log"
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with open(error_log, "a") as f:
            f.write(f"[{datetime.now().isoformat()}] JSON parse error: {e}\n")
            f.write(f"Input: {input_data[:1000]}\n")
        sys.exit(1)
        
    except Exception as e:
        error_log = LOG_DIR / "errors.log"
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with open(error_log, "a") as f:
            f.write(f"[{datetime.now().isoformat()}] Error: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
