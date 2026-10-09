#!/usr/bin/env bash
# Start the Tutora API and the Vite dev server together, on free ports.
#
# Another project already listening on 8000 (API) or 5173 (UI) is not a problem:
# both ports are discovered first and both servers are told about the choice, so
# the UI proxy always points at this API. Change the preference if you want:
#
#   TUTORA_API_PORT=8050 TUTORA_WEB_PORT=5190 ./scripts/dev.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then python3 -m venv .venv; fi
.venv/bin/pip install -q -r backend/requirements.txt
[ -d node_modules ] || npm install

# backend/ports.py prints the chosen port on stdout and explains any move on stderr.
API_PORT="$(.venv/bin/python -m backend.ports --kind api)"
WEB_PORT="$(.venv/bin/python -m backend.ports --kind web)"

echo
echo "Tutora API -> http://127.0.0.1:${API_PORT}"
echo "Tutora UI  -> http://127.0.0.1:${WEB_PORT}   (Vite takes the next free port if that one goes busy)"
echo

.venv/bin/uvicorn backend.main:app --reload --port "${API_PORT}" &
API=$!
trap 'kill $API 2>/dev/null || true' EXIT

TUTORA_API_PORT="${API_PORT}" TUTORA_WEB_PORT="${WEB_PORT}" npm run dev