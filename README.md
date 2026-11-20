# Windsurf Logger

Comprehensive logging for all Windsurf Cascade hook events with a dashboard for review and analysis.

**Architecture:** see [docs/architecture.md](docs/architecture.md) for how hooks, the logger, log storage (local, S3, Azure Blob) and the dashboard fit together, with a [diagram](docs/diagrams/architecture.png) ([SVG](docs/diagrams/architecture.svg), [Graphviz source](docs/diagrams/architecture.dot)).

## Prerequisites

Before installing, ensure you have:
- **Python 3.10+** installed (the minimum in `pyproject.toml`) (`python3 --version` to check)
- **Node.js 18+** and **npm** installed (`node --version` and `npm --version` to check)
- **Windsurf** IDE installed and run at least once (creates required directories)

## Quick Start

### Step 1: Clone or Download This Repository

```bash
git clone <repository-url>
cd windsurf-fedramp-hooks-logger
```

Or download and extract the ZIP file to a location of your choice.

### Step 2: Install the Logging Hooks

Run the installer from the repository directory:

```bash
# macOS/Linux
python3 install_hooks.py

# Windows
python install_hooks.py
```

**What this does:**
- Copies the logger script to your Windsurf data directory
- Creates a `hooks.json` configuration that tells Windsurf to log events
- Backs up any existing hooks configuration

**After installation, restart Windsurf** for the hooks to take effect.

### Step 3: Launch the Dashboard

**Easiest Method - Create a Desktop Shortcut:**
```bash
# macOS/Linux
python3 create_launcher.py

# Windows  
python create_launcher.py
```
Then double-click the shortcut created on your Desktop.

**Alternative - Run Directly:**
```bash
# macOS/Linux
./dashboard/start.sh

# Windows
dashboard\start.bat
```

The dashboard will:
1. Create a Python virtual environment (first run only)
2. Install backend dependencies (first run only)
3. Install frontend dependencies (first run only)
4. Start the backend API on port 5173
5. Start the frontend on port 5174
6. Open your browser to http://localhost:5174

> **Known issue:** the backend imports `config.py` from the repository root, but the start scripts run `app.py` from `dashboard/backend` without adding the root to the import path, so the backend exits with `ModuleNotFoundError: No module named 'config'`. Until that is fixed, start the dashboard from the repository root with `PYTHONPATH` set:
> ```bash
> # macOS/Linux
> PYTHONPATH="$PWD" ./dashboard/start.sh
>
> # Windows (cmd)
> set PYTHONPATH=%CD%
> dashboard\start.bat
> ```

**Alternative - Docker:**
```bash
docker compose up --build
```
This builds the frontend into the image and serves the API and dashboard together on http://localhost:5173, reading logs from `./logs` in the repository (mounted at `/app/logs`). Copy or mount your Windsurf log directory there to view it.

### Step 4: Stop the Dashboard

Press `Ctrl+C` in the terminal window to stop both servers.

---

## Uninstalling

To completely remove the logger and revert Windsurf to its pre-install state:

```bash
# macOS/Linux
python3 uninstall_hooks.py

# Windows
python uninstall_hooks.py
```

**What this does:**
- Removes the hooks configuration
- Removes the installed logger script
- Restores any previous `hooks.json` that existed before installation
- **Preserves your logs** (use `--delete-logs` to also delete logs)

**Options:**
- `--dry-run` — Preview what will be removed without making changes
- `--force` or `-f` — Skip confirmation prompts
- `--delete-logs` — Also delete all collected log files
- `--delete-repo` — Also delete this repository folder
- `--delete-all` — Delete everything (hooks, logs, and repository)
- `--show-paths` — Display all discovered Windsurf paths

**After uninstalling, restart Windsurf** for changes to take effect.

---

## File Locations

The installer automatically detects paths for your system. To see all paths:

```bash
python3 install_hooks.py --show-paths
```

### Typical Locations by OS

