# Image for the Tutora FastAPI backend, so the static GitHub Pages frontend has an API to
# talk to. Render, Fly.io, Cloud Run and Hugging Face Spaces all build this file as-is.
#
#   docker build -t tutora-api .
#   docker run -p 8000:8000 -v tutora-data:/data tutora-api
#
# Optional environment: GEMINI_API_KEY (figure/audio/video understanding, generated
# questions, written tutor prose), GEMINI_MODEL, TUTORA_DATA_DIR.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TUTORA_DATA_DIR=/data

WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install -r /app/backend/requirements.txt
COPY backend /app/backend

# SQLite database and uploads live here; mount a volume or disk to keep them across deploys.
VOLUME ["/data"]
EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
