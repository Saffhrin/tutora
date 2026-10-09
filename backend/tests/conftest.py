import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

TMP = tempfile.mkdtemp(prefix="tutora-test-")
os.environ["TUTORA_DATA_DIR"] = TMP
os.environ.pop("GEMINI_API_KEY", None)  # tests must never call an external model
os.environ["TUTORA_SKIP_ENV_FILE"] = "1"  # nor pick a key up from a developer .env

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend import db  # noqa: E402
from backend.main import app, seed_sample_course  # noqa: E402


@pytest.fixture()
def client():
    db.reset()
    seed_sample_course()
    with TestClient(app) as test_client:
        yield test_client