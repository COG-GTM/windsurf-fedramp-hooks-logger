"""
Configuration management for Windsurf Logger.
Loads settings from environment variables with sensible defaults.
"""
import os
from pathlib import Path

# Base directory (where this file lives)
BASE_DIR = Path(__file__).parent.resolve()

# Log directory - defaults to Windsurf's standard data location
# Falls back through: env var -> ~/.codeium/windsurf/logs -> ~/.windsurf/logs
def get_default_log_dir():
    """Discover the default log directory from Windsurf's configuration locations."""
    # Check environment variable first
    if os.getenv("WINDSURF_LOG_DIR"):
        return Path(os.getenv("WINDSURF_LOG_DIR"))
    
    # Primary Windsurf data location
    codeium_logs = Path("~/.codeium/windsurf/logs").expanduser()
    if codeium_logs.exists():
        return codeium_logs
    
    # Secondary location
    windsurf_logs = Path("~/.windsurf/logs").expanduser()
    if windsurf_logs.exists():
        return windsurf_logs
    
    # Default to primary location (will be created when needed)
    return codeium_logs

LOG_DIR = get_default_log_dir()

# Logger settings
MAX_CONTENT_LENGTH = int(os.getenv("WINDSURF_MAX_CONTENT_LENGTH", "100000"))
LOG_BUFFER_SIZE = int(os.getenv("WINDSURF_LOG_BUFFER_SIZE", "10"))
LOG_FLUSH_INTERVAL = float(os.getenv("WINDSURF_LOG_FLUSH_INTERVAL", "5.0"))

# Backend settings
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
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
CORS_ORIGINS = os.getenv("WINDSURF_CORS_ORIGINS", "*").split(",")

# Allowed directories for browsing (security)
ALLOWED_BROWSE_PATHS = [
    str(BASE_DIR),
    os.path.expanduser("~"),
]
if os.getenv("WINDSURF_ALLOWED_PATHS"):
    ALLOWED_BROWSE_PATHS.extend(os.getenv("WINDSURF_ALLOWED_PATHS").split(","))
