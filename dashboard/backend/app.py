#!/usr/bin/env python3
"""Flask backend for the Windsurf Logger Dashboard."""
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import json
import os
import re
import csv
import io
import sys
import time
import threading
from pathlib import Path
from datetime import datetime, timedelta
from functools import wraps
from collections import OrderedDict
from typing import Optional, Dict, List, Any, Generator

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
try:
    from config import (
        LOG_DIR, FLASK_HOST, FLASK_PORT, FLASK_DEBUG,
        DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, CACHE_TTL, CACHE_MAX_SIZE,
        RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW, CORS_ORIGINS, ALLOWED_BROWSE_PATHS
    )
except ImportError:
    # Fallback defaults if config not available
    LOG_DIR = Path(__file__).parent.parent.parent / "logs"
    FLASK_HOST = "0.0.0.0"
    FLASK_PORT = 5173
    FLASK_DEBUG = False
    DEFAULT_PAGE_SIZE = 100
    MAX_PAGE_SIZE = 1000
    CACHE_TTL = 60
    CACHE_MAX_SIZE = 100
    RATE_LIMIT_REQUESTS = 100
    RATE_LIMIT_WINDOW = 60
    CORS_ORIGINS = ["*"]
    ALLOWED_BROWSE_PATHS = [str(Path(__file__).parent.parent.parent), os.path.expanduser("~")]

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')
CORS(app, origins=CORS_ORIGINS)

DEFAULT_LOG_DIR = str(LOG_DIR)


# ============================================================================
# LRU Cache Implementation
# ============================================================================
class LRUCache:
    """Thread-safe LRU cache with TTL support."""
    
    def __init__(self, max_size: int = CACHE_MAX_SIZE, ttl: int = CACHE_TTL):
        self.max_size = max_size
        self.ttl = ttl
        self.cache: OrderedDict = OrderedDict()
        self.timestamps: Dict[str, float] = {}
        self.lock = threading.Lock()
    
    def get(self, key: str) -> Optional[Any]:
        with self.lock:
            if key not in self.cache:
                return None
            if time.time() - self.timestamps[key] > self.ttl:
                del self.cache[key]
                del self.timestamps[key]
                return None
            self.cache.move_to_end(key)
            return self.cache[key]
    
    def set(self, key: str, value: Any) -> None:
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
            else:
                if len(self.cache) >= self.max_size:
                    oldest = next(iter(self.cache))
                    del self.cache[oldest]
                    del self.timestamps[oldest]
            self.cache[key] = value
            self.timestamps[key] = time.time()
    
    def invalidate(self, pattern: Optional[str] = None) -> None:
        with self.lock:
            if pattern is None:
                self.cache.clear()
                self.timestamps.clear()
            else:
                keys_to_delete = [k for k in self.cache if pattern in k]
                for key in keys_to_delete:
                    del self.cache[key]
                    del self.timestamps[key]


# Global cache instance
cache = LRUCache()


# ============================================================================
# Rate Limiting
# ============================================================================
class RateLimiter:
    """Simple in-memory rate limiter."""
    
    def __init__(self, max_requests: int = RATE_LIMIT_REQUESTS, window: int = RATE_LIMIT_WINDOW):
        self.max_requests = max_requests
        self.window = window
        self.requests: Dict[str, List[float]] = {}
        self.lock = threading.Lock()
    
    def is_allowed(self, client_ip: str) -> bool:
        with self.lock:
            now = time.time()
            if client_ip not in self.requests:
                self.requests[client_ip] = []
            
            # Remove old requests outside the window
            self.requests[client_ip] = [
                t for t in self.requests[client_ip] 
                if now - t < self.window
            ]
            
            if len(self.requests[client_ip]) >= self.max_requests:
                return False
            
            self.requests[client_ip].append(now)
            return True


rate_limiter = RateLimiter()


