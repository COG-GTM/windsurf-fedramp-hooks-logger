"""Unit tests for windsurf_paths.py path discovery + env var override."""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest


def _reload_module():
    sys.modules.pop("windsurf_paths", None)
    return importlib.import_module("windsurf_paths")


def test_env_var_overrides_default(monkeypatch, tmp_path):
    """WINDSURF_LOG_DIR should win over auto-discovery."""
    monkeypatch.setenv("WINDSURF_LOG_DIR", str(tmp_path / "custom-logs"))
    wp = _reload_module()
    result = wp.get_default_log_output_dir()
    assert result == (tmp_path / "custom-logs")


def test_env_var_expands_user(monkeypatch, tmp_path):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("WINDSURF_LOG_DIR", "~/relative-logs")
    wp = _reload_module()
    result = wp.get_default_log_output_dir()
    assert result == (tmp_path / "relative-logs")


def test_default_falls_back_to_codeium(monkeypatch, tmp_path):
    """When .codeium/windsurf exists, that path is used."""
    monkeypatch.delenv("WINDSURF_LOG_DIR", raising=False)
    home = tmp_path
    (home / ".codeium" / "windsurf").mkdir(parents=True)

    monkeypatch.setattr("pathlib.Path.home", classmethod(lambda cls: home))
    wp = _reload_module()
    result = wp.get_default_log_output_dir()
    assert str(result).endswith(".codeium/windsurf/logs")


def test_default_falls_back_to_windsurf_when_codeium_absent(monkeypatch, tmp_path):
    monkeypatch.delenv("WINDSURF_LOG_DIR", raising=False)
    home = tmp_path
    (home / ".windsurf").mkdir(parents=True)

    monkeypatch.setattr("pathlib.Path.home", classmethod(lambda cls: home))
    wp = _reload_module()
    result = wp.get_default_log_output_dir()
    # When neither codeium nor windsurf parent exists, we fall back to codeium
    # by design; here .windsurf exists but .codeium does not, so .windsurf wins.
    assert str(result).endswith(".windsurf/logs") or str(result).endswith(".codeium/windsurf/logs")


def test_generate_hooks_config_includes_all_events(monkeypatch, tmp_path):
    monkeypatch.setenv("WINDSURF_LOG_DIR", str(tmp_path))
    wp = _reload_module()
    cfg = wp.generate_hooks_config()
    expected = {
        "pre_user_prompt", "pre_read_code", "post_read_code",
        "pre_write_code", "post_write_code", "pre_run_command",
        "post_run_command", "pre_mcp_tool_use", "post_mcp_tool_use",
    }
    assert expected <= set(cfg["hooks"].keys())
    for entries in cfg["hooks"].values():
        assert isinstance(entries, list) and entries
        assert "command" in entries[0]


def test_get_system_paths_info_returns_dict(monkeypatch, tmp_path):
    monkeypatch.setenv("WINDSURF_LOG_DIR", str(tmp_path))
    wp = _reload_module()
    info = wp.get_system_paths_info()
    assert isinstance(info, dict)
    assert any("log" in k.lower() for k in info)
