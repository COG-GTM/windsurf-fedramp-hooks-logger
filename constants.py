"""
Shared constants for the Windsurf Logger.

Single source of truth for event metadata — imported by both the
synchronous hook subprocess (`cascade_logger.py`) and the dashboard
backend (`dashboard/backend/app.py`).
"""

# Hook action name -> high-level category used for filtering/aggregation.
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

# Hook action name -> phase ("pre" or "post").
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