def rate_limit(f):
    """Decorator to apply rate limiting to endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = request.remote_addr or "unknown"
        if not rate_limiter.is_allowed(client_ip):
            return jsonify({
                "error": "Rate limit exceeded",
                "retry_after": RATE_LIMIT_WINDOW
            }), 429
        return f(*args, **kwargs)
    return decorated_function


# ============================================================================
# Input Validation
# ============================================================================
def validate_path(path: str) -> bool:
    """Validate that a path is safe and within allowed directories."""
    try:
        resolved = Path(path).resolve()
        return any(
            str(resolved).startswith(str(Path(allowed).resolve()))
            for allowed in ALLOWED_BROWSE_PATHS
        )
    except (ValueError, OSError):
        return False


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal."""
    return os.path.basename(filename)

# ============================================================================
# Constants
# ============================================================================
CATEGORY_COLORS = {
    "prompt": {"bg": "blue", "label": "Prompt"},
    "file_read": {"bg": "yellow", "label": "File Read"},
    "file_write": {"bg": "green", "label": "Code Change"},
    "command": {"bg": "orange", "label": "Command"},
    "mcp": {"bg": "purple", "label": "MCP Tool"},
}


# ============================================================================
# File Parsing with Streaming Support
# ============================================================================
def stream_jsonl_file(filepath: str) -> Generator[Dict, None, None]:
    """Stream JSONL file line by line to reduce memory usage."""
    if not os.path.exists(filepath):
        return
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entry = json.loads(line)
                        yield normalize_entry(entry)
                    except json.JSONDecodeError:
                        continue
    except (IOError, OSError) as e:
        app.logger.error(f"Error reading file {filepath}: {e}")


def parse_jsonl_file(filepath: str, limit: Optional[int] = None, offset: int = 0) -> List[Dict]:
    """Parse a JSONL file with optional pagination."""
    entries = []
    count = 0
    
    for entry in stream_jsonl_file(filepath):
        if count < offset:
            count += 1
            continue
        
        entries.append(entry)
        count += 1
        
        if limit and len(entries) >= limit:
            break
    
    return entries


def count_jsonl_entries(filepath: str) -> int:
    """Count entries in a JSONL file efficiently."""
    if not os.path.exists(filepath) or not filepath.endswith('.jsonl'):
        return 0
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return sum(1 for line in f if line.strip())
    except (IOError, OSError):
        return 0


def normalize_entry(entry):
    """Normalize entry to handle both old and new log formats."""
    # New format has 'category' and 'action', old format has 'type' and 'action'
    if 'category' not in entry and 'type' in entry:
        # Old format: map type to category
        entry['category'] = entry['type']
    
    # Ensure we have a category
    if 'category' not in entry:
        entry['category'] = 'unknown'
    
    # Extract user from system object if present (new format)
    if 'system' in entry and isinstance(entry['system'], dict):
        if 'username' in entry['system']:
            entry['user'] = entry['system']['username']
        if 'hostname' in entry['system']:
            entry['hostname'] = entry['system']['hostname']
    
    # Extract content from data object if present (new format)
    if 'data' in entry and isinstance(entry['data'], dict):
        data = entry['data']
        # For prompts
        if 'user_prompt' in data:
            entry['content'] = data['user_prompt']
        # For file operations
        if 'file_path' in data:
            entry['file_path'] = data['file_path']
        # For commands
        if 'command_line' in data:
            entry['command_line'] = data['command_line']
        # For MCP
        if 'mcp_tool_name' in data:
            entry['mcp_tool_name'] = data['mcp_tool_name']
    
    return entry