| Item | macOS | Linux | Windows |
|------|-------|-------|---------|
| **Hooks Config** | `~/.codeium/windsurf/hooks.json` | `~/.codeium/windsurf/hooks.json` | `%USERPROFILE%\.codeium\windsurf\hooks.json` |
| **Logger Script** | `~/.codeium/windsurf/cascade_logger.py` | `~/.codeium/windsurf/cascade_logger.py` | `%USERPROFILE%\.codeium\windsurf\cascade_logger.py` |
| **Log Output** | `~/.codeium/windsurf/logs/` | `~/.codeium/windsurf/logs/` | `%USERPROFILE%\.codeium\windsurf\logs\` |

> **Note:** If `~/.codeium/windsurf/` doesn't exist, the installer will try `~/.windsurf/` as a fallback.

### Custom Log Location

Set the `WINDSURF_LOG_DIR` environment variable to store logs elsewhere:

```bash
export WINDSURF_LOG_DIR=/path/to/custom/logs
```

---

## Troubleshooting

### "Python not found"
Ensure Python 3 is installed and in your PATH. On some systems, use `python` instead of `python3`.

### "npm not found"
Install Node.js from https://nodejs.org/ which includes npm.

### "Permission denied" on macOS/Linux
Make the scripts executable:
```bash
chmod +x dashboard/start.sh
chmod +x "Windsurf Logger Dashboard.command"
```

### Dashboard won't start
1. Check if ports 5173 or 5174 are already in use
2. Delete the virtual environment and retry:
   ```bash
   rm -rf dashboard/backend/venv
   ./dashboard/start.sh
   ```

### Hooks not working after install
1. Ensure you restarted Windsurf after installation
2. Verify the hooks file exists: `python3 install_hooks.py --show-paths`
3. Check for errors: `cat ~/.codeium/windsurf/logs/errors.log`

### Manual Installation (if automatic fails)

1. See where files should go:
   ```bash
   python3 windsurf_paths.py
   ```

2. Copy the logger script manually:
   ```bash
   cp cascade_logger.py ~/.codeium/windsurf/cascade_logger.py
   ```

3. Generate and copy the hooks config:
   ```bash
   python3 install_hooks.py --print-config > ~/.codeium/windsurf/hooks.json
   ```

4. Restart Windsurf

### Manual Uninstallation

```bash
# Remove installed files
rm ~/.codeium/windsurf/hooks.json
rm ~/.codeium/windsurf/cascade_logger.py
rm ~/.codeium/windsurf/windsurf-logger-install-manifest.json

# Restore backup (if exists)
mv ~/.codeium/windsurf/hooks.json.windsurf-logger.bak ~/.codeium/windsurf/hooks.json 2>/dev/null
```

---

## Platform-Specific Launchers

| Platform | Start Script | Desktop Shortcut |
|----------|--------------|------------------|
| **macOS** | `./dashboard/start.sh` | `Windsurf Logger Dashboard.command` |
| **Linux** | `./dashboard/start.sh` | `windsurf-logger.desktop` |
| **Windows** | `dashboard\start.bat` | `Windsurf Logger Dashboard.bat` |

Generate all platform launchers at once (useful if sharing the repo):
```bash
python3 create_launcher.py --all
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

## Filtering Data with jq

JSONL format allows easy filtering with `jq` (install from https://jqlang.github.io/jq/):

```bash
# Set your log directory (adjust path for your OS)
LOG_DIR=~/.codeium/windsurf/logs

# All prompts
cat "$LOG_DIR/prompt.jsonl" | jq .

# Code changes to Python files
cat "$LOG_DIR/file_write.jsonl" | jq 'select(.data.file_extension == "py")'

# Commands by a specific user
cat "$LOG_DIR/command.jsonl" | jq 'select(.system.username == "yourusername")'

# Events in a specific session
cat "$LOG_DIR/sessions/abc123.jsonl" | jq .

# All npm commands
cat "$LOG_DIR/command.jsonl" | jq 'select(.data.command_name == "npm")'
```

---

## Dashboard Features

- **File Selection** — Select which log files to display
- **Directory Browser** — Change log directory paths  
- **Search** — Full-text search across all logs
- **Filters** — Filter by category, action, user, session
- **Code Diff View** — View code changes with before/after
- **Statistics** — Overview by category, user, and session
- **Timeline View** — Chronological activity stream
- **Cloud Storage** — Connect to S3 or Azure Blob Storage for centralized logs

---

## Cloud Storage (Optional)

The dashboard supports reading logs from AWS S3 or Azure Blob Storage. This is useful for:
- Centralized logging across multiple machines
- Long-term log retention
- Team-wide audit trail

To configure, either:
1. Use the **Storage** settings in the dashboard UI
2. Set environment variables in a `.env` file (copy from `.env.example`)

The S3 and Azure SDKs are optional and are not in `requirements.txt` or `requirements.lock`. Install them into the dashboard's environment when you need cloud storage:
```bash
dashboard/backend/venv/bin/pip install -r dashboard/backend/requirements-cloud.txt
```
The Docker image installs only `requirements.lock`, so cloud storage in Docker needs `requirements-cloud.txt` added to the image.

---

## Running Tests

```bash
# Python (from the repository root)
pip install -r requirements.lock pytest
pytest

# Frontend
cd dashboard/frontend && npm ci && npm test
```
