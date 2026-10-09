# Tutora architecture

## 1. System shape

```
 upload / paste ─► ingestion ─► units (text + exact location + visual description)
                                   │
                                   ├─► topic tagging (keyword profiles) ─► topics + prerequisites
                                   ▼
                            SQLite (sources, units, topics, assessments, questions, answers, chat)
                                   │
        ┌──────────────────────────┼───────────────────────────────┐
        ▼                          ▼                               ▼
  BM25 retrieval            quiz generator                  learner model (BKT)
  + grounded tutor          + verification                  + mastery / recommendations
        │                          │                               │
        └──────────────► React dashboard / library / tutor / practice / course map ◄────────┘
```

* **Backend**: FastAPI (`backend/main.py`) exposing the contract in `docs/API.md`.
* **Persistence**: a single SQLite file under `TUTORA_DATA_DIR` (default `data/`), plus the
  original uploaded bytes in `data/uploads/` so citations can reopen the real asset.
* **Frontend**: React + TypeScript + Vite SPA, five pages, no UI framework — the design is
  hand-written CSS (`frontend/src/styles.css`).
* **Local ports**: `backend/ports.py` finds a free port for the API and the dev server
  (`TUTORA_API_PORT` / `TUTORA_WEB_PORT`, defaults 8000/5173), so a second project on the
  same machine cannot block a start. `scripts/dev.sh` resolves both ports once and hands the
  API port to Vite, which proxies `/api` to it; `python -m backend.main` moves on when its
  port is taken unless `--strict-port` is given.
* **Model access**: `backend/provider.py` is a small server-side REST client for Gemini
  (`GEMINI_API_KEY`, `GEMINI_MODEL`, default `gemini-2.5-flash`). It is entirely optional;
  every code path has a deterministic offline fallback.

## 2. Multimodal ingestion

`backend/ingestion.py::extract_file(path, original_name) -> list[unit]` converts a file into
units of `{text, location, visual_description?}` and never silently truncates:

| Input | Method | Location produced |
|---|---|---|
| `.txt`, `.md` | paragraph split | `{}` (UI labels it *paragraph n*) |
| `.pdf` | PyMuPDF text per page; pages with little/no text are rendered and read by Gemini when a key is present | `{page: n}` |
| `.pptx` | python-pptx: title + body + tables + speaker notes; embedded pictures read by Gemini | `{slide: n}` |
| `.png/.jpg/.webp` | Gemini vision (OCR + diagram description) | `{}` |
| audio/video | Gemini Files API (upload → poll to `ACTIVE` → transcribe with segment start times → delete) | `{timestamp_seconds: t}` when the timestamp is confident, otherwise an explicit "timestamp could not be verified" warning inside the unit text |

Guards: extension allow-list, magic-byte signature check, 50 MB cap, ≤200 units,
≤20 000 chars/unit, ≤250 000 chars/source, and actionable `ValueError` messages for scans
without a key, corrupt files or unreadable media. Failures are stored on the source row and
shown in the UI instead of a half-ingested source.

## 3. Topics, concepts and prerequisites

* Each unit gets a keyword profile (`db.keywords`).
* `db.match_topic` scores a unit against every topic profile (overlap normalised by profile
  size) and tags it to the best match, so subtopics collapse onto the concept they belong to.
* When nothing matches, an **auto topic** is created from the source title (capped at 8) and
  marked `auto` in the UI, with an explicit statement that no prerequisite information was
  given — the system does not invent prerequisite edges.
* Prerequisites come from the topic metadata (seeded course: supervised → regression →
  gradient descent → neural networks, and regression → overfitting). The course map renders
  them by computed depth.

## 4. Grounding method

1. **Retrieval**: BM25 over unit text + visual descriptions, with light suffix folding and a
   term-coverage multiplier so a short overview page cannot outrank the page that actually
   answers the question. Optional topic scoping.
2. **Threshold**: if the best BM25 score is below `MIN_SCORE` the query is *refused* with a
   fixed message; the model is never consulted for it.
3. **Offline answer (default)**: verbatim sentences from the top units, each line labelled
   with its location, plus structured citations. Because the text is copied, faithfulness is
   structural rather than hoped for.
