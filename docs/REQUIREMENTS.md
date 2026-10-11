# Requirements coverage register

Honest mapping of every item in the Track D brief to this repository. Status meanings:

* **Done** — implemented and exercised by an automated test or an evaluation run in this repo.
* **Done (unverified here)** — implemented, but the path needs `GEMINI_API_KEY`, which was not
  available in the build environment, so it has not been executed end-to-end.
* **Partial** — implemented for part of the requirement; the shortfall is stated.
* **Missing** — not implemented; listed as roadmap.

This register is machine-checked: `python -m evaluation.audit` exercises the running system and
prints the same statuses with observed evidence (last run: **12 PASS · 6 PARTIAL · 6 FAIL**).
The raw output is committed to `evaluation/results/requirements_audit.json`.

## 1. Multimodal knowledge base

| Item | Status | Where / shortfall |
|---|---|---|
| 1a ingest videos, textbooks, slide decks without manual preprocessing | **Done (unverified here)** | `backend/ingestion.py`: TXT/MD, PDF (per page), PPTX (slides + notes + embedded pictures) verified end-to-end; images, audio and video go through the Gemini Files API and need a key, so they are untested in this environment |
| 1b topics, concepts, prerequisites, every unit linked to its origin | **Done** | page / slide / `timestamp_seconds` stored per unit; prerequisites come from topic metadata; uploads become `auto`-marked topics rather than invented prerequisite edges (`db.match_topic`) |
| 1c major topics, subtopics, key concepts; tag every unit | **Partial** | Uploaded units are tagged to the document's own structure — the largest-font line on a PDF page (carried forward), the slide title, or a markdown/short heading line — and units with no heading fall back to one topic per source. Matching into another course's topics was removed (a Computer Networks PDF no longer lands in "Model Evaluation"), and control/NUL glyphs are stripped from excerpts. Subtopic hierarchy is still one flat level |
| 1d images, diagrams and figures | **Partial** | PPTX embedded images, PDF pages with little text and standalone images go through Gemini vision into `visual_description` (searchable, citable). The key is now configured, but generation is blocked by the provider's model availability on this deployment (see below), so what the reviewer sees is the honest placeholder — and the UI no longer labels it "figure described" |

## 2. Source grounding

| Item | Status | Where |
|---|---|---|
| 2a cited excerpts that open the exact page/slide/timestamp | **Done** | `retrieval.citation`; viewer opens PDF `#page=n`, seeks the media element to `#t=n`, highlights the cited unit for slide/text sources |
| 2b decline or clearly flag queries the material does not cover | **Done** | BM25 threshold refusal, Gemini `grounded` flag, extractive fallback; 8/8 off-material queries declined (`docs/EVALUATION.md`) |

## 3. Adaptive assessment

| Item | Status | Where / shortfall |
|---|---|---|
| 3a quizzes and mock exams on student-chosen scope, MCQ/short answer/numerical, tagged to topic + source + difficulty | **Done** | `backend/quiz.py`, `POST /api/assessments` |
| 3b verify question correctness; avoid repeats across assessments | **Done, with one caveat** | Reviewed bank is human-written; generated items are kept only if a second independent call marks them supported and reproduces the key, and only if the cited excerpt exists. The caveat: that second call uses the **same provider (single key), so it is same-model verification, not cross-model validation** |
| 3c cited feedback plus report with weak topics and likely misconceptions | **Done** | `POST /api/assessments/{id}/submit` |

## 4. Learner model

| Item | Status | Where / shortfall |
|---|---|---|
| 4a per-topic mastery updating after every quiz **and conversation** | **Partial** | Quiz path is complete (BKT, evidence counts, idempotent submission, bounded updates). Chat text itself still never moves mastery — a read answer is not evidence — but every tutor answer with citations now offers **“Quiz me on this (graded)”**: one question on the cited topic, graded through the same BKT update. So a conversation can end in graded evidence without pretending that reading equals knowing |
| 4b new students with no history (diagnostic quiz, intake conversation) | **Partial** | Diagnostic quiz across all topics is implemented and is the cold-start path; the **intake conversation is not implemented** |

## 5. System evaluation

