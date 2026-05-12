#!/usr/bin/env python3
"""Unit tests for cascade_logger.py"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cascade_logger import (
    compute_content_hash,
    extract_file_info,
    generate_event_id,
    process_edits,
    process_event,
    process_pre_user_prompt,
    process_read_code,
    process_run_command,
    process_write_code,
    truncate_content,
    get_system_info,
    EVENT_CATEGORIES,
    EVENT_PHASES,
)


class TestHelperFunctions(unittest.TestCase):
    """Test helper/utility functions."""

    def test_compute_content_hash(self):
        """Test content hash generation."""
        hash1 = compute_content_hash("test content")
        hash2 = compute_content_hash("test content")
        hash3 = compute_content_hash("different content")
        
        self.assertEqual(hash1, hash2)
        self.assertNotEqual(hash1, hash3)
        self.assertEqual(len(hash1), 12)

    def test_generate_event_id(self):
        """Test event ID generation."""
        event_id = generate_event_id("pre_user_prompt", "2025-01-01T00:00:00", "abc123")
        
        self.assertEqual(len(event_id), 16)
        self.assertTrue(event_id.isalnum())

    def test_truncate_content_short(self):
        """Test truncation with short content."""
        content, truncated = truncate_content("short", max_length=100)
        
        self.assertEqual(content, "short")
        self.assertFalse(truncated)

    def test_truncate_content_long(self):
        """Test truncation with long content."""
        long_content = "x" * 200
        content, truncated = truncate_content(long_content, max_length=100)
        
        self.assertEqual(len(content), 100)
        self.assertTrue(truncated)

    def test_extract_file_info(self):
        """Test file info extraction."""
        info = extract_file_info("/path/to/file.py")
        
        self.assertEqual(info["file_path"], "/path/to/file.py")
        self.assertEqual(info["file_name"], "file.py")
        self.assertEqual(info["file_extension"], "py")
        self.assertEqual(info["directory"], "/path/to")
        self.assertFalse(info["is_hidden"])

    def test_extract_file_info_hidden(self):
        """Test file info extraction for hidden files."""
        info = extract_file_info("/path/to/.hidden")
        
        self.assertTrue(info["is_hidden"])

    def test_extract_file_info_no_extension(self):
        """Test file info extraction for files without extension."""
        info = extract_file_info("/path/to/Makefile")
        
        self.assertIsNone(info["file_extension"])

    def test_get_system_info(self):
        """Test system info collection."""
        info = get_system_info()
        
        self.assertIn("username", info)
        self.assertIn("hostname", info)
        self.assertIn("platform", info)
        self.assertIn("python_version", info)


class TestEventCategories(unittest.TestCase):
    """Test event category and phase mappings."""

    def test_all_events_have_categories(self):
        """Ensure all hook events have category mappings."""
        expected_events = [
            "pre_user_prompt",
            "pre_read_code", "post_read_code",
            "pre_write_code", "post_write_code",
            "pre_run_command", "post_run_command",
            "pre_mcp_tool_use", "post_mcp_tool_use",
        ]
        
        for event in expected_events:
            self.assertIn(event, EVENT_CATEGORIES)
            self.assertIn(event, EVENT_PHASES)

    def test_phase_values(self):
        """Test that phases are either 'pre' or 'post'."""
        for event, phase in EVENT_PHASES.items():
            self.assertIn(phase, ["pre", "post"])


class TestEventProcessing(unittest.TestCase):
    """Test event processing functions."""

    def test_process_pre_user_prompt(self):
        """Test prompt event processing."""
        tool_info = {"user_prompt": "Hello, world!"}
        result = process_pre_user_prompt(tool_info)
        
        self.assertEqual(result["user_prompt"], "Hello, world!")
        self.assertEqual(result["prompt_length"], 13)
        self.assertEqual(result["prompt_word_count"], 2)
        self.assertEqual(result["prompt_line_count"], 1)
        self.assertFalse(result["prompt_truncated"])

    def test_process_read_code(self):
        """Test read code event processing."""
        tool_info = {"file_path": "/src/app.py"}
        result = process_read_code(tool_info, is_post=False)
        
        self.assertEqual(result["file_path"], "/src/app.py")
        self.assertEqual(result["operation"], "read")
        self.assertFalse(result["completed"])

    def test_process_write_code(self):
        """Test write code event processing."""
        tool_info = {
            "file_path": "/src/app.py",
            "edits": [
                {"old_string": "old", "new_string": "new"}
            ]
        }
        result = process_write_code(tool_info, is_post=True)
        
        self.assertEqual(result["file_path"], "/src/app.py")
        self.assertEqual(result["operation"], "write")
        self.assertTrue(result["completed"])
        self.assertEqual(result["edit_count"], 1)

    def test_process_run_command(self):
        """Test command event processing."""
        tool_info = {"command_line": "npm install", "cwd": "/project"}
        result = process_run_command(tool_info, is_post=False)
        
        self.assertEqual(result["command_line"], "npm install")
        self.assertEqual(result["command_name"], "npm")
        self.assertEqual(result["command_args"], ["install"])
        self.assertEqual(result["cwd"], "/project")

    def test_process_edits(self):
        """Test edit processing and statistics."""
        edits = [
            {"old_string": "line1\nline2", "new_string": "new1\nnew2\nnew3"},
            {"old_string": "a", "new_string": "b"}
        ]
        result = process_edits(edits)
        
        self.assertEqual(result["edit_count"], 2)
        self.assertGreater(result["total_lines_added"], 0)

    def test_process_edits_empty(self):
        """Test edit processing with empty list."""
        result = process_edits([])
        
        self.assertEqual(result["edit_count"], 0)
        self.assertEqual(result["edits"], [])


class TestFullEventProcessing(unittest.TestCase):
    """Test full event processing pipeline."""

    def test_process_event_prompt(self):
        """Test full processing of a prompt event."""
        data = {
            "agent_action_name": "pre_user_prompt",
            "trajectory_id": "traj-123",
            "execution_id": "exec-456",
            "timestamp": "2025-01-01T12:00:00",
            "tool_info": {"user_prompt": "Test prompt"}
        }
        
        result = process_event(data)
        
        self.assertEqual(result["action"], "pre_user_prompt")
        self.assertEqual(result["category"], "prompt")
        self.assertEqual(result["phase"], "pre")
        self.assertEqual(result["trajectory_id"], "traj-123")
        self.assertIn("event_id", result)
        self.assertIn("system", result)
        self.assertIn("data", result)

    def test_process_event_unknown_action(self):
        """Test processing of unknown event type."""
        data = {
            "agent_action_name": "unknown_action",
            "timestamp": "2025-01-01T12:00:00",
            "tool_info": {}
        }
        
        result = process_event(data)
        
        self.assertEqual(result["action"], "unknown_action")
        self.assertEqual(result["category"], "unknown")


class TestWriteLogsAndRotation(unittest.TestCase):
    """Tests for write_logs, write_human_readable, rotation, retention, main()."""

    def setUp(self):
        # Re-import cascade_logger with WINDSURF_LOG_DIR pointed at a tmpdir
        # so writes are isolated.
        import importlib
        import os
        import sys
        self._tmp = tempfile.TemporaryDirectory()
        os.environ["WINDSURF_LOG_DIR"] = self._tmp.name
        sys.modules.pop("cascade_logger", None)
        self.cl = importlib.import_module("cascade_logger")

    def tearDown(self):
        import os
        os.environ.pop("WINDSURF_LOG_DIR", None)
        self._tmp.cleanup()

    def _sample_entry(self, action="pre_user_prompt", traj="t1"):
        return {
            "event_id": "x",
            "timestamp": "2025-01-01T00:00:00",
            "trajectory_id": traj,
            "execution_id": "e",
            "action": action,
            "category": self.cl.EVENT_CATEGORIES.get(action, "unknown"),
            "phase": self.cl.EVENT_PHASES.get(action, "unknown"),
            "system": self.cl.get_system_info(),
            "data": {"user_prompt": "hi", "prompt_length": 2},
            "raw_tool_info": {},
        }

    def test_write_logs_creates_expected_files(self):
        self.cl.write_logs(self._sample_entry("pre_user_prompt", "traj-X"))
        log_dir = self.cl.LOG_DIR
        self.assertTrue((log_dir / "all_events.jsonl").exists())
        self.assertTrue((log_dir / "prompt.jsonl").exists())
        self.assertTrue((log_dir / "pre_user_prompt.jsonl").exists())
        self.assertTrue((log_dir / "sessions" / "traj-X.jsonl").exists())
        self.assertTrue((log_dir / "summary.log").exists())

    def test_write_logs_sanitises_trajectory_id(self):
        entry = self._sample_entry("pre_user_prompt", "../evil/../etc/passwd")
        self.cl.write_logs(entry)
        sessions = list((self.cl.LOG_DIR / "sessions").iterdir())
        for s in sessions:
            self.assertNotIn("..", s.name)
            self.assertNotIn("/", s.name)

    def test_write_logs_code_changes_only_for_writes(self):
        entry = {
            "event_id": "y",
            "timestamp": "2025-01-01T00:00:00",
            "trajectory_id": "t",
            "execution_id": "e",
            "action": "post_write_code",
            "category": "file_write",
            "phase": "post",
            "system": self.cl.get_system_info(),
            "data": {"file_path": "/x.py", "edit_count": 3, "total_lines_added": 5, "total_lines_removed": 1},
            "raw_tool_info": {},
        }
        self.cl.write_logs(entry)
        self.assertTrue((self.cl.LOG_DIR / "code_changes.jsonl").exists())

    def test_rotate_if_needed_rotates_oversized(self):
        target = self.cl.LOG_DIR / "big.jsonl"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("x" * 100)
        # Force rotation with max_size_bytes < file size.
        self.cl.rotate_if_needed(target, max_size_bytes=10, max_files=3)
        self.assertFalse(target.exists() and target.stat().st_size > 0)
        self.assertTrue((self.cl.LOG_DIR / "big.jsonl.1").exists())

    def test_rotate_if_needed_no_op_for_small_files(self):
        target = self.cl.LOG_DIR / "small.jsonl"
        target.write_text("ok\n")
        self.cl.rotate_if_needed(target, max_size_bytes=1024, max_files=3)
        self.assertTrue(target.exists())
        self.assertFalse((self.cl.LOG_DIR / "small.jsonl.1").exists())

    def test_cleanup_old_session_logs_removes_old_files(self):
        import os, time
        sessions_dir = self.cl.LOG_DIR / "sessions"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        old = sessions_dir / "old.jsonl"
        new = sessions_dir / "new.jsonl"
        old.write_text("{}\n")
        new.write_text("{}\n")
        # Backdate `old` by 200 days.
        old_ts = time.time() - 200 * 86400
        os.utime(old, (old_ts, old_ts))
        self.cl.cleanup_old_session_logs(retention_days=90)
        self.assertFalse(old.exists(), "old session log should be deleted")
        self.assertTrue(new.exists(), "recent session log should survive")

    def test_cleanup_runs_only_once_per_day(self):
        # First call creates the marker; second call should be a no-op even
        # though we re-create a stale file.
        import os, time
        sessions_dir = self.cl.LOG_DIR / "sessions"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        self.cl.cleanup_old_session_logs(retention_days=90)
        marker = self.cl.LOG_DIR / ".last_cleanup"
        self.assertTrue(marker.exists())

        stale = sessions_dir / "stale.jsonl"
        stale.write_text("{}\n")
        os.utime(stale, (time.time() - 365 * 86400, time.time() - 365 * 86400))
        # Marker is fresh -> cleanup skipped -> stale must survive.
        self.cl.cleanup_old_session_logs(retention_days=90)
        self.assertTrue(stale.exists())

    def test_log_error_writes_to_errors_log(self):
        self.cl.log_error("boom")
        contents = (self.cl.LOG_DIR / "errors.log").read_text()
        self.assertIn("boom", contents)


class TestMainEntrypoint(unittest.TestCase):
    """Cover main() with valid JSON / invalid JSON / empty stdin."""

    def setUp(self):
        import importlib
        import os
        import sys
        self._tmp = tempfile.TemporaryDirectory()
        os.environ["WINDSURF_LOG_DIR"] = self._tmp.name
        sys.modules.pop("cascade_logger", None)
        self.cl = importlib.import_module("cascade_logger")

    def tearDown(self):
        import os
        os.environ.pop("WINDSURF_LOG_DIR", None)
        self._tmp.cleanup()

    def _run_main(self, stdin_text):
        import io
        with patch("sys.stdin", io.StringIO(stdin_text)):
            with self.assertRaises(SystemExit) as ctx:
                self.cl.main()
        return ctx.exception.code

    def test_main_empty_stdin_exits_zero(self):
        self.assertEqual(self._run_main(""), 0)

    def test_main_valid_json_writes_logs(self):
        payload = json.dumps({
            "agent_action_name": "pre_user_prompt",
            "trajectory_id": "tm",
            "execution_id": "em",
            "timestamp": "2025-01-01T00:00:00",
            "tool_info": {"user_prompt": "hi"},
        })
        self.assertEqual(self._run_main(payload), 0)
        self.assertTrue((self.cl.LOG_DIR / "all_events.jsonl").exists())

    def test_main_invalid_json_logs_error(self):
        rc = self._run_main("{not valid json")
        self.assertEqual(rc, 1)
        self.assertTrue((self.cl.LOG_DIR / "errors.log").exists())


if __name__ == "__main__":
    unittest.main()