# Action to category mapping for text log parsing
ACTION_TO_CATEGORY = {
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


def parse_text_log(filepath):
    """Parse a human-readable log file and return structured entries."""
    entries = []
    if not os.path.exists(filepath):
        return entries
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (IOError, OSError) as e:
        app.logger.error(f"Error reading text log {filepath}: {e}")
        return entries
    
    # Split by separator line (80 equals signs)
    blocks = re.split(r'\n={70,}\n', content)
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        
        entry = {"raw": block, "category": "unknown"}
        lines = block.split('\n')
        content_lines = []  # Collect content lines (e.g., prompt text)
        capturing_content = False
        
        for i, line in enumerate(lines):
            # Parse timestamp format: [2025-12-22T20:43:03.758814] action_name
            if line.startswith('[') and ']' in line:
                timestamp_part = line.split(']')[0]
                entry['timestamp'] = timestamp_part[1:]  # Remove opening bracket
                action_part = line.split(']')[1].strip()
                if action_part:
                    entry['action'] = action_part
                    # Map action to category
                    entry['category'] = ACTION_TO_CATEGORY.get(action_part, 'unknown')
            elif line.startswith('User:'):
                # Parse "User: username@hostname" format
                user_info = line.replace('User:', '').strip()
                if '@' in user_info:
                    parts = user_info.split('@')
                    entry['user'] = parts[0]
                    entry['hostname'] = parts[1] if len(parts) > 1 else None
                else:
                    entry['user'] = user_info
            elif line.startswith('Trajectory:'):
                entry['trajectory_id'] = line.replace('Trajectory:', '').strip()
            elif line.startswith('Trajectory ID:'):
                entry['trajectory_id'] = line.replace('Trajectory ID:', '').strip()
            elif line.startswith('Action:'):
                action_val = line.replace('Action:', '').strip()
                entry['action'] = action_val
                entry['category'] = ACTION_TO_CATEGORY.get(action_val, 'unknown')
            elif line.startswith('Prompt'):
                # Start capturing content after this line
                capturing_content = True
            elif line.startswith('File:'):
                file_val = line.replace('File:', '').strip()
                entry['file'] = file_val
                entry['file_path'] = file_val
                # Build data object for consistency with JSONL format
                if 'data' not in entry:
                    entry['data'] = {}
                entry['data']['file_path'] = file_val
            elif line.startswith('Command:'):
                cmd_val = line.replace('Command:', '').strip()
                entry['command_line'] = cmd_val
                if 'data' not in entry:
                    entry['data'] = {}
                entry['data']['command_line'] = cmd_val
            elif line.startswith('CWD:'):
                cwd_val = line.replace('CWD:', '').strip()
                if 'data' not in entry:
                    entry['data'] = {}
                entry['data']['cwd'] = cwd_val
            elif line.startswith('Edits:'):
                # Parse "Edits: N, Lines: +X/-Y"
                if 'data' not in entry:
                    entry['data'] = {}
                match = re.match(r'Edits:\s*(\d+)', line)
                if match:
                    entry['data']['edit_count'] = int(match.group(1))
            elif line.startswith('MCP Tool:'):
                mcp_val = line.replace('MCP Tool:', '').strip()
                if 'data' not in entry:
                    entry['data'] = {}
                entry['data']['mcp_full_tool'] = mcp_val
                entry['data']['mcp_tool_name'] = mcp_val
            elif line.startswith('Arguments:'):
                args_val = line.replace('Arguments:', '').strip()
                if 'data' not in entry:
                    entry['data'] = {}
                try:
                    entry['data']['mcp_tool_arguments'] = json.loads(args_val)
                except json.JSONDecodeError:
                    entry['data']['mcp_tool_arguments'] = args_val
            elif capturing_content and line.strip():
                # Collect content lines after "Prompt" header
                if not line.startswith('... [truncated]'):
                    content_lines.append(line)
        
        # Join collected content
        if content_lines:
            content = '\n'.join(content_lines)
            entry['content'] = content
            if 'data' not in entry:
                entry['data'] = {}
            entry['data']['user_prompt'] = content
        
        if 'timestamp' in entry:
            entries.append(entry)
    
    return entries


def count_text_log_entries(filepath: str) -> int:
    """Count entries in a text log file by counting separator blocks."""
    if not os.path.exists(filepath) or not filepath.endswith('.log'):
        return 0
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        # Count blocks separated by equals signs (80 char separators)
        blocks = re.split(r'\n={70,}\n', content)
        return sum(1 for block in blocks if block.strip())
    except (IOError, OSError):
        return 0


def count_log_entries(filepath: str) -> int:
    """Count number of entries in a log file (JSONL or text format)."""
    if filepath.endswith('.jsonl'):
        return count_jsonl_entries(filepath)
    elif filepath.endswith('.log'):
        return count_text_log_entries(filepath)
    return 0


# ============================================================================
# API Endpoints
# ============================================================================
@app.route('/api/logs/files', methods=['GET'])
@rate_limit
def get_log_files():
    """Get list of available log files in a directory."""
    log_dir = request.args.get('dir', DEFAULT_LOG_DIR)
    
    # Security: Validate path
    if not validate_path(log_dir):
        return jsonify({"error": "Access denied to this directory"}), 403
    
    if not os.path.exists(log_dir):
        return jsonify({"error": f"Directory not found: {log_dir}"}), 404
    
    # Check cache
    cache_key = f"files:{log_dir}"
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached)
    
    files = []
    try:
        for f in os.listdir(log_dir):
            filepath = os.path.join(log_dir, f)
            if os.path.isfile(filepath) and (f.endswith('.jsonl') or f.endswith('.log')):
                stat = os.stat(filepath)
                entry_count = count_log_entries(filepath)
                files.append({
                    "name": f,
                    "path": filepath,
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "type": "jsonl" if f.endswith('.jsonl') else "log",
                    "entries": entry_count
                })
    except (IOError, OSError) as e:
        return jsonify({"error": f"Error reading directory: {str(e)}"}), 500
    
    files.sort(key=lambda x: x['modified'], reverse=True)
    result = {"files": files, "directory": log_dir}
    cache.set(cache_key, result)
    return jsonify(result)


