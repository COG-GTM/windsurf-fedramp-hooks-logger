"""
Configuration management for Windsurf Logger.
Loads settings from environment variables and Windsurf user settings.
"""
import os
from pathlib import Path

# Canonical log directory discovery lives in windsurf_paths. Use it directly
# instead of duplicating the logic here.
from windsurf_paths import get_default_log_output_dir

# Base directory (where this file lives)
BASE_DIR = Path(__file__).parent.resolve()

# Log directory — uses Windsurf path discovery (env var WINDSURF_LOG_DIR
# takes precedence, see windsurf_paths.get_default_log_output_dir).
LOG_DIR = get_default_log_output_dir()

# Logger settings
MAX_CONTENT_LENGTH = int(os.getenv("WINDSURF_MAX_CONTENT_LENGTH", "100000"))
LOG_BUFFER_SIZE = int(os.getenv("WINDSURF_LOG_BUFFER_SIZE", "10"))
LOG_FLUSH_INTERVAL = float(os.getenv("WINDSURF_LOG_FLUSH_INTERVAL", "5.0"))

# Backend settings
# FLASK_HOST defaults to loopback for security. Set to 0.0.0.0 only when
# running inside a container or behind a trusted proxy (the shipped
# Dockerfile sets it explicitly).
FLASK_HOST = os.getenv("FLASK_HOST", "127.0.0.1")
FLASK_PORT = int(os.getenv("FLASK_PORT", "5173"))
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"

# Pagination defaults
DEFAULT_PAGE_SIZE = int(os.getenv("WINDSURF_PAGE_SIZE", "100"))
MAX_PAGE_SIZE = int(os.getenv("WINDSURF_MAX_PAGE_SIZE", "1000"))

# Cache settings
CACHE_TTL = int(os.getenv("WINDSURF_CACHE_TTL", "60"))  # seconds
CACHE_MAX_SIZE = int(os.getenv("WINDSURF_CACHE_MAX_SIZE", "100"))  # entries

# Security settings
RATE_LIMIT_REQUESTS = int(os.getenv("WINDSURF_RATE_LIMIT", "100"))
RATE_LIMIT_WINDOW = int(os.getenv("WINDSURF_RATE_LIMIT_WINDOW", "60"))  # seconds
# Default to a single local dev origin. Production deployments must set
# WINDSURF_CORS_ORIGINS explicitly to a comma-separated allow-list.
CORS_ORIGINS = os.getenv("WINDSURF_CORS_ORIGINS", "http://localhost:5173").split(",")

# API auth — when set, all /api/ endpoints require `Authorization: Bearer <key>`.
API_KEY = os.getenv("WINDSURF_API_KEY", "").strip() or None

# Whether to enable admin endpoints that spawn OS processes
# (restart-backend, reveal-env, open-env). Disabled by default.
ENABLE_ADMIN_ENDPOINTS = os.getenv("ENABLE_ADMIN_ENDPOINTS", "false").lower() == "true"

# Allowed directories for browsing (security)
# Default to the repo base dir + the resolved log dir only. Home directory
# is intentionally NOT included by default — extend via WINDSURF_ALLOWED_PATHS.
ALLOWED_BROWSE_PATHS = [
    str(BASE_DIR),
    str(LOG_DIR),
]
if os.getenv("WINDSURF_ALLOWED_PATHS"):
    ALLOWED_BROWSE_PATHS.extend(os.getenv("WINDSURF_ALLOWED_PATHS").split(","))
