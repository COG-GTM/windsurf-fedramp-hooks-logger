"""Install / uninstall lifecycle tests for windsurf_paths.install_hooks."""
from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest


@pytest.fixture()
def fake_windsurf(monkeypatch, tmp_path):
    """Redirect every windsurf-data path under tmp_path.

    Patches Path.home() AND the cached `windsurf_paths` module so all
    derived paths land inside our tmp dir. Returns a tuple of:
        (windsurf_paths module, fake home dir).
    """
    home = tmp_path / "home"
    home.mkdir()
    (home / ".codeium" / "windsurf").mkdir(parents=True)
    monkeypatch.setattr("pathlib.Path.home", classmethod(lambda cls: home))
    sys.modules.pop("windsurf_paths", None)
    wp = importlib.import_module("windsurf_paths")
    return wp, home


def test_dry_run_does_not_write_anything(fake_windsurf):
    wp, home = fake_windsurf
    msg = wp.install_hooks(dry_run=True)
    hooks_file = wp.get_windsurf_hooks_file()
    assert not hooks_file.exists(), "dry-run should not create hooks.json"
    assert "Would" in msg


def test_install_creates_hooks_and_logger(fake_windsurf):
    wp, home = fake_windsurf
    wp.install_hooks(dry_run=False)

    hooks_file = wp.get_windsurf_hooks_file()
    assert hooks_file.exists(), "hooks.json should be created"

    payload = json.loads(hooks_file.read_text())
    assert "hooks" in payload
    assert {"pre_user_prompt", "post_write_code"} <= set(payload["hooks"].keys())

    installed_logger = wp.get_installed_logger_path()
    assert installed_logger.exists(), "logger script should be copied to data dir"


def test_install_creates_manifest(fake_windsurf):
    wp, _home = fake_windsurf
    wp.install_hooks(dry_run=False)
    manifest = wp.get_install_manifest_path()
    assert manifest.exists()


def test_install_backs_up_existing_hooks(fake_windsurf):
    wp, _home = fake_windsurf
    hooks_file = wp.get_windsurf_hooks_file()
    hooks_file.parent.mkdir(parents=True, exist_ok=True)
    hooks_file.write_text('{"hooks": {"old": []}}')

    wp.install_hooks(dry_run=False)
    backup = wp.get_hooks_backup_file()
    assert backup.exists(), "existing hooks.json should be backed up"
    assert json.loads(backup.read_text())["hooks"] == {"old": []}


def test_uninstall_restores_backup(fake_windsurf):
    wp, _home = fake_windsurf
    if not hasattr(wp, "uninstall_hooks"):
        pytest.skip("uninstall_hooks not implemented in windsurf_paths")

    hooks_file = wp.get_windsurf_hooks_file()
    hooks_file.parent.mkdir(parents=True, exist_ok=True)
    hooks_file.write_text('{"hooks": {"original": []}}')

    wp.install_hooks(dry_run=False)
    wp.uninstall_hooks(dry_run=False)

    if hooks_file.exists():
        # Either deleted or restored to original.
        assert json.loads(hooks_file.read_text())["hooks"] == {"original": []}


def test_generate_hooks_config_paths_quoted(fake_windsurf):
    wp, _home = fake_windsurf
    cfg = wp.generate_hooks_config()
    entry = cfg["hooks"]["pre_user_prompt"][0]
    assert entry["show_output"] is False
    assert '"' in entry["command"], "path should be quoted to handle spaces"
