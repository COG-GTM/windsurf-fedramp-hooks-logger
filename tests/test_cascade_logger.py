#!/usr/bin/env python3
"""Unit tests for cascade_logger.py"""

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

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


if __name__ == "__main__":
    unittest.main()
