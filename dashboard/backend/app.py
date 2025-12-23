#!/usr/bin/env python3
"""Flask backend for the Windsurf Logger Dashboard."""
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import json
import os
import re
import csv
import io
from pathlib import Path
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')
CORS(app)

DEFAULT_LOG_DIR = "/Users/chasedalton/CascadeProjects/windsurf-logger/logs"

# Category mappings for the new log structure
CATEGORY_COLORS = {
    "prompt": {"bg": "blue", "label": "Prompt"},
    "file_read": {"bg": "yellow", "label": "File Read"},
    "file_write": {"bg": "green", "label": "Code Change"},
    "command": {"bg": "orange", "label": "Command"},
    "mcp": {"bg": "purple", "label": "MCP Tool"},
}


def parse_jsonl_file(filepath):
    """Parse a JSONL file and return list of entries."""
    entries = []
    if not os.path.exists(filepath):
        return entries
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entry = json.loads(line)
                    # Normalize entry structure for both old and new formats
                    entry = normalize_entry(entry)
                    entries.append(entry)
                except json.JSONDecodeError:
                    continue
    return entries


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


def parse_text_log(filepath):
    """Parse a human-readable log file and return structured entries."""
    entries = []
    if not os.path.exists(filepath):
        return entries
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    blocks = content.split('=' * 80)
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        
        entry = {"raw": block, "category": "unknown"}
        lines = block.split('\n')
        for line in lines:
            if line.startswith('Timestamp:'):
                entry['timestamp'] = line.replace('Timestamp:', '').strip()
            elif line.startswith('User:'):
                entry['user'] = line.replace('User:', '').strip()
            elif line.startswith('Trajectory ID:'):
                entry['trajectory_id'] = line.replace('Trajectory ID:', '').strip()
            elif line.startswith('Action:'):
                entry['action'] = line.replace('Action:', '').strip()
        
        if 'timestamp' in entry:
            entries.append(entry)
    
    return entries


@app.route('/api/logs/files', methods=['GET'])
def get_log_files():
    """Get list of available log files in a directory."""
    log_dir = request.args.get('dir', DEFAULT_LOG_DIR)
    
    if not os.path.exists(log_dir):
        return jsonify({"error": f"Directory not found: {log_dir}"}), 404
    
    files = []
    for f in os.listdir(log_dir):
        filepath = os.path.join(log_dir, f)
        if os.path.isfile(filepath) and (f.endswith('.jsonl') or f.endswith('.log')):
            stat = os.stat(filepath)
            files.append({
                "name": f,
                "path": filepath,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "type": "jsonl" if f.endswith('.jsonl') else "log"
            })
    
    files.sort(key=lambda x: x['modified'], reverse=True)
    return jsonify({"files": files, "directory": log_dir})


@app.route('/api/logs/data', methods=['GET'])
def get_log_data():
    """Get log data from specified file(s)."""
    filepaths = request.args.getlist('files')
    
    if not filepaths:
        # Default to consolidated log
        filepaths = [os.path.join(DEFAULT_LOG_DIR, 'consolidated.jsonl')]
    
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
    
    # Sort by timestamp
    all_entries.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    return jsonify({
        "entries": all_entries,
        "total": len(all_entries),
        "files_loaded": filepaths
    })


@app.route('/api/logs/stats', methods=['GET'])
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


@app.route('/api/logs/export', methods=['GET'])
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
def browse_directories():
    """Browse filesystem for log directories."""
    path = request.args.get('path', os.path.expanduser('~'))
    
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


if __name__ == '__main__':
    app.run(debug=True, port=5173, host='0.0.0.0')
