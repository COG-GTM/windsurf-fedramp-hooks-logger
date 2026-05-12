"""Tests for dashboard/backend/storage_adapters.py."""
from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "dashboard" / "backend"


@pytest.fixture()
def sa(monkeypatch):
    """Fresh import of storage_adapters for each test."""
    monkeypatch.syspath_prepend(str(BACKEND_DIR))
    monkeypatch.syspath_prepend(str(REPO_ROOT))
    for name in ("storage_adapters", "config", "windsurf_paths"):
        sys.modules.pop(name, None)
    return importlib.import_module("storage_adapters")


def test_local_adapter_list_files_returns_jsonl(tmp_path, sa):
    (tmp_path / "a.jsonl").write_text('{"ok": 1}\n')
    (tmp_path / "b.log").write_text("plain text\n")
    (tmp_path / "ignore.txt").write_text("nope")
    adapter = sa.LocalStorageAdapter(str(tmp_path))
    names = sorted(f["name"] for f in adapter.list_files())
    assert names == ["a.jsonl", "b.log"]


def test_local_adapter_filters_by_extension(tmp_path, sa):
    (tmp_path / "a.jsonl").write_text("{}\n")
    (tmp_path / "b.log").write_text("text")
    adapter = sa.LocalStorageAdapter(str(tmp_path))
    only_jsonl = adapter.list_files(extension_filter=[".jsonl"])
    assert [f["name"] for f in only_jsonl] == ["a.jsonl"]


def test_local_adapter_read_file(tmp_path, sa):
    target = tmp_path / "x.jsonl"
    target.write_text('{"k":1}\n')
    adapter = sa.LocalStorageAdapter(str(tmp_path))
    assert adapter.read_file(str(target)) == '{"k":1}\n'


def test_local_adapter_file_exists(tmp_path, sa):
    adapter = sa.LocalStorageAdapter(str(tmp_path))
    assert not adapter.file_exists(str(tmp_path / "nope"))
    (tmp_path / "yep").write_text("")
    assert adapter.file_exists(str(tmp_path / "yep"))


def test_local_adapter_test_connection(tmp_path, sa):
    adapter = sa.LocalStorageAdapter(str(tmp_path))
    assert adapter.test_connection()["success"] is True
    missing = sa.LocalStorageAdapter(str(tmp_path / "missing"))
    assert missing.test_connection()["success"] is False


def test_get_default_log_dir_proxies_to_config(monkeypatch, tmp_path, sa):
    monkeypatch.setenv("WINDSURF_LOG_DIR", str(tmp_path))
    # Force config to re-evaluate by re-importing.
    sys.modules.pop("config", None)
    sys.modules.pop("windsurf_paths", None)
    sa = importlib.reload(sa)
    assert sa._get_default_log_dir() == str(tmp_path)


def test_get_storage_adapter_defaults_to_local(monkeypatch, tmp_path, sa):
    monkeypatch.setenv("WINDSURF_LOG_DIR", str(tmp_path))
    sys.modules.pop("config", None)
    sa = importlib.reload(sa)
    sa.reset_storage()
    adapter = sa.get_storage_adapter()
    assert isinstance(adapter, sa.LocalStorageAdapter)


def test_s3_adapter_raises_without_boto3(sa):
    if sa.HAS_BOTO3:
        pytest.skip("boto3 installed; gracefully-missing test does not apply")
    with pytest.raises(ImportError, match="boto3"):
        sa.S3StorageAdapter(bucket="x")


def test_azure_adapter_raises_without_sdk(sa):
    if sa.HAS_AZURE:
        pytest.skip("azure-storage-blob installed; gracefully-missing test does not apply")
    with pytest.raises(ImportError, match="azure"):
        sa.AzureStorageAdapter(account_name="x", container="y")


def test_get_storage_adapter_unknown_type_raises(sa):
    with pytest.raises(ValueError, match="Unknown storage type"):
        sa.get_storage_adapter({"type": "ftp"})