| Item | Status | Where / shortfall |
|---|---|---|
| 5a evaluate retrieval and generation with a standard framework (RAGAS / DeepEval / TruLens) | **Partial** | `evaluation/ragas_adapter.py` is a complete RAGAS integration, but it was **not executed**: no judge-model key existed in the build environment, and the adapter exits rather than printing unmeasured numbers. No DeepEval or TruLens integration exists |
| 5b faithfulness, answer relevancy, context precision and recall on a team-built test set | **Partial** | The four concepts are covered by deterministic local metrics with explicit caveats (`source_hit_at_k`, `grounded_rate_in_material`, `citation_location_accuracy`, `citation_integrity_verbatim`, `answer_token_grounding`, `refusal_accuracy_off_material`) over 17 in-material questions with known slides and 8 off-material probes. These are **lexical checks, not framework-computed semantic metrics** |
| 5c simulated student profiles across sessions; mastery gains and question repetition rate | **Done** | `evaluation/simulation.py`; three profiles × 5 sessions through the real API; gains +0.157 / +0.586 / −0.004, repetition rate 0.000 |

## 6. Optional enhancements

| Item | Status | Where / shortfall |
|---|---|---|
| 6a visual course flow map of topics and prerequisites | **Done** | `/map` page, depth computed from prerequisite metadata |
| 6b revision material targeted at weak topics (flashcards, slides, audio briefs) | **Done** | `/revision`: flashcards built from the weakest topics' units, back side verbatim from the source with its citation, read aloud through the browser's speech synthesis |
| 6c study schedule from weak topics, forgetting curves and exam date | **Partial** | `GET /api/schedule` + `/revision`: expanding review intervals driven by the BKT estimate and the days left before the exam date you enter. The interval rule is a stated heuristic (`1 + round(mastery × 6)` days), not a fitted forgetting curve |
| 6d mixed-language content / Hindi interaction alongside English | **Partial** | The tutor takes an *Answer language* (Hindi, English + Hindi, or auto-detect from Devanagari input) and instructs the model to answer in Hindi while keeping excerpt markers; the offline path says so in Hindi instead of pretending. Uploaded material itself is not translated |
| 6e audio-based tutoring sessions | **Partial** | Read-aloud on revision cards and plan days via `speechSynthesis` (no key required). Full spoken dialogue (speech in, speech out) is not implemented |

## Provider model availability (observed on the deployment)

The key is valid — `GET https://generativelanguage.googleapis.com/v1beta/models` lists models —
but `POST .../models/{id}:generateContent` answers as follows:

| model id | status | message |
|---|---|---|
| `gemini-2.5-flash` | 404 | *This model models/gemini-2.5-flash …* (not available to this project) |
| `gemini-2.0-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-flash` | 404 | not found / not available |
| `gemini-flash-latest` | 503 | *currently experiencing high demand* |

So a pinned id can stop working while the `-latest` aliases keep serving. `resolve_model()`
prefers the `-latest` aliases, accepts any candidate that is not 404 (503/429/500 mean "exists but
busy"), retries once on 503/429 and only then degrades to the offline path. `GET
/api/provider/selftest` prints the raw status per candidate, and `/api/dashboard` reports the model
actually in use. Every Gemini-dependent feature therefore fails *visibly and gracefully* rather
than silently.

## Expected deliverables

| Deliverable | Status |
|---|---|
| Working software prototype (ingestion workflow, grounded tutor chat, adaptive assessment generator, dashboard) | **Done** — runnable with `./scripts/dev.sh` |
| Project documentation (architecture, grounding method, learner-model approach) | **Done** — `docs/ARCHITECTURE.md` |
| Evaluation & benchmarking (framework metrics, simulated student results) | **Partial** — simulated results and local metrics done; framework metrics not executed (`docs/EVALUATION.md`) |
| Demonstration video (3–10 min) | **Not recorded** — script and shot list ready in `docs/DEMO.md` |

## Summary

Core requirements 1b, 2a, 2b, 3a, 3b, 3c and 5c are complete and covered by tests or
evaluation runs; 6b–6e now exist in partial form. The remaining gaps are: conversation-linked
mastery (4a), intake conversation (4b), a subtopic hierarchy deeper than one flat level (1c),
cross-model rather than same-model verification (3b), executing a standard evaluation framework
(5a/5b), and a working vision/generation model on this deployment (1a/1d/3a).

How much to trust the machine-checked audit above: `evaluation/audit.py` exercises the **seeded
sample course only**, so its `1c PASS` described 7 hand-written units, not real uploads — a 76-page
uploaded PDF really produced 64 untagged units and 5 mis-tagged into ML topics before this pass.
Treat the audit as a smoke test of the seeded path, and the manual checks in this register as the
statement of record.