4. **Gemini answer (optional)**: the prompt contains only the numbered excerpts and forbids
   outside knowledge; the model must return `{grounded, answer, used[]}`. If it reports
   `grounded: false`, returns something too short, or the call fails, the extractive answer is
   returned instead. Answers carry the `used` excerpt markers, which the UI turns into
   clickable citations.
5. **Citation object**: `{unit_id, source_id, source_title, excerpt, location, location_label, url}`.
   The viewer opens the exact PDF page (`#page=n`), seeks the video/audio element to `#t=n`,
   or highlights the focused unit for slide/text sources.

Known limits: lexical retrieval misses paraphrases and synonyms (a real embedding index is the
next step); the refusal threshold is a fixed constant rather than a calibrated classifier;
the Gemini path checks structure and self-reported grounding, not a second-model entailment
judge.

## 5. Assessment generation

* Scope, count, kind and difficulty come from the student. `adaptive` orders candidates by the
  weakest topic mastery first, then by difficulty.
* **Source A — reviewed bank** (`backend/sample.py::BANK`): 18 hand-written items with answer
  keys and explanations derived from the seeded slides. Every item is attached to the exact
  unit that justifies it.
* **Source B — Gemini generation**: items are only accepted if (i) the cited unit exists,
  (ii) for MCQs the key is one of the options, (iii) a second, independent call that sees only
  the cited excerpt marks the question as supported, and (iv) that independent answer agrees
  with the original key. Everything else is discarded and reported in the `notice` field.
* **Novelty**: a normalised prompt hash is stored per question; any question whose hash was
  seen in a previous assessment is skipped. If the scope runs out of unseen verified items the
  API returns a 409 with a human-readable reason instead of repeating questions.
* **Marking**: exact match for MCQ, numeric comparison with tolerance for numerical items,
  term-coverage plus normalised match for short answers (`quiz.is_correct`).
* **Feedback**: per question — your answer, the key, the explanation, the citation — plus a
  report with mastery deltas, weak topics and likely misconceptions assembled from the missed
  items' source explanations.

## 6. Learner model

Per-topic Bayesian knowledge tracing (`backend/learning.py`):

```
correct:   P(L|obs) = P(L)(1-slip) / (P(L)(1-slip) + (1-P(L))guess)
incorrect: P(L|obs) = P(L)slip    / (P(L)slip    + (1-P(L))(1-guess))
then:      P(L') = P(L|obs) + (1 - P(L|obs)) * learn
```

with `guess = 0.2`, `slip = 0.1`, `learn = 0.08`, clamped to `[0.01, 0.99]`, prior `0.3`.
Updates happen only on graded quiz answers; the number of graded answers (`evidence_count`) is
shown next to every mastery value, and topics without evidence are rendered as *no evidence
yet* rather than as a fake score. The update is applied per topic across the questions of one
submission, and submission is idempotent (re-submitting does not double-count evidence).

**Cold start**: a student with no history sees a diagnostic quiz spanning every non-auto topic
(`diagnostic: true`), which produces the first evidence for each topic; the dashboard lists
recommendations ordered by evidence-weighted weakness. An intake conversation is not yet
implemented — the diagnostic quiz is the intake path in this prototype.

## 7. Privacy and safety

* Uploaded files and the SQLite database stay on the machine; only content sent for Gemini
  vision/transcription leaves the host, and the prompt instructs the model to treat file
  content as untrusted data rather than instructions.
* Uploaded file references are deleted from the provider after transcription; provider errors
  are re-raised as sanitised `ValueError`s so keys, URLs and payloads never reach the UI.
* Single-learner prototype: there is no authentication, so it must not be exposed publicly as
  is.

## 8. Roadmap (not implemented)

* Embedding + reranker retrieval and a calibrated refusal classifier.
* RAGAS/DeepEval/TruLens run with a real judge key (`evaluation/ragas_adapter.py` is ready).
* Spaced-repetition scheduler on top of the mastery estimates, revision material generation
  (flashcards/audio briefs), study-plan generation against an exam date.
* Hindi explanations alongside English sources; audio (speech) tutoring sessions.
* Multi-learner accounts, cohort analytics, teacher view.

Two brief items are also deliberately unimplemented and tracked in
`docs/REQUIREMENTS.md`: mastery updates triggered by conversation (4a) and the new-student
intake conversation (4b). An explicit subtopic hierarchy (1c) is likewise outstanding.