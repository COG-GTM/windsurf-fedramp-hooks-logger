# Windsurf Logger

Comprehensive logging for all Windsurf Cascade hook events with a dashboard for review and analysis.

## Setup

### Automatic Installation (Recommended)

Run the install script to automatically configure hooks for your system:

```bash
python3 install_hooks.py
```

This will detect your Windsurf installation and create the appropriate `hooks.json` configuration.

### Manual Installation

If you prefer manual setup:

1. Generate the hooks configuration for your system:
```bash
python3 windsurf_paths.py
```

2. Copy the generated hooks.json to your Windsurf hooks directory:
```bash
cp hooks.json ~/.codeium/windsurf/hooks.json
```

### Verify Installation

Check discovered paths and configuration:
```bash
python3 install_hooks.py --show-paths
python3 install_hooks.py --print-config
```

## Captured Events

All 9 available Cascade hook events are captured:

| Event | Category | Description |
|-------|----------|-------------|
| `pre_user_prompt` | prompt | User prompts before processing |
| `pre_read_code` | file_read | Before Cascade reads a file |
| `post_read_code` | file_read | After Cascade reads a file |
| `pre_write_code` | file_write | Before Cascade modifies code (includes full diff) |
| `post_write_code` | file_write | After Cascade modifies code (includes full diff) |
| `pre_run_command` | command | Before Cascade runs a terminal command |
| `post_run_command` | command | After Cascade runs a terminal command |
| `pre_mcp_tool_use` | mcp | Before Cascade uses an MCP tool |
| `post_mcp_tool_use` | mcp | After Cascade uses an MCP tool (includes result) |

## Log Files

By default, logs are stored in `~/.codeium/windsurf/logs/` (or the directory specified by `WINDSURF_LOG_DIR` environment variable):

### Master Log
- **all_events.jsonl** - Every event in chronological order

### Category Logs (for filtering by type)
- **prompt.jsonl** - User prompts
- **file_read.jsonl** - File read operations
- **file_write.jsonl** - Code modifications with full edit details
- **command.jsonl** - Terminal command executions
- **mcp.jsonl** - MCP tool invocations

### Action-Specific Logs (granular)
- **pre_user_prompt.jsonl**
- **pre_read_code.jsonl** / **post_read_code.jsonl**
- **pre_write_code.jsonl** / **post_write_code.jsonl**
- **pre_run_command.jsonl** / **post_run_command.jsonl**
- **pre_mcp_tool_use.jsonl** / **post_mcp_tool_use.jsonl**

### Session Logs
- **sessions/{trajectory_id}.jsonl** - Events grouped by conversation

### Special Purpose Logs
- **code_changes.jsonl** - Only write events with actual code edits
- **summary.log** - Human-readable summary for quick review
- **errors.log** - Any logging errors

## Log Entry Structure

Each log entry contains:

```json
{
  "event_id": "unique-16-char-id",
  "trajectory_id": "conversation-id",
  "execution_id": "turn-id",
  "timestamp": "ISO-8601-timestamp",
  "logged_at": "when-logged",
  "action": "pre_write_code",
  "category": "file_write",
  "phase": "pre|post",
  "system": {
    "username": "user",
    "hostname": "machine",
    "platform": "Darwin",
    "platform_version": "...",
    "python_version": "3.x.x",
    "machine": "arm64"
  },
  "data": {
    // Event-specific data (see below)
  },
  "raw_tool_info": {
    // Original data from Cascade
  }
}
```

### Event-Specific Data

**Prompts** (`pre_user_prompt`):
- `user_prompt` - The prompt text
- `prompt_length`, `prompt_word_count`, `prompt_line_count`
- `prompt_hash` - For deduplication

**File Operations** (`*_read_code`, `*_write_code`):
- `file_path`, `file_name`, `file_extension`, `directory`
- `is_hidden` - Whether file starts with `.`
- For writes: `edits[]` array with `old_string`, `new_string`, line counts, deltas

**Commands** (`*_run_command`):
- `command_line` - Full command
- `command_name` - First word (e.g., `npm`)
- `command_args` - Arguments array
- `cwd` - Working directory

**MCP Tools** (`*_mcp_tool_use`):
- `mcp_server_name`, `mcp_tool_name`
- `mcp_tool_arguments` - Arguments passed
- `mcp_result` - Result (post events only)

## Filtering Data

JSONL format allows easy filtering with `jq`:

```bash
# All prompts
cat logs/prompt.jsonl | jq .

# Code changes to Python files
cat logs/file_write.jsonl | jq 'select(.data.file_extension == "py")'

# Commands by a specific user
cat logs/command.jsonl | jq 'select(.system.username == "yourusername")'

# Events in a specific session
cat logs/sessions/abc123.jsonl | jq .

# All npm commands
cat logs/command.jsonl | jq 'select(.data.command_name == "npm")'
```

## Dashboard

A modern web dashboard for viewing and filtering logs with real-time updates.

### Quick Start (Recommended)

Use the launcher script for automatic setup and startup:

```bash
cd dashboard
chmod +x start.sh
./start.sh
```

This script will:
- Automatically create Python virtual environment if needed
- Install all backend and frontend dependencies
- Start both backend (port 5173) and frontend (port 5174) servers
- Handle cleanup when you stop the dashboard

Open http://localhost:5174 in your browser.

### Manual Start

If you prefer manual setup or need to run components separately:

```bash
# Terminal 1 - Backend
cd dashboard/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

# Terminal 2 - Frontend  
cd dashboard/frontend
npm install
npm run dev
```

### Stopping the Dashboard

- **Using launcher**: Press `Ctrl+C` in the terminal running `start.sh`
- **Manual**: Press `Ctrl+C` in both backend and frontend terminals

### Dashboard Features
- **File Selection** - Select which log files to display
- **Directory Browser** - Change log directory paths
- **Search** - Full-text search across all logs
- **Filters** - Filter by category, action, user, session
- **Code Diff View** - View code changes with before/after
- **Statistics** - Overview by category, user, and session
- **Timeline View** - Chronological activity stream
