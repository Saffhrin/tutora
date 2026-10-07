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
| 1c major topics, subtopics, key concepts; tag every unit | **Partial** | Topics and per-unit keyword profiles exist and every unit is tagged. There is **no explicit subtopic hierarchy** — subtopics collapse onto the parent concept instead of being modelled as a tree |
| 1d images, diagrams and figures | **Done (unverified here)** | PPTX embedded images, PDF pages with little text, and standalone images are read by Gemini vision and stored as `visual_description` (searchable, citable). Needs a key |

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
| 4a per-topic mastery updating after every quiz **and conversation** | **Partial** | Quiz path is complete (BKT, evidence counts, idempotent submission, bounded updates). The **conversation path deliberately does not move mastery**: chat and reading are not treated as knowledge evidence, so mastery only changes on graded answers. A conversation-linked mastery update (for example a micro-check question after a tutor answer) is not implemented |
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
| 6b revision material targeted at weak topics (flashcards, slides, audio briefs) | **Missing** | Roadmap |
| 6c study schedule from weak topics, forgetting curves and exam date | **Missing** | Roadmap |
| 6d mixed-language content / Hindi interaction alongside English | **Missing** | Roadmap |
| 6e audio-based tutoring sessions | **Missing** | Roadmap (browser speech synthesis would need no key) |

## Expected deliverables

| Deliverable | Status |
|---|---|
| Working software prototype (ingestion workflow, grounded tutor chat, adaptive assessment generator, dashboard) | **Done** — runnable with `./scripts/dev.sh` |
| Project documentation (architecture, grounding method, learner-model approach) | **Done** — `docs/ARCHITECTURE.md` |
| Evaluation & benchmarking (framework metrics, simulated student results) | **Partial** — simulated results and local metrics done; framework metrics not executed (`docs/EVALUATION.md`) |
| Demonstration video (3–10 min) | **Not recorded** — script and shot list ready in `docs/DEMO.md` |

## Summary

Core requirements 1b, 2a, 2b, 3a, 3b, 3c and 5c are complete and covered by tests or
evaluation runs. The remaining gaps are: conversation-linked mastery (4a), intake
conversation (4b), subtopic hierarchy (1c), cross-model rather than same-model verification
(3b), executing a standard evaluation framework (5a/5b), and all four optional enhancements
(6b–6e). Nothing in this register is claimed as working without a corresponding test,
evaluation run, or an explicit "unverified here" marker.