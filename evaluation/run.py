"""Retrieval and grounding evaluation against the seeded sample course.

Reported metrics are local and deterministic:
  source_hit@k        share of in-material questions whose expected slide is in the top-k hits
  citation_location   share of grounded answers whose first citation is the expected slide
  refusal_accuracy    share of off-material queries the tutor declines
  citation_integrity  share of citation excerpts that appear verbatim in the cited unit
  answer_token_grounding  share of answer tokens (len > 3) present in the cited excerpts

These are NOT RAGAS/DeepEval/TruLens numbers. To run a standard framework, install
the extra and provide a judge key: see `--framework ragas`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

if not os.environ.get("TUTORA_DATA_DIR"):
    os.environ["TUTORA_DATA_DIR"] = tempfile.mkdtemp(prefix="tutora-eval-")

from backend import db, retrieval  # noqa: E402
from backend.main import seed_sample_course  # noqa: E402
from evaluation.fixtures import expected_slide_text, in_material_cases, OFF_MATERIAL  # noqa: E402


def prepare() -> retrieval.Index:
    db.reset()
    seed_sample_course()
    return retrieval.Index()


def ratio(part: int, total: int) -> float:
    return round(part / total, 4) if total else 0.0


def evaluate(k: int = 4) -> dict:
    index = prepare()
    units_by_slide = {}
    for row in db.list_units():
        location = db.location_dict(row["location"])
        if location.get("slide"):
            units_by_slide.setdefault(location["slide"], []).append(row["id"])

    source_hits, location_hits, grounded_count = 0, 0, 0
    sentences_total = sentences_verbatim = 0
    token_covered = token_total = 0
    per_question = []
    for case in in_material_cases():
        hits = index.search(case["question"], k=k)
        hit_slides = [db.location_dict(row["location"]).get("slide") for row, _score in hits]
        hit = case["expected_slide"] in hit_slides
        source_hits += int(hit)
        answer = retrieval.answer(case["question"], index)
        grounded = bool(answer["grounded"] and answer["citations"])
        grounded_count += int(grounded)
        cited_slide = answer["citations"][0]["location"].get("slide") if grounded else None
        location_ok = grounded and cited_slide == case["expected_slide"]
        location_hits += int(location_ok)
        excerpt_terms: set[str] = set()
        for citation in answer["citations"]:
            unit = next((row for row in db.list_units() if row["id"] == citation["unit_id"]), None)
            if unit is None:
                continue
            excerpt_terms |= {t for t in retrieval.tokenize(citation["excerpt"]) if len(t) > 3}
            # Every sentence of a citation must appear verbatim in the cited unit.
            for sentence in (s.strip() for s in citation["excerpt"].split(". ")):
                if len(sentence) < 12:
                    continue
                sentences_total += 1
                sentences_verbatim += int(sentence.rstrip(".") in unit["text"])
        # Measure grounding over the answer body only. The fixed extractive preamble
        # ("Here is what your course material says…") is UI framing, not a claim.
        body = answer["answer"]
        if answer["mode"] == "extractive" and "\n\n" in body:
            body = body.split("\n\n", 1)[1]
        answer_terms = {t for t in retrieval.tokenize(body) if len(t) > 3}
        if answer_terms:
            token_total += 1
            token_covered += len(answer_terms & excerpt_terms) / len(answer_terms)
        per_question.append({
            "question": case["question"], "expected_slide": case["expected_slide"],
            "retrieved_slides": hit_slides, "source_hit": hit,
            "grounded": grounded, "cited_slide": cited_slide, "citation_correct": location_ok,
        })

    refusals = 0
    off_material_report = []
    for query in OFF_MATERIAL:
        answer = retrieval.answer(query, index)
        declined = not answer["grounded"]
        refusals += int(declined)
        off_material_report.append({"query": query, "declined": declined, "answer": answer["answer"][:160]})

    novelty = question_novelty()
    return {
        "corpus": {"sources": 1, "units": len(db.list_units()), "topics": len(db.list_topics())},
        "k": k,
        "metrics": {
            "source_hit_at_k": ratio(source_hits, len(in_material_cases())),
            "grounded_rate_in_material": ratio(grounded_count, len(in_material_cases())),
            "citation_location_accuracy": ratio(location_hits, len(in_material_cases())),
            "refusal_accuracy_off_material": ratio(refusals, len(OFF_MATERIAL)),
            "citation_integrity_verbatim": ratio(sentences_verbatim, sentences_total),
            "answer_token_grounding": round(token_covered / token_total, 4) if token_total else 0.0,
            "question_novelty_rate": novelty["novelty_rate"],
        },
        "in_material_detail": per_question,
        "off_material_detail": off_material_report,
        "question_novelty": novelty,
        "notes": [
            "answer_token_grounding is a lexical proxy, not a semantic faithfulness score.",
            "refusal_accuracy uses an 8-query off-material probe set written by the team.",
        ],
    }


def question_novelty() -> dict:
    """Repetition rate between consecutive generated assessments (API path)."""
    from fastapi.testclient import TestClient

    from backend.main import app

    with TestClient(app) as client:
        first = client.post("/api/assessments", json={"count": 5, "kind": "mixed"}).json()["questions"]
        second = client.post("/api/assessments", json={"count": 5, "kind": "mixed"}).json()["questions"]
    first_prompts = {question["prompt"] for question in first}
    second_prompts = {question["prompt"] for question in second}
    repeated = len(first_prompts & second_prompts)
    total = len(second_prompts) or 1
    return {
        "first_assessment": sorted(first_prompts), "second_assessment": sorted(second_prompts),
        "repeated": repeated, "novelty_rate": round(1 - repeated / total, 4),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--k", type=int, default=4)
    parser.add_argument("--out", default="evaluation/results/local_eval.json")
    parser.add_argument("--framework", default="local", choices=["local", "ragas", "deepeval"])
    args = parser.parse_args()

    if args.framework != "local":
        run_standard_framework(args.framework)
        return

    results = evaluate(args.k)
    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, indent=2))
    print(json.dumps(results["metrics"], indent=2))
    print(f"\nwrote {out}")


def run_standard_framework(name: str) -> None:
    """Run RAGAS/DeepEval for real, or fail loudly. Never prints fabricated numbers."""
    if name == "ragas":
        try:
            import ragas  # noqa: F401
        except ImportError:
            raise SystemExit(
                "RAGAS is not installed in this environment. Install it with "
                "`pip install ragas datasets langchain-google-genai` and set GEMINI_API_KEY (or "
                "OPENAI_API_KEY) before running `python -m evaluation.run --framework ragas`. "
                "No standard-framework numbers are reported without a real judge."
            )
        from evaluation.ragas_adapter import run_ragas

        print(json.dumps(run_ragas(), indent=2))
        return
    raise SystemExit(f"{name} integration is not implemented; no numbers are reported.")


if __name__ == "__main__":
    main()