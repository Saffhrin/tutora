"""`.env` handling: the project file must reach the backend, never override the shell."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def import_data_dir(env: dict[str, str]) -> str:
    """Import backend.db in a fresh interpreter and print the data dir it chose."""
    result = subprocess.run(
        [sys.executable, "-c", "from backend import db; print(db.DATA_DIR)"],
        cwd=ROOT, env=env, capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def clean_env() -> dict[str, str]:
    """The real environment, minus anything this test wants to control itself."""
    env = {key: value for key, value in os.environ.items()
           if key not in ("TUTORA_DATA_DIR", "GEMINI_API_KEY", "TUTORA_SKIP_ENV_FILE")}
    env["TUTORA_SKIP_ENV_FILE"] = ""
    return env


def write_env_file(directory: Path, value: Path) -> Path:
    env_file = directory / ".env"
    env_file.write_text("# project environment\n" + f"TUTORA_DATA_DIR={value}\n")
    return env_file


def test_data_dir_comes_from_the_project_env_file(tmp_path):
    env_file = write_env_file(tmp_path, tmp_path / "from-file")
    assert import_data_dir({**clean_env(), "TUTORA_ENV_FILE": str(env_file)}) \
        == str(tmp_path / "from-file")


def test_real_environment_beats_the_env_file(tmp_path):
    env_file = write_env_file(tmp_path, tmp_path / "from-file")
    env = {**clean_env(), "TUTORA_ENV_FILE": str(env_file),
           "TUTORA_DATA_DIR": str(tmp_path / "from-shell")}
    assert import_data_dir(env) == str(tmp_path / "from-shell")


def test_empty_environment_value_is_filled_from_the_env_file(tmp_path):
    """`GEMINI_API_KEY=` style placeholders must not shadow the file's real value."""
    env_file = write_env_file(tmp_path, tmp_path / "from-file")
    env = {**clean_env(), "TUTORA_ENV_FILE": str(env_file), "TUTORA_DATA_DIR": ""}
    assert import_data_dir(env) == str(tmp_path / "from-file")


def test_skip_flag_ignores_the_env_file(tmp_path):
    env_file = write_env_file(tmp_path, tmp_path / "from-file")
    env = {**clean_env(), "TUTORA_ENV_FILE": str(env_file), "TUTORA_SKIP_ENV_FILE": "1"}
    assert import_data_dir(env) == "data"


@pytest.mark.parametrize("value", ["0", "false", "off", "no"])
def test_falsey_skip_flag_still_reads_the_env_file(tmp_path, value):
    """Only a truthy flag skips the file; "0" must not behave like "1"."""
    env_file = write_env_file(tmp_path, tmp_path / "from-file")
    env = {**clean_env(), "TUTORA_ENV_FILE": str(env_file), "TUTORA_SKIP_ENV_FILE": value}
    assert import_data_dir(env) == str(tmp_path / "from-file")
