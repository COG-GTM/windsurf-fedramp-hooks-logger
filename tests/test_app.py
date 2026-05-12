"""Flask API endpoint tests for dashboard/backend/app.py."""
from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "dashboard" / "backend"


def _import_app_module(monkeypatch, log_dir: Path, api_key: str | None = None):
    """Import dashboard.backend.app with LOG_DIR pointed at ``log_dir``.

    We have to manipulate sys.path + invalidate cached modules because the
    backend is a top-level module that captures LOG_DIR at import time.
    """
    monkeypatch.setenv("WINDSURF_LOG_DIR", str(log_dir))
    if api_key is None:
        monkeypatch.delenv("WINDSURF_API_KEY", raising=False)
    else:
        monkeypatch.setenv("WINDSURF_API_KEY", api_key)
    monkeypatch.setenv("ENABLE_ADMIN_ENDPOINTS", "false")

    # Ensure the repo root + the backend dir are importable.
    monkeypatch.syspath_prepend(str(BACKEND_DIR))
    monkeypatch.syspath_prepend(str(REPO_ROOT))

    for name in ("app", "config", "constants", "windsurf_paths", "storage_adapters"):
        sys.modules.pop(name, None)

    return importlib.import_module("app")


@pytest.fixture()
def client_no_auth(monkeypatch, populate_log_dir):
    app_module = _import_app_module(monkeypatch, populate_log_dir, api_key=None)
    with app_module.app.test_client() as client:
        yield client, app_module


@pytest.fixture()
def client_with_auth(monkeypatch, populate_log_dir):
    app_module = _import_app_module(monkeypatch, populate_log_dir, api_key="test-key-123")
    with app_module.app.test_client() as client:
        yield client, app_module


def test_health_endpoints_are_unauthenticated(client_with_auth):
    client, _ = client_with_auth
    # /health is outside /api
    resp = client.get("/health")
    assert resp.status_code == 200
    # /api/health is explicitly exempt
    resp = client.get("/api/health")
    assert resp.status_code == 200


def test_api_requires_auth_when_key_configured(client_with_auth):
    client, _ = client_with_auth
    resp = client.get("/api/logs/files")
    assert resp.status_code == 401
    resp = client.get("/api/logs/files", headers={"Authorization": "Bearer wrong"})
    assert resp.status_code == 401
    resp = client.get("/api/logs/files", headers={"Authorization": "Bearer test-key-123"})
    assert resp.status_code == 200


def test_api_is_open_when_key_unset(client_no_auth):
    client, _ = client_no_auth
    resp = client.get("/api/logs/files")
    assert resp.status_code == 200


def test_get_log_data_returns_entries(client_no_auth, populate_log_dir):
    client, _ = client_no_auth
    resp = client.get(
        "/api/logs/data",
        query_string={"files": str(populate_log_dir / "all_events.jsonl"), "page_size": 10},
    )
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["total"] == 3
    assert len(payload["entries"]) == 3


def test_get_log_data_filters_by_category(client_no_auth, populate_log_dir):
    client, _ = client_no_auth
    resp = client.get(
        "/api/logs/data",
        query_string={
            "files": str(populate_log_dir / "all_events.jsonl"),
            "category": "prompt",
            "page_size": 10,
        },
    )
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["total"] == 1
    assert payload["entries"][0]["category"] == "prompt"


def test_get_log_data_pagination(client_no_auth, populate_log_dir):
    client, _ = client_no_auth
    resp = client.get(
        "/api/logs/data",
        query_string={
            "files": str(populate_log_dir / "all_events.jsonl"),
            "page": 2,
            "page_size": 2,
        },
    )
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["total"] == 3
    assert len(payload["entries"]) == 1


def test_search_logs_finds_matching(client_no_auth, populate_log_dir):
    client, _ = client_no_auth
    resp = client.get(
        "/api/logs/search",
        query_string={"q": "hello world", "dir": str(populate_log_dir)},
    )
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["total"] == 1
    assert "hello world" in json.dumps(payload["entries"][0])


def test_sessions_groups_entries_by_trajectory(client_no_auth, populate_log_dir):
    client, _ = client_no_auth
    resp = client.get("/api/logs/sessions", query_string={"dir": str(populate_log_dir)})
    assert resp.status_code == 200
    payload = resp.get_json()
    session_ids = {s["id"] for s in payload.get("sessions", [])}
    assert {"traj-alpha", "traj-beta"} <= session_ids


def test_admin_endpoints_blocked_when_disabled(client_no_auth):
    client, _ = client_no_auth
    for path in ("/api/config/reveal-env", "/api/config/open-env", "/api/config/restart-backend"):
        resp = client.post(path)
        assert resp.status_code == 403, f"{path} should be blocked when ENABLE_ADMIN_ENDPOINTS=false"


def test_count_jsonl_entries_cache(monkeypatch, populate_log_dir):
    app_module = _import_app_module(monkeypatch, populate_log_dir, api_key=None)
    filepath = str(populate_log_dir / "all_events.jsonl")
    # Prime the cache.
    assert app_module.count_jsonl_entries(filepath) == 3
    # Hit the cache: mutate the file's stored mtime entry to a sentinel and
    # confirm the cached count is returned without re-counting.
    with app_module._count_cache_lock:
        app_module._count_cache[filepath] = (app_module._count_cache[filepath][0], 999)
    assert app_module.count_jsonl_entries(filepath) == 999