@app.route('/api/logs/data', methods=['GET'])
@rate_limit
def get_log_data():
    """Get log data from specified file(s) with pagination and filter support."""
    filepaths = request.args.getlist('files')
    page = max(1, int(request.args.get('page', 1)))
    page_size = min(MAX_PAGE_SIZE, int(request.args.get('page_size', DEFAULT_PAGE_SIZE)))
    
    # Filter parameters
    category = request.args.get('category')
    user = request.args.get('user')
    session = request.args.get('session')
    query = request.args.get('q', '')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    
    if not filepaths:
        filepaths = [os.path.join(DEFAULT_LOG_DIR, 'all_events.jsonl')]
    
    # Validate all paths
    for filepath in filepaths:
        if not validate_path(filepath):
            return jsonify({"error": f"Access denied: {filepath}"}), 403
    
    all_entries = []
    
    for filepath in filepaths:
        if not os.path.exists(filepath):
            continue
        
        if filepath.endswith('.jsonl'):
            entries = parse_jsonl_file(filepath)
        else:
            entries = parse_text_log(filepath)
        
        for entry in entries:
            entry['source_file'] = os.path.basename(filepath)
        all_entries.extend(entries)
    
    # Apply filters
    filtered_entries = []
    for entry in all_entries:
        # Category filter
        entry_category = entry.get('category', entry.get('type', ''))
        if category and category != 'all' and entry_category != category:
            continue
        
        # User filter
        if user and user != 'all' and entry.get('user') != user:
            continue
        
        # Session filter
        if session and session != 'all' and entry.get('trajectory_id') != session:
            continue
        
        # Date range filter
        timestamp = entry.get('timestamp', '')
        if date_from and timestamp < date_from:
            continue
        if date_to and timestamp > date_to:
            continue
        
        # Text search
        if query:
            searchable = get_searchable_text(entry)
            if query.lower() not in searchable.lower():
                continue
        
        filtered_entries.append(entry)
    
    # Sort by timestamp
    filtered_entries.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    # Apply pagination
    total = len(filtered_entries)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_entries = filtered_entries[start_idx:end_idx]
    
    return jsonify({
        "entries": paginated_entries,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        "files_loaded": filepaths,
        "filters_applied": {
            "category": category,
            "user": user,
            "session": session,
            "query": query,
            "date_from": date_from,
            "date_to": date_to
        }
    })


