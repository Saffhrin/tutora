"""Personalization study: simulated student profiles driven through the real API.

What this measures (and what it does not):
  * It measures how the learner model *responds* to a synthetic stream of correct and
    incorrect answers: mastery movement, and whether the generator keeps serving new
    questions. It does NOT measure real human learning, because the simulated students
    are stochastic answerers, not people. Observed gains are a property of the BKT
    update and the quiz scheduler, and are reported as such.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

if not os.environ.get("TUTORA_DATA_DIR"):
    os.environ["TUTORA_DATA_DIR"] = tempfile.mkdtemp(prefix="tutora-sim-")

from fastapi.testclient import TestClient  # noqa: E402

from backend import db  # noqa: E402
from backend.main import app, seed_sample_course  # noqa: E402

# skill = probability of answering a topic's question correctly in that profile
PROFILES = {
    "steady_improver": {"skill": 0.35, "growth": 0.06, "difficulty_bias": 0.0},
    "strong_student": {"skill": 0.8, "growth": 0.02, "difficulty_bias": 0.0},
    "struggling_student": {"skill": 0.2, "growth": 0.03, "difficulty_bias": -0.1},
}

DIFFICULTY_PENALTY = {"easy": 0.15, "medium": 0.0, "hard": -0.2}


def run_profile(name: str, config: dict, sessions: int, questions_per_session: int,
                seed: int, fresh: bool = True) -> dict:
    random.seed(seed)
    if fresh:
        db.reset()
        seed_sample_course()

    seen_prompts: set[str] = set()
    repeats = 0
    asked = 0
    mastery_history = []
    exhausted_at_session = None
    with TestClient(app) as client:
        for session in range(sessions):
            skill = min(0.97, config["skill"] + config["growth"] * session)
            created = client.post("/api/assessments", json={
                "count": questions_per_session, "kind": "mixed", "difficulty": "adaptive",
                "topic_ids": [],
            })
            if created.status_code == 409:
                # The reviewed offline bank is finite: this is real, reportable behaviour.
                exhausted_at_session = session + 1
                break
            created = created.json()
            answers = {}
            for question in created["questions"]:
                asked += 1
                if question["prompt"] in seen_prompts:
                    repeats += 1
                seen_prompts.add(question["prompt"])
                row = next(
                    item for item in db.assessment_questions(created["id"])
                    if item["id"] == question["id"]
                )
                probability = min(0.98, max(0.02, skill + config["difficulty_bias"]
                                            + DIFFICULTY_PENALTY.get(row["difficulty"], 0.0)))
                answers[question["id"]] = row["answer"] if random.random() < probability else "not sure"
            report = client.post(f"/api/assessments/{created['id']}/submit",
                                 json={"answers": answers}).json()
            mastery_history.append({
                "session": session + 1,
                "score": report["score"],
                "mean_mastery": round(sum(topic["mastery"] for topic in
                                          client.get("/api/topics").json()) / 7, 4),
            })
        final_topics = client.get("/api/topics").json()

    graded = [topic for topic in final_topics if topic["evidence_count"] > 0]
    return {
        "profile": name,
        "sessions": sessions,
        "questions_asked": asked,
        "question_repetition_rate": round(repeats / asked, 4) if asked else 0.0,
        "sessions_completed": len(mastery_history),
        "bank_exhausted_at_session": exhausted_at_session,
        "mastery_history": mastery_history,
        "mastery_gain_mean": round(
            sum(topic["mastery"] - 0.3 for topic in graded) / len(graded), 4) if graded else 0.0,
        "topics_with_evidence": len(graded),
        "final_topics": [{"name": topic["name"], "mastery": topic["mastery"],
                          "evidence": topic["evidence_count"]} for topic in final_topics],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sessions", type=int, default=5)
    parser.add_argument("--questions", type=int, default=5)
    parser.add_argument("--out", default="evaluation/results/simulation.json")
    args = parser.parse_args()

    results = [
        run_profile(name, config, args.sessions, args.questions, seed=17 + index)
        for index, (name, config) in enumerate(PROFILES.items())
    ]
    summary = {
        "setup": {"sessions": args.sessions, "questions_per_session": args.questions,
                  "profiles": list(PROFILES)},
        "caveat": ("Simulated students are stochastic answerers driven through the real API. "
                   "Gains show learner-model responsiveness, not human learning. In offline mode "
                   "the reviewed question bank is finite (18 items), so long runs end with the API "
                   "reporting that no unseen verified questions remain; configuring GEMINI_API_KEY "
                   "extends generation with verified items."),
        "profiles": results,
        "question_repetition_rate_overall": round(
            sum(item["question_repetition_rate"] for item in results) / len(results), 4),
    }
    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, indent=2))
    for item in results:
        print(f"{item['profile']:20s} gain={item['mastery_gain_mean']:+.3f} "
              f"repetition={item['question_repetition_rate']:.3f} "
              f"topics_with_evidence={item['topics_with_evidence']}")
    print(f"overall question repetition rate: {summary['question_repetition_rate_overall']:.3f}")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()