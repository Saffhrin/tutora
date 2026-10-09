"""One `.env` loader for every Tutora process.

`README.md` tells people to copy `.env.example` to `.env`, but nothing ever read that
file: `GEMINI_API_KEY` and `TUTORA_DATA_DIR` only worked as real environment variables.
This module parses the file with the standard library (so `backend/ports.py` still works
before any dependency is installed) and never overrides a real environment variable.

Set `TUTORA_ENV_FILE` to point somewhere else, or `TUTORA_SKIP_ENV_FILE=1` to ignore the
file entirely (the test suite does this so a developer's key can never be picked up).
"""

from __future__ import annotations

import os
from pathlib import Path

SKIP_ENV = "TUTORA_SKIP_ENV_FILE"
ENV_FILE_ENV = "TUTORA_ENV_FILE"

_ENV_LOADED = False


def env_file_path() -> Path:
    """`TUTORA_ENV_FILE`, else the `.env` in the project root (next to package.json)."""
    override = os.environ.get(ENV_FILE_ENV)
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[1] / ".env"


def load_env_file(path: Path | None = None) -> dict[str, str]:
    """Read `KEY=VALUE` lines from `.env` once; real environment values always win."""
    global _ENV_LOADED
    if path is None and (os.environ.get(SKIP_ENV) or _ENV_LOADED):
        return {}
    if path is None:
        _ENV_LOADED = True
        path = env_file_path()
    if not path.is_file():
        return {}
    loaded: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        entry = line.strip()
        if not entry or entry.startswith("#") or "=" not in entry:
            continue
        key, _, raw = entry.partition("=")
        key, value = key.strip(), raw.strip().strip("'\"")
        if not key:
            continue
        loaded[key] = value
        # An empty value (GEMINI_API_KEY= in a template) counts as unset, so the file can
        # fill it in; a real value in the environment is never replaced.
        if not os.environ.get(key):
            os.environ[key] = value
    return loaded