@app.route('/api/logs/stats', methods=['GET'])
@rate_limit
def get_stats():
    """Get statistics about the logs."""
    log_dir = request.args.get('dir', DEFAULT_LOG_DIR)
    
    stats = {
        "total_prompts": 0,
        "total_responses": 0,
        "total_code_blocks": 0,
        "total_file_reads": 0,
        "total_file_writes": 0,
        "total_commands": 0,
        "total_mcp_calls": 0,
        "users": set(),
        "sessions": set(),
        "date_range": {"start": None, "end": None},
        "categories": {}
    }
    
    # Try new format first, fall back to old
    all_events_path = os.path.join(log_dir, 'all_events.jsonl')
    consolidated_path = os.path.join(log_dir, 'consolidated.jsonl')
    
    log_path = all_events_path if os.path.exists(all_events_path) else consolidated_path
    
    if os.path.exists(log_path):
        entries = parse_jsonl_file(log_path)
        
        timestamps = []
        for entry in entries:
            category = entry.get('category', entry.get('type', 'unknown'))
            
            # Count by category
            stats['categories'][category] = stats['categories'].get(category, 0) + 1
            
            # Legacy counters
            if category == 'prompt':
                stats['total_prompts'] += 1
            elif category == 'response':
                stats['total_responses'] += 1
                stats['total_code_blocks'] += entry.get('code_block_count', 0)
            elif category == 'file_read':
                stats['total_file_reads'] += 1
            elif category == 'file_write':
                stats['total_file_writes'] += 1
                # Count edits
                if 'data' in entry and 'edit_count' in entry['data']:
                    stats['total_code_blocks'] += entry['data']['edit_count']
            elif category == 'command':
                stats['total_commands'] += 1
            elif category == 'mcp':
                stats['total_mcp_calls'] += 1
            
            if entry.get('user'):
                stats['users'].add(entry['user'])
            if entry.get('trajectory_id'):
                stats['sessions'].add(entry['trajectory_id'])
            if entry.get('timestamp'):
                timestamps.append(entry['timestamp'])
        
        if timestamps:
            timestamps.sort()
            stats['date_range']['start'] = timestamps[0]
            stats['date_range']['end'] = timestamps[-1]
    
    stats['users'] = list(stats['users'])
    stats['sessions'] = list(stats['sessions'])
    stats['unique_users'] = len(stats['users'])
    stats['unique_sessions'] = len(stats['sessions'])
    stats['total_events'] = sum(stats['categories'].values())
    
    return jsonify(stats)


@app.route('/api/logs/search', methods=['GET'])
@rate_limit
def search_logs():
    """Advanced search with multiple filter options."""
    query = request.args.get('q', '')
    log_dir = request.args.get('dir', DEFAULT_LOG_DIR)
    category = request.args.get('category')  # prompt, file_read, file_write, command, mcp
    user = request.args.get('user')
    session = request.args.get('session')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    use_regex = request.args.get('regex', 'false').lower() == 'true'
    file_ext = request.args.get('file_ext')
    command_name = request.args.get('command_name')
    
    # Try new format first
    all_events_path = os.path.join(log_dir, 'all_events.jsonl')
    consolidated_path = os.path.join(log_dir, 'consolidated.jsonl')
    log_path = all_events_path if os.path.exists(all_events_path) else consolidated_path
    
    if not os.path.exists(log_path):
        return jsonify({"entries": [], "total": 0})
    
    entries = parse_jsonl_file(log_path)
    results = []
    
    # Compile regex if needed
    regex_pattern = None
    if query and use_regex:
        try:
            regex_pattern = re.compile(query, re.IGNORECASE)
        except re.error:
            return jsonify({"error": "Invalid regex pattern", "entries": [], "total": 0})
    
    for entry in entries:
        # Category filter
        entry_category = entry.get('category', entry.get('type', ''))
        if category and entry_category != category:
            continue
        
        # User filter
        if user and entry.get('user') != user:
            continue
        
        # Session filter
        if session and entry.get('trajectory_id') != session:
            continue
        
        # Date range filter
        timestamp = entry.get('timestamp', '')
        if date_from and timestamp < date_from:
            continue
        if date_to and timestamp > date_to:
            continue
        
        # File extension filter (for file operations)
        if file_ext:
            data = entry.get('data', {})
            entry_ext = data.get('file_extension', '')
            if entry_ext != file_ext:
                continue
        
        # Command name filter
        if command_name:
            data = entry.get('data', {})
            entry_cmd = data.get('command_name', '')
            if entry_cmd != command_name:
                continue
        
        # Text search
        if query:
            searchable = get_searchable_text(entry)
            if use_regex and regex_pattern:
                if not regex_pattern.search(searchable):
                    continue
            else:
                if query.lower() not in searchable.lower():
                    continue
        
        results.append(entry)
    
    results.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    return jsonify({
        "entries": results,
        "total": len(results),
        "query": query,
        "filters_applied": {
            "category": category,
            "user": user,
            "session": session,
            "date_from": date_from,
            "date_to": date_to,
            "regex": use_regex,
            "file_ext": file_ext,
            "command_name": command_name
        }
    })


