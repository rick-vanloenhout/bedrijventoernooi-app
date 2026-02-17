import os
from typing import List


def _get_bool(env_var: str, default: bool = False) -> bool:
    value = os.getenv(env_var)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


# Application environment
DEBUG: bool = _get_bool("DEBUG", False)  # Set to False for production

# Database configuration
# Default: local SQLite file in project root, same as before
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./tournament.db")

# CORS configuration
# Default: allow only local FastAPI origin; can be overridden with CORS_ORIGINS env
_default_cors = "http://127.0.0.1:8000"
_cors_env = os.getenv("CORS_ORIGINS", _default_cors)
CORS_ORIGINS: List[str] = [
    origin.strip()
    for origin in _cors_env.split(",")
    if origin.strip()
]

# Admin user configuration
# Default admin creation is DISABLED by default for security
# Only enable if explicitly set via CREATE_DEFAULT_ADMIN=true AND DEFAULT_ADMIN_PASSWORD env vars
CREATE_DEFAULT_ADMIN: bool = _get_bool("CREATE_DEFAULT_ADMIN", False)
DEFAULT_ADMIN_USERNAME: str = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "")
# If no password is set via env var, don't create default admin (security)

