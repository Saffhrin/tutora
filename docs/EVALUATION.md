# Evaluation report

All numbers below were produced in this repository by the commands shown, on the seeded
sample course (1 source, 7 units, 7 topics). Nothing here is estimated, extrapolated or
copied from another project. Re-run with:

```bash
python -m pytest -q                            # 20 offline tests
python -m evaluation.run                       # grounding + retrieval metrics
python -m evaluation.simulation --sessions 5   # personalization study
```

## 1. Test set (team-built)

`evaluation/fixtures.py` defines the ground truth and derives source locations from
`backend.sample`, so the expectations cannot drift from the seeded corpus:

* **17 in-material questions**, each mapped to the topic slug and the exact slide that must
  answer it (slides 2–7 of the sample course).
* **8 off-material queries** the material does not cover (football World Cup, French political
  history, capital of Australia, sourdough recipe, Indian income tax filing, film plot,
  scurvy vitamin, guitar tuning).
* **Answer keys** for all 18 reviewed bank items, used by the personalization study.

## 2. Retrieval and grounding metrics (offline, no model key)

| Metric | Value | What it means |
|---|---|---|
| `source_hit_at_k` (k=4) | **1.00** (17/17) | The slide that answers the question is in the top-4 retrieved units for every in-material question. |
| `grounded_rate_in_material` | **1.00** (17/17) | Every in-material question produced a grounded answer with at least one citation. |
| `citation_location_accuracy` | **1.00** (17/17) | The first citation points at the expected slide. |
| `refusal_accuracy_off_material` | **1.00** (8/8) | Every off-material query was declined instead of answered from general knowledge. |
| `citation_integrity_verbatim` | **1.00** | Every sentence of every citation excerpt appears verbatim in the cited unit (checked on all cited units of all 17 answers). |
| `answer_token_grounding` | **1.00** | Content tokens (length > 3) of the answer body that also occur in the cited excerpts. The extractive tutor copies text, so this is 1.00 by construction; the metric exists to catch drift when Gemini prose is enabled. |
| `question_novelty_rate` | **1.00** (0 repeats / 10) | Two consecutive 5-question assessments shared no prompt. |

Honest caveats:

* `citation_integrity_verbatim` and `answer_token_grounding` are **lexical** checks. They are
  not semantic faithfulness scores; a fluent-but-wrong Gemini sentence built from excerpt
  words would still pass them.
* The refusal threshold is a fixed BM25 constant. The 8-query probe set is small and was
  written by the team, so it is a smoke test of refusal behaviour, not a calibrated estimate.
* One earlier run scored `citation_location_accuracy = 0.94`: the query *"What does
  generalization mean for a supervised model?"* was answered from the short course-orientation
  slide instead of the supervised-learning slide. Light suffix folding plus a term-coverage
  multiplier in BM25 fixed it. The failure and the fix are kept here rather than hidden.

## 3. Standard framework (RAGAS / DeepEval / TruLens)

**Not executed in this environment: no judge-model API key is available.** We deliberately do
not print numbers we did not measure. `evaluation/ragas_adapter.py` is a complete integration:
it builds the RAGAS dataset from the same fixtures (question, generated answer, retrieved
excerpts, reference slide text) and asks RAGAS for `faithfulness`, `answer_relevancy`,
`context_precision` and `context_recall`. Running it requires
`pip install ragas datasets` plus `GEMINI_API_KEY` (or `OPENAI_API_KEY`); without a key it
exits with an explicit message:

```bash
pip install ragas datasets
export GEMINI_API_KEY=...
python -m evaluation.run --framework ragas
```

The local metrics above are the honest substitute in the meantime: they cover the same four
questions (is the answer supported, is it relevant, was the right context retrieved, was the
needed context retrieved) with deterministic checks that cannot be hallucinated by a judge.

## 4. Personalization study (simulated students)

`evaluation/simulation.py` drives three synthetic profiles through the **real API** — each
session creates an adaptive assessment, answers every question with a profile-specific
probability that also depends on question difficulty, submits it, and reads back the mastery
state. 5 sessions × 3 questions per profile, fixed seeds.

| Profile (simulated) | Start mean mastery | End mean mastery | Mean mastery gain | Question repetition rate |
|---|---|---|---|---|
| `steady_improver` (p=0.35 + 0.06/session) | 0.300 | 0.4345 | **+0.157** | 0.000 |
| `strong_student` (p=0.80 + 0.02/session) | 0.300 | 0.8022 | **+0.586** | 0.000 |
| `struggling_student` (p=0.20 + 0.03/session) | 0.300 | 0.2966 | **−0.004** | 0.000 |

Session-by-session mean mastery (all seven topics):

```
steady_improver     0.246 → 0.282 → 0.367 → 0.427 → 0.435   (scores 0.00 → 0.67)
strong_student      0.443 → 0.608 → 0.706 → 0.804 → 0.802   (scores 1.00 → 0.67)
struggling_student  0.246 → 0.241 → 0.406 → 0.381 → 0.297   (scores 0.00 → 0.33)
```

What this does and does not show:

* It shows the learner model **responds** correctly to evidence: consistently correct answer
  streams raise per-topic estimates, a mostly-wrong stream keeps the estimate at or below the
  0.3 prior, and evidence counts grow for every topic the student was assessed on.
* The declining `strong_student` score in the last session is the adaptive generator working
  as designed — as mastery rises it serves harder items, so the profile's success rate drops
  even though its mean mastery stays above 0.80.
* It does **not** show human learning. The simulated students are stochastic answerers, so the
  gains are a property of the BKT update and the scheduler. No claim about real study outcomes
  is made.
* Question repetition rate is 0.000 across all sessions. The reviewed offline bank holds 18
  items; longer offline runs hit a 409 "no unseen verified questions remain" response, which
  the harness records in `bank_exhausted_at_session` instead of silently repeating items.
  Setting `GEMINI_API_KEY` enables verified generated items and extends the run.

## 5. Functional test coverage

`python -m pytest -q` → **20 passed** (no network, no key):

* ingestion: text paragraphs, PDF page numbers, PPTX slide numbers, actionable missing-key
  error for images, extension/signature mismatch, empty file, unsupported type
* grounding: cited answer with the exact slide, off-material refusal
* assessment: tagging and answer-key hiding, no repeats across assessments, empty-scope 409
* learner model: wrong answers lower mastery, correct answers raise it, idempotent submission,
  bounded updates
* API: seeded dashboard, text paste ingestion and tagging, TXT upload end-to-end

## 6. Raw results

* `evaluation/results/local_eval.json` — per-question retrieval detail, off-material answers,
  novelty detail
* `evaluation/results/simulation.json` — per-profile session histories and final per-topic
  mastery