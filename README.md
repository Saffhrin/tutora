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
| Evaluation harness (local metrics + optional RAGAS adapter) | Works; measured numbers in `docs/EVALUATION.md` | `evaluation/` |

Deliberately **not** claimed: RAGAS/DeepEval/TruLens scores (no judge key was available in
this environment — the adapter exists and refuses to print numbers without a real judge),
audio tutoring sessions, and multi-language explanation (roadmap items, see
`docs/ARCHITECTURE.md`).

## Quick start

```bash
# 1. backend (Python 3.11+)
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
# On first start Tutora seeds an original sample course (Introduction to ML, 7 slides).

# 2. frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api to :8000)
```

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
python -m pytest -q                              # 20 offline tests, no network
python -m evaluation.audit                       # requirement-by-requirement audit (12 PASS / 6 PARTIAL / 6 FAIL)
python -m evaluation.run                         # grounding/retrieval metrics
python -m evaluation.simulation --sessions 5     # simulated students across sessions
```

## Deployment (GitHub Pages)

The static frontend is published to <https://saffhrin.github.io/tutora/> by
`.github/workflows/deploy.yml`: on every push to `main` it installs the root npm
dependencies, builds the Vite project in `frontend/` with `VITE_BASE_PATH=/tutora/`,
copies `index.html` to `404.html` so deep links survive a reload, and uploads
`frontend/dist` with `actions/upload-pages-artifact` + `actions/deploy-pages`.

Two repository settings are required before that workflow can publish anything:

1. **Settings → Pages → Build and deployment → Source = “GitHub Actions”.** While it
   stays on “Deploy from a branch”, Pages keeps rendering this README from the branch
   root and `actions/deploy-pages` fails.
2. **Settings → Environments → `github-pages`** has to allow the deploying branch
   (`main`), otherwise the deploy job is rejected by the environment protection rules.

Pages only serves static files, so the published site has no backend: the data views
show the “Tutora API is not reachable” banner until the API is hosted somewhere and
`frontend/src/api.ts` is pointed at it (contract in `docs/API.md`).

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