def get_searchable_text(entry):
    """Extract all searchable text from an entry."""
    texts = []
    
    # Direct content
    if 'content' in entry:
        texts.append(str(entry['content']))
    
    # Data object
    if 'data' in entry:
        data = entry['data']
        for key in ['user_prompt', 'file_path', 'command_line', 'mcp_tool_name', 'mcp_server_name']:
            if key in data:
                texts.append(str(data[key]))
        # Include edits content
        if 'edits' in data:
            for edit in data['edits']:
                texts.append(str(edit.get('old_string', '')))
                texts.append(str(edit.get('new_string', '')))
    
    # Raw tool info
    if 'raw_tool_info' in entry:
        texts.append(json.dumps(entry['raw_tool_info']))
    
    return ' '.join(texts)


@app.route('/api/logs/sessions', methods=['GET'])
@rate_limit
def get_sessions():
    """Get all sessions with their events grouped."""
    log_dir = request.args.get('dir', DEFAULT_LOG_DIR)
    
    all_events_path = os.path.join(log_dir, 'all_events.jsonl')
    consolidated_path = os.path.join(log_dir, 'consolidated.jsonl')
    log_path = all_events_path if os.path.exists(all_events_path) else consolidated_path
    
    if not os.path.exists(log_path):
        return jsonify({"sessions": []})
    
    entries = parse_jsonl_file(log_path)
    
    # Group by trajectory_id
    sessions = {}
    for entry in entries:
        traj_id = entry.get('trajectory_id')
        if not traj_id:
            traj_id = 'no_session'
        
        if traj_id not in sessions:
            sessions[traj_id] = {
                "id": traj_id,
                "events": [],
                "start_time": None,
                "end_time": None,
                "event_count": 0,
                "categories": {}
            }
        
        sessions[traj_id]["events"].append(entry)
        sessions[traj_id]["event_count"] += 1
        
        # Track categories
        cat = entry.get('category', 'unknown')
        sessions[traj_id]["categories"][cat] = sessions[traj_id]["categories"].get(cat, 0) + 1
        
        # Track time range
        ts = entry.get('timestamp')
        if ts:
            if not sessions[traj_id]["start_time"] or ts < sessions[traj_id]["start_time"]:
                sessions[traj_id]["start_time"] = ts
            if not sessions[traj_id]["end_time"] or ts > sessions[traj_id]["end_time"]:
                sessions[traj_id]["end_time"] = ts
    
    # Sort events within each session
    for session in sessions.values():
        session["events"].sort(key=lambda x: x.get('timestamp', ''))
    
    # Convert to list and sort by start time
    session_list = list(sessions.values())
    session_list.sort(key=lambda x: x.get('start_time', ''), reverse=True)
    
    return jsonify({"sessions": session_list})


