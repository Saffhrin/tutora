# Tutora — source-grounded adaptive study companion

Multimodal AI Hackathon 2026 · Track D (Personalized Tutoring & Adaptive Learning)

Tutora turns lecture videos, textbooks, slide decks, figures and pasted notes into one
cited knowledge base, then uses that base to run a grounded tutor, adaptive assessments
and a per-topic learner model. **Nothing is answered without a source, and questions the
material does not cover are refused instead of guessed.**

## What works right now

| Capability | Status | Where |
|---|---|---|
| Multimodal ingestion (TXT/MD, PDF, PPTX + speaker notes, images, audio, video) without manual preprocessing | Offline for text/PDF/PPTX; images and media need `GEMINI_API_KEY` | `backend/ingestion.py` |
| Exact origin preserved per unit (page, slide, video timestamp) | Works | `backend/ingestion.py`, `backend/db.py` |
| Topic / subtopic tagging + prerequisite metadata | Works (keyword-profile tagging, auto-grouped topics for uploads) | `backend/db.py::match_topic` |
| Figure & diagram understanding | Works with a key (`visual_description` stored per unit and searchable) | `backend/ingestion.py` |
| Source-grounded tutor chat with clickable citations | Works offline (extractive, verbatim) and with Gemini (prose over retrieved excerpts) | `backend/retrieval.py` |
| Refusal / flagging of off-material queries | Works (BM25 threshold + Gemini `grounded` flag + extractive fallback) | `backend/retrieval.py` |
| Adaptive quizzes & mock exams (MCQ, short answer, numerical) tagged to topic, source location, difficulty | Works | `backend/quiz.py` |
| Question verification and cross-assessment novelty | Works (reviewed bank + independent re-solve and verbatim-excerpt check for generated items) | `backend/quiz.py` |
| Cited feedback, weak topics, likely misconceptions | Works | `backend/main.py::submit_assessment` |
| Learner model (Bayesian knowledge tracing per topic) | Works | `backend/learning.py` |
| Cold start (diagnostic quiz across all topics) | Works | Dashboard button → `POST /api/assessments {diagnostic:true}` |
| Dashboard, library viewer, tutor, practice, course map UI | Works | `frontend/` |
| Runs beside another local project (free-port discovery for API and UI) | Works (`./scripts/dev.sh`, `python -m backend.main`) | `backend/ports.py`, `frontend/vite.config.ts` |
| Evaluation harness (local metrics + optional RAGAS adapter) | Works; measured numbers in `docs/EVALUATION.md` | `evaluation/` |

Deliberately **not** claimed: RAGAS/DeepEval/TruLens scores (no judge key was available in
this environment — the adapter exists and refuses to print numbers without a real judge),
audio tutoring sessions, and multi-language explanation (roadmap items, see
`docs/ARCHITECTURE.md`).

## Quick start

```bash
# One command: resolves two free ports, starts the API and the UI, prints both URLs.
./scripts/dev.sh
#   Tutora API -> http://127.0.0.1:8001
#   Tutora UI  -> http://127.0.0.1:5174
#   (8000/8001, 5173/5174 … when those are already taken by another project)
```

Or run the two halves yourself:

```bash
# 1. backend (Python 3.11+)
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
python -m backend.main      # API on 8000, or the next free port
# On first start Tutora seeds an original sample course (Introduction to ML, 7 slides).

# 2. frontend
npm install
npm run dev        # http://localhost:5173, proxying /api to the API port
```

### Another project already uses 8000 or 5173

Nothing has to be stopped by hand: both servers look for a free port before binding.

* `python -m backend.main` (and `./scripts/dev.sh`) skip a busy API port and log
  `8000 is already in use (another project?), using 8001 instead`. The UI proxy is
  told the same port, so citations and quizzes keep working.
* If 5173 is taken, Vite says `Port 5173 is in use, trying another one...` and serves
  the app on the next free port — **open the URL Vite prints**, not the one you expected.
* Pin your own ports with `TUTORA_API_PORT=8050 TUTORA_WEB_PORT=5190 ./scripts/dev.sh`
  (or in `.env`), point the UI at a different API with `TUTORA_API_URL`, and refuse
  moving with `python -m backend.main --strict-port` / `TUTORA_STRICT_PORT=1`.
* `./scripts/dev.sh --dry-run` prints the ports it would use and starts nothing;
  `python -m backend.ports --check 8000` reports `free` / `in use`.
* A red banner *“The Tutora API is not reachable on port N”* means the API is not
  listening on the port the UI proxies to: start it with `python -m backend.main`.

Optional: copy `.env.example` to `.env` and set `GEMINI_API_KEY` to enable image/figure
understanding, audio & video transcription, AI question generation and written tutor prose.
Without a key everything still runs, in offline extractive mode.

## Demo material

```bash
python -m scripts.make_demo_assets   # writes demo_assets/: PPTX deck, PDF chapter, figure, transcript
```

Upload those files through the Library page to show the ingestion workflow end to end.

## Tests, evaluation and simulation

```bash
python -m pytest -q                              # offline tests, no network
python -m evaluation.audit                       # requirement-by-requirement audit (12 PASS / 6 PARTIAL / 6 FAIL)
python -m evaluation.run                         # grounding/retrieval metrics
python -m evaluation.simulation --sessions 5     # simulated students across sessions
```

## Documentation

* `docs/ARCHITECTURE.md` — system design, ingestion, grounding method, learner model, roadmap
* `docs/EVALUATION.md` — what was measured, with real numbers, and what was not
* `docs/REQUIREMENTS.md` — item-by-item coverage register for the Track D brief, including gaps
* `docs/DEMO.md` — 3–10 minute demo video script
* `docs/API.md` — REST contract used by the frontend

## Repository layout

```
backend/    FastAPI app, ingestion, retrieval, quiz generation, learner model, SQLite
frontend/   React + TypeScript + Vite single-page app
evaluation/ Test-set fixtures, local metric harness, RAGAS adapter, simulation study
scripts/    Demo asset generation
docs/       Architecture, evaluation report, demo script, API contract
```

## Honesty notes

* Every citation excerpt is returned verbatim from the stored unit; `citation_integrity_verbatim`
  in the harness verifies this on every run.
* The tutor never treats reading or chat activity as evidence of knowledge; mastery only moves
  on graded quiz answers.
* The reviewed offline question bank holds 18 items, so long offline runs end with a clear
  "no unseen verified questions remain" response instead of repeating questions.