"""Optional RAGAS integration. Requires `pip install ragas datasets` plus a judge key.

The harness builds a dataset from the seeded course (question, answer, contexts,
ground-truth context) and asks RAGAS for faithfulness, answer relevancy,
context precision and context recall. It is deliberately not run automatically:
without a real judge model the numbers would be meaningless.
"""

from __future__ import annotations

import os

from backend import db, retrieval
from backend.main import seed_sample_course
from evaluation.fixtures import expected_slide_text, in_material_cases


def build_samples() -> list[dict]:
    db.reset()
    seed_sample_course()
    index = retrieval.Index()
    samples = []
    for case in in_material_cases():
        result = retrieval.answer(case["question"], index)
        samples.append({
            "user_input": case["question"],
            "response": result["answer"],
            "retrieved_contexts": [citation["excerpt"] for citation in result["citations"]]
            or ["(no context retrieved)"],
            "reference": expected_slide_text(case["topic_slug"]),
        })
    return samples


def run_ragas() -> dict:
    from datasets import Dataset
    from ragas import evaluate
    from ragas.metrics import (answer_relevancy, context_precision, context_recall,
                               faithfulness)

    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")):
        raise SystemExit("RAGAS needs a judge model key (GEMINI_API_KEY or OPENAI_API_KEY). "
                         "Refusing to report unverified metric values.")
    dataset = Dataset.from_list(build_samples())
    scores = evaluate(dataset, metrics=[faithfulness, answer_relevancy,
                                        context_precision, context_recall])
    return {"framework": "ragas", "judge": "gemini" if os.environ.get("GEMINI_API_KEY") else "openai",
            "metrics": {key: float(value) for key, value in dict(scores).items()}}