@app.route('/api/logs/metrics', methods=['GET'])
@rate_limit
def get_metrics():
    """Get comprehensive metrics aggregated from ALL log entries."""
    log_dir = request.args.get('dir', DEFAULT_LOG_DIR)
    
    all_events_path = os.path.join(log_dir, 'all_events.jsonl')
    consolidated_path = os.path.join(log_dir, 'consolidated.jsonl')
    log_path = all_events_path if os.path.exists(all_events_path) else consolidated_path
    
    if not os.path.exists(log_path):
        return jsonify({
            "total_events": 0,
            "categories": {},
            "hourly_activity": [0] * 24,
            "daily_activity": [0] * 7,
            "recent_days": [],
            "top_files": [],
            "top_commands": [],
            "top_mcp_tools": [],
            "unique_sessions": 0,
            "total_lines_added": 0,
            "total_lines_removed": 0,
            "unique_files_count": 0,
            "date_range": {"start": None, "end": None}
        })
    
    entries = parse_jsonl_file(log_path)
    
    # Initialize aggregations
    categories = {}
    hourly_activity = [0] * 24
    daily_activity = [0] * 7
    file_changes = {}
    command_usage = {}
    mcp_usage = {}
    sessions = set()
    total_lines_added = 0
    total_lines_removed = 0
    timestamps = []
    
    # Process all entries
    for entry in entries:
        category = entry.get('category', entry.get('type', 'unknown'))
        categories[category] = categories.get(category, 0) + 1
        
        # Timestamp-based aggregations
        ts = entry.get('timestamp')
        if ts:
            timestamps.append(ts)
            try:
                dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                hourly_activity[dt.hour] += 1
                daily_activity[dt.weekday()] += 1  # Monday = 0
            except (ValueError, AttributeError):
                pass
        
        # Session tracking
        if entry.get('trajectory_id'):
            sessions.add(entry['trajectory_id'])
        
        # File changes
        if category == 'file_write':
            data = entry.get('data', {})
            file_path = data.get('file_path', entry.get('file_path', 'unknown'))
            file_name = file_path.split('/')[-1] if file_path else 'unknown'
            file_changes[file_name] = file_changes.get(file_name, 0) + 1
            total_lines_added += data.get('total_lines_added', 0)
            total_lines_removed += data.get('total_lines_removed', 0)
        
        # Command usage
        if category == 'command':
            data = entry.get('data', {})
            cmd = data.get('command_line', entry.get('command_line', 'unknown'))
            cmd_name = cmd.split()[0] if cmd else 'unknown'
            command_usage[cmd_name] = command_usage.get(cmd_name, 0) + 1
        
        # MCP tool usage
        if category == 'mcp':
            data = entry.get('data', {})
            tool = data.get('mcp_tool_name', data.get('mcp_full_tool', 'unknown'))
            mcp_usage[tool] = mcp_usage.get(tool, 0) + 1
    
    # Recent 7 days activity
    now = datetime.now()
    recent_days = []
    for i in range(6, -1, -1):
        date = now - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        day_label = date.strftime('%a')
        count = sum(1 for ts in timestamps if ts.startswith(date_str))
        recent_days.append({
            "label": day_label,
            "date": date_str,
            "count": count
        })
    
    # Sort and limit top lists
    top_files = sorted(file_changes.items(), key=lambda x: x[1], reverse=True)[:10]
    top_commands = sorted(command_usage.items(), key=lambda x: x[1], reverse=True)[:8]
    top_mcp_tools = sorted(mcp_usage.items(), key=lambda x: x[1], reverse=True)[:8]
    
    # Date range
    date_range = {"start": None, "end": None}
    if timestamps:
        timestamps.sort()
        date_range["start"] = timestamps[0]
        date_range["end"] = timestamps[-1]
    
    return jsonify({
        "total_events": len(entries),
        "categories": categories,
        "hourly_activity": hourly_activity,
        "daily_activity": daily_activity,
        "recent_days": recent_days,
        "top_files": [{"name": f, "count": c} for f, c in top_files],
        "top_commands": [{"name": c, "count": n} for c, n in top_commands],
        "top_mcp_tools": [{"name": t, "count": c} for t, c in top_mcp_tools],
        "unique_sessions": len(sessions),
        "total_lines_added": total_lines_added,
        "total_lines_removed": total_lines_removed,
        "unique_files_count": len(file_changes),
        "date_range": date_range
    })


