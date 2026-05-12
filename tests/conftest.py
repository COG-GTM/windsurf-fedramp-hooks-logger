"""Shared pytest fixtures for the windsurf-fedramp-hooks-logger test suite."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Iterator, List

import pytest


@pytest.fixture()
def tmp_log_dir(tmp_path: Path) -> Path:
    """A clean temporary directory for log output."""
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    return log_dir


@pytest.fixture()
def sample_jsonl_entries() -> List[dict]:
    """A small representative set of JSONL log entries."""
    return [
        {
            "event_id": "evt-001",
            "timestamp": "2025-01-01T10:00:00",
            "trajectory_id": "traj-alpha",
            "action": "pre_user_prompt",
            "category": "prompt",
            "phase": "pre",
            "system": {"username": "alice", "hostname": "box-1"},
            "user": "alice",
            "data": {"user_prompt": "hello world", "prompt_length": 11},
        },
        {
            "event_id": "evt-002",
            "timestamp": "2025-01-01T10:00:05",
            "trajectory_id": "traj-alpha",
            "action": "pre_read_code",
            "category": "file_read",
            "phase": "pre",
            "system": {"username": "alice", "hostname": "box-1"},
            "user": "alice",
            "data": {"file_path": "/src/app.py", "file_extension": "py"},
        },
        {
            "event_id": "evt-003",
            "timestamp": "2025-01-02T11:30:00",
            "trajectory_id": "traj-beta",
            "action": "pre_run_command",
            "category": "command",
            "phase": "pre",
            "system": {"username": "bob", "hostname": "box-2"},
            "user": "bob",
            "data": {"command_line": "ls -la", "command_name": "ls"},
        },
    ]


@pytest.fixture()
def populate_log_dir(tmp_log_dir: Path, sample_jsonl_entries: List[dict]) -> Path:
    """Materialise all_events.jsonl and category JSONL files in tmp_log_dir."""
    all_events = tmp_log_dir / "all_events.jsonl"
    with all_events.open("w", encoding="utf-8") as f:
        for entry in sample_jsonl_entries:
            f.write(json.dumps(entry) + "\n")

    for category in {"prompt", "file_read", "command"}:
        rows = [e for e in sample_jsonl_entries if e["category"] == category]
        if rows:
            with (tmp_log_dir / f"{category}.jsonl").open("w", encoding="utf-8") as f:
                for entry in rows:
                    f.write(json.dumps(entry) + "\n")

    return tmp_log_dir


@pytest.fixture()
def env_var(monkeypatch: pytest.MonkeyPatch):
    """Helper fixture: yields a callable that sets/clears env vars for a test."""

    def _set(name: str, value: str | None) -> None:
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)

    return _set
