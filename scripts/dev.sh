#!/usr/bin/env bash
# Start the Tutora API and the Vite dev server together.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d .venv ]; then python3 -m venv .venv; fi
.venv/bin/pip install -q -r backend/requirements.txt
[ -d node_modules ] || npm install
.venv/bin/uvicorn backend.main:app --reload --port 8000 &
API=$!
trap 'kill $API 2>/dev/null || true' EXIT
npm run dev