@app.route('/api/logs/export', methods=['GET'])
@rate_limit
def export_logs():
    """Export logs as CSV or JSON."""
    format_type = request.args.get('format', 'json')  # json or csv
    log_dir = request.args.get('dir', DEFAULT_LOG_DIR)
    category = request.args.get('category')
    
    all_events_path = os.path.join(log_dir, 'all_events.jsonl')
    consolidated_path = os.path.join(log_dir, 'consolidated.jsonl')
    log_path = all_events_path if os.path.exists(all_events_path) else consolidated_path
    
    if not os.path.exists(log_path):
        return jsonify({"error": "No logs found"}), 404
    
    entries = parse_jsonl_file(log_path)
    
    # Filter by category if specified
    if category:
        entries = [e for e in entries if e.get('category') == category]
    
    if format_type == 'csv':
        output = io.StringIO()
        
        # Flatten entries for CSV
        flat_entries = []
        for entry in entries:
            flat = {
                'event_id': entry.get('event_id', ''),
                'timestamp': entry.get('timestamp', ''),
                'action': entry.get('action', ''),
                'category': entry.get('category', ''),
                'phase': entry.get('phase', ''),
                'user': entry.get('user', ''),
                'hostname': entry.get('hostname', ''),
                'trajectory_id': entry.get('trajectory_id', ''),
            }
            
            # Add data fields based on category
            data = entry.get('data', {})
            if entry.get('category') == 'prompt':
                flat['content'] = data.get('user_prompt', '')[:500]
            elif entry.get('category') == 'file_write':
                flat['file_path'] = data.get('file_path', '')
                flat['edit_count'] = data.get('edit_count', 0)
            elif entry.get('category') == 'file_read':
                flat['file_path'] = data.get('file_path', '')
            elif entry.get('category') == 'command':
                flat['command'] = data.get('command_line', '')
            elif entry.get('category') == 'mcp':
                flat['mcp_tool'] = data.get('mcp_full_tool', '')
            
            flat_entries.append(flat)
        
        if flat_entries:
            writer = csv.DictWriter(output, fieldnames=flat_entries[0].keys())
            writer.writeheader()
            writer.writerows(flat_entries)
        
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=cascade_logs.csv'}
        )
    else:
        return Response(
            json.dumps(entries, indent=2),
            mimetype='application/json',
            headers={'Content-Disposition': 'attachment; filename=cascade_logs.json'}
        )


@app.route('/api/directories/browse', methods=['GET'])
@rate_limit
def browse_directories():
    """Browse filesystem for log directories."""
    path = request.args.get('path', os.path.expanduser('~'))
    
    # Security: Validate path is within allowed directories
    if not validate_path(path):
        return jsonify({"error": "Access denied to this path"}), 403
    
    if not os.path.exists(path):
        return jsonify({"error": "Path not found"}), 404
    
    if not os.path.isdir(path):
        path = os.path.dirname(path)
    
    items = []
    try:
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            if os.path.isdir(item_path) and not item.startswith('.'):
                has_logs = any(
                    f.endswith('.jsonl') or f.endswith('.log')
                    for f in os.listdir(item_path)
                    if os.path.isfile(os.path.join(item_path, f))
                )
                items.append({
                    "name": item,
                    "path": item_path,
                    "has_logs": has_logs
                })
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    
    items.sort(key=lambda x: x['name'].lower())
    
    return jsonify({
        "current_path": path,
        "parent_path": os.path.dirname(path),
        "items": items
    })


@app.route('/')
def serve_frontend():
    """Serve the React frontend."""
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files."""
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# ============================================================================
# Health & Monitoring Endpoints
# ============================================================================
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.1.0"
    })


@app.route('/api/health', methods=['GET'])
def api_health():
    """Detailed health check with system info."""
    log_dir_exists = os.path.exists(DEFAULT_LOG_DIR)
    log_file_count = 0
    
    if log_dir_exists:
        try:
            log_file_count = len([
                f for f in os.listdir(DEFAULT_LOG_DIR)
                if f.endswith('.jsonl') or f.endswith('.log')
            ])
        except (IOError, OSError):
            pass
    
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.1.0",
        "log_directory": DEFAULT_LOG_DIR,
        "log_directory_exists": log_dir_exists,
        "log_file_count": log_file_count,
        "cache_size": len(cache.cache),
        "rate_limit": {
            "max_requests": RATE_LIMIT_REQUESTS,
            "window_seconds": RATE_LIMIT_WINDOW
        }
    })


@app.route('/api/cache/clear', methods=['POST'])
@rate_limit
def clear_cache():
    """Clear the API cache."""
    cache.invalidate()
    return jsonify({"status": "ok", "message": "Cache cleared"})


# ============================================================================
# Error Handlers
# ============================================================================
@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors."""
    if request.path.startswith('/api/'):
        return jsonify({"error": "Endpoint not found"}), 404
    return send_from_directory(app.static_folder, 'index.html')


@app.errorhandler(500)
def internal_error(e):
    """Handle 500 errors."""
    app.logger.error(f"Internal error: {e}")
    return jsonify({"error": "Internal server error"}), 500


@app.errorhandler(Exception)
def handle_exception(e):
    """Handle unexpected exceptions."""
    app.logger.error(f"Unhandled exception: {e}")
    return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=FLASK_DEBUG, port=FLASK_PORT, host=FLASK_HOST)
