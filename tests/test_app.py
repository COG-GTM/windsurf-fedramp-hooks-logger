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
    # Pin CORS_ORIGINS to the SPA dev origin so same-origin tests are
    # deterministic and don't rely on whatever the user has in their env.
    monkeypatch.setenv("WINDSURF_CORS_ORIGINS", "http://localhost:5173")
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


def test_api_allows_trusted_origin_when_key_configured(client_with_auth):
    """Browser fetch() from the bundled SPA carries Origin == one of the
    server-configured CORS_ORIGINS entries; those calls bypass the Bearer
    requirement because the SPA never learns the key."""
    client, _ = client_with_auth
    resp = client.get(
        "/api/logs/files",
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200


def test_api_rejects_untrusted_origin(client_with_auth):
    """Origin not in CORS_ORIGINS must still require a Bearer token."""
    client, _ = client_with_auth
    resp = client.get(
        "/api/logs/files",
        headers={"Origin": "http://evil.example"},
    )
    assert resp.status_code == 401


def test_api_rejects_host_header_forgery_attack(client_with_auth):
    """Regression: an attacker setting Host + Origin to matching but
    untrusted values must NOT bypass auth. The trust check uses the
    server-controlled CORS_ORIGINS allow-list, not the client-controlled
    Host header / request.host_url.
    """
    client, _ = client_with_auth
    resp = client.get(
        "/api/logs/files",
        headers={
            "Host": "evil.example:5173",
            "Origin": "http://evil.example:5173",
        },
    )
    assert resp.status_code == 401


def test_api_rejects_missing_origin_without_bearer(client_with_auth):
    """Non-browser callers (curl/Postman/automation) have no Origin header
    and must present a Bearer token. They cannot piggyback on the SPA
    bypass.
    """
    client, _ = client_with_auth
    resp = client.get("/api/logs/files")  # no Origin, no Bearer
    assert resp.status_code == 401


def test_api_allows_full_sec_fetch_triplet_without_origin_header(client_with_auth):
    """Modern browsers omit the Origin header on same-origin GET/HEAD fetch
    requests but always send the Sec-Fetch-* triplet. The bundled SPA
    must continue to work under WINDSURF_API_KEY; we accept the request
    iff ALL three browser-set signals match what a real ``fetch()`` to
    /api/* produces (site=same-origin, mode=cors, dest in {empty,
    document}).
    """
    client, _ = client_with_auth
    resp = client.get(
        "/api/logs/files",
        headers={
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
        },
    )
    assert resp.status_code == 200


def test_api_rejects_single_sec_fetch_site_header_drive_by(client_with_auth):
    """Defense in depth: a curl attacker setting only Sec-Fetch-Site:
    same-origin (without the matching Mode/Dest a real browser fetch
    produces) must NOT bypass the gate. This was the concern raised by
    Devin Review on the prior commit — the single-header check was too
    permissive against drive-by CLI bypasses.
    """
    client, _ = client_with_auth
    resp = client.get(
        "/api/logs/files",
        headers={"Sec-Fetch-Site": "same-origin"},  # missing Mode + Dest
    )
    assert resp.status_code == 401


def test_api_rejects_sec_fetch_site_cross_site(client_with_auth):
    """A cross-origin attacker page triggers Sec-Fetch-Site: cross-site (the
    browser sets this based on its own origin computation, JS cannot
    override it). Such requests must still require a Bearer token.
    """
    client, _ = client_with_auth
    resp = client.get(
        "/api/logs/files",
        headers={
            "Sec-Fetch-Site": "cross-site",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
        },
    )
    assert resp.status_code == 401


def test_api_rejects_sec_fetch_site_same_site(client_with_auth):
    """``same-site`` means same eTLD+1 but different scheme/port/subdomain.
    A page on http://localhost:3000 attacking http://localhost:5173 would
    register as same-site (not same-origin) — must still require Bearer.
    """
    client, _ = client_with_auth
    resp = client.get(
        "/api/logs/files",
        headers={
            "Sec-Fetch-Site": "same-site",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
        },
    )
    assert resp.status_code == 401


def test_api_rejects_sec_fetch_dest_other(client_with_auth):
    """A real SPA fetch() to /api/* has Sec-Fetch-Dest: empty (or 'document'
    for navigations). Anything else (image/script/font/iframe/style/...)
    is not what the SPA produces and indicates a different (possibly
    attacker-driven) request shape — must require Bearer.
    """
    client, _ = client_with_auth
    resp = client.get(
        "/api/logs/files",
        headers={
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "image",
        },
    )
    assert resp.status_code == 401


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


def test_get_log_data_clamps_invalid_page_size(client_no_auth, populate_log_dir):
    """Regression: page_size=0 (or negative) must not crash with
    ZeroDivisionError nor create an unbounded deque in the streaming
    fast path. We clamp page_size into [1, MAX_PAGE_SIZE].
    """
    client, _ = client_no_auth
    target = populate_log_dir / "all_events.jsonl"
    for bad in ("0", "-1", "-1000"):
        resp = client.get(
            "/api/logs/data",
            query_string={"files": str(target), "page": 1, "page_size": bad},
        )
        assert resp.status_code == 200, bad
        payload = resp.get_json()
        # 3 events in the fixture, clamped to page_size=1 -> 1 entry, 3 pages.
        assert payload["total"] == 3
        assert payload["page_size"] == 1
        assert payload["total_pages"] == 3
        assert len(payload["entries"]) == 1


def test_get_log_data_returns_newest_first(client_no_auth, tmp_log_dir):
    """Streaming pagination must return newest entries on page 1.

    The fixture writes 10 chronological entries; page 1 with page_size=3 must
    return entries with timestamps 10, 9, 8 (newest-first), not 1, 2, 3.
    """
    import json
    target = tmp_log_dir / "all_events.jsonl"
    with target.open("w", encoding="utf-8") as f:
        for i in range(1, 11):
            f.write(json.dumps({
                "event_id": f"evt-{i:02d}",
                "timestamp": f"2025-01-{i:02d}T00:00:00",
                "trajectory_id": "t",
                "action": "pre_user_prompt",
                "category": "prompt",
                "phase": "pre",
                "data": {"user_prompt": f"event {i}"},
            }) + "\n")
    client, _ = client_no_auth
    resp = client.get(
        "/api/logs/data",
        query_string={"files": str(target), "page": 1, "page_size": 3},
    )
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["total"] == 10
    ts = [e["timestamp"] for e in payload["entries"]]
    assert ts == ["2025-01-10T00:00:00", "2025-01-09T00:00:00", "2025-01-08T00:00:00"], ts

    # Page 2 should be the next three newest.
    resp = client.get(
        "/api/logs/data",
        query_string={"files": str(target), "page": 2, "page_size": 3},
    )
    payload = resp.get_json()
    ts = [e["timestamp"] for e in payload["entries"]]
    assert ts == ["2025-01-07T00:00:00", "2025-01-06T00:00:00", "2025-01-05T00:00:00"], ts

    # Last page (page 4) should hold the single oldest entry.
    resp = client.get(
        "/api/logs/data",
        query_string={"files": str(target), "page": 4, "page_size": 3},
    )
    payload = resp.get_json()
    ts = [e["timestamp"] for e in payload["entries"]]
    assert ts == ["2025-01-01T00:00:00"], ts


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
