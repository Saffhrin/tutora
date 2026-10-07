"""Tutora FastAPI application: ingestion, grounded tutoring, assessment, learner model."""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import db, learning, quiz, retrieval
from .sample import BANK, TEXTS, TOPICS

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
KIND_BY_SUFFIX = {
    ".txt": "text", ".md": "text", ".pdf": "pdf", ".pptx": "slides",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image",
    ".mp4": "video", ".mov": "video", ".mkv": "video", ".webm": "video", ".mpeg": "video",
    ".mpg": "video",
    ".mp3": "audio", ".m4a": "audio", ".wav": "audio", ".aac": "audio", ".ogg": "audio",
    ".flac": "audio",
}

app = FastAPI(title="Tutora", version="0.1.0",
              description="Source-grounded adaptive study companion (hackathon prototype).")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    topic_id: str | None = None


class AssessmentRequest(BaseModel):
    topic_ids: list[str] = []
    count: int = Field(default=5, ge=1, le=10)
    difficulty: str = "adaptive"
    kind: str = "mixed"
    diagnostic: bool = False


class SubmitRequest(BaseModel):
    answers: dict[str, str] = {}


class TextSourceRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=20)


def seed_sample_course() -> None:
    """Load the original CC0 sample course the first time the app runs."""
    if db.get_conn().execute("SELECT COUNT(*) c FROM sources").fetchone()["c"]:
        return
    name_by_slug = {slug: name for slug, name, _description, _pre in TOPICS}
    for _slug, name, description, prerequisites in TOPICS:
        names = [name_by_slug[pre] for pre in prerequisites if pre in name_by_slug]
        db.create_topic(name, description, names)
    topic_id = db.create_topic(
        "Course Orientation",
        "How the Tutora sample course is organised and what the demo can show.",
        [],
        topic_id="top_orientation",
    )
    del topic_id
    source_id = db.create_source("Tutora sample course — Introduction to Machine Learning",
                                 "slides", mime="text/markdown")
    db.add_unit(source_id,
                "This sample course has six short lecture slides covering supervised learning, "
                "linear regression, gradient descent, overfitting and regularization, model "
                "evaluation, and neural networks. Each slide is an independent unit that can be "
                "cited exactly.",
                {"slide": 1}, topic_name_hint="Course Orientation")
    for index, text in enumerate(TEXTS):
        db.add_unit(source_id, text, {"slide": index + 2}, topic_name_hint=TOPICS[index][1])
    db.finish_source(source_id, "ready")


@app.on_event("startup")
def on_startup() -> None:
    db.get_conn()
    seed_sample_course()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


def provider_status() -> dict:
    try:
        from . import provider

        return {"enabled": bool(provider.is_enabled()), "model": provider.model_name()}
    except Exception:
        return {"enabled": False, "model": "unavailable"}


@app.get("/api/dashboard")
def dashboard() -> dict:
    conn = db.get_conn()
    topics = [db.topic_dict(row) for row in db.list_topics()]
    stats = {
        "sources": conn.execute("SELECT COUNT(*) c FROM sources").fetchone()["c"],
        "units": conn.execute("SELECT COUNT(*) c FROM units").fetchone()["c"],
        "topics": len(topics),
        "assessments": conn.execute("SELECT COUNT(*) c FROM assessments").fetchone()["c"],
        "answered_questions": conn.execute("SELECT COUNT(*) c FROM answers").fetchone()["c"],
        "correct_answers": conn.execute("SELECT COUNT(*) c FROM answers WHERE correct=1").fetchone()["c"],
    }
    graded = [t for t in topics if t["evidence_count"] > 0]
    stats["mean_mastery"] = round(sum(t["mastery"] for t in graded) / len(graded), 4) if graded else 0.0
    recommendations = [
        {"topic_id": t["id"], "title": t["name"],
         "reason": ("No evidence yet — start with a short diagnostic quiz."
                    if t["evidence_count"] == 0 else
                    f"Mastery estimate {t['mastery']:.2f} from {t['evidence_count']} graded answers."),
         "mastery": t["mastery"]}
        for t in sorted(graded or topics, key=lambda t: (t["evidence_count"] > 0, t["mastery"]))[:3]
    ]
    return {
        "learner": {"name": "Demo learner"},
        "stats": stats,
        "topics": topics,
        "recommendations": recommendations,
        "provider": provider_status(),
        "disclaimer": ("Mastery estimates update only from graded quiz answers; reading or chat "
                       "activity is never treated as evidence of knowledge."),
    }


@app.get("/api/sources")
def sources() -> list[dict]:
    return [db.source_dict(row) for row in db.list_sources()]


@app.get("/api/sources/{source_id}")
def source_detail(source_id: str) -> dict:
    row = db.get_source(source_id)
    if row is None:
        raise HTTPException(404, "Source not found")
    units = [db.unit_dict(unit) for unit in db.list_units(source_id)]
    return {"source": db.source_dict(row), "units": units}


@app.get("/api/sources/{source_id}/file")
def source_file(source_id: str):
    row = db.get_source(source_id)
    if row is None or not row["stored_path"]:
        raise HTTPException(404, "No original file stored for this source")
    path = Path(row["stored_path"])
    if not path.exists():
        raise HTTPException(404, "Original file is no longer on disk")
    return FileResponse(path, media_type=row["mime"] or "application/octet-stream",
                        filename=path.name)


@app.post("/api/sources/text")
def add_text_source(request: TextSourceRequest) -> dict:
    source_id = db.create_source(request.title, "text")
    paragraphs = [p.strip() for p in request.text.split("\n\n") if p.strip()]
    for index, paragraph in enumerate(paragraphs):
        db.add_unit(source_id, paragraph, {"label": f"paragraph {index + 1}"},
                    topic_name_hint=request.title)
    db.finish_source(source_id, "ready")
    return db.source_dict(db.get_source(source_id))


@app.post("/api/sources/upload")
async def upload_source(file: UploadFile = File(...)) -> dict:
    name = file.filename or "upload"
    suffix = Path(name).suffix.lower()
    kind = KIND_BY_SUFFIX.get(suffix)
    if kind is None:
        raise HTTPException(415, f"Unsupported file type '{suffix or name}'. Supported: "
                                 + ", ".join(sorted(KIND_BY_SUFFIX)))
    payload = await file.read()
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is larger than the 50 MB prototype limit.")
    if not payload:
        raise HTTPException(400, "The uploaded file is empty.")
    db.get_conn()
    stored = db.UPLOAD_DIR / f"{db.new_id('file')}{suffix}"
    stored.write_bytes(payload)
    source_id = db.create_source(Path(name).stem.replace("_", " ").strip() or name, kind,
                                 stored_path=str(stored), mime=file.content_type)
    try:
        from .ingestion import extract_file

        units = extract_file(stored, name)
    except ValueError as error:
        db.finish_source(source_id, "failed", str(error))
        return db.source_dict(db.get_source(source_id))
    except Exception as error:  # pragma: no cover - defensive
        db.finish_source(source_id, "failed", f"Extraction crashed: {error}")
        return db.source_dict(db.get_source(source_id))
    if not units:
        db.finish_source(source_id, "failed",
                         "No readable text or description was extracted from this file.")
        return db.source_dict(db.get_source(source_id))
    for index, unit in enumerate(units):
        location = unit.get("location") or {}
        if not location:
            location = {"label": f"paragraph {index + 1}"}
        db.add_unit(source_id, unit["text"], location,
                    unit.get("visual_description"), topic_name_hint=unit.get("topic_name") or "")
    db.finish_source(source_id, "ready")
    return db.source_dict(db.get_source(source_id))


@app.get("/api/topics")
def topics() -> list[dict]:
    return [db.topic_dict(row) for row in db.list_topics()]


@app.post("/api/chat")
def chat(request: ChatRequest) -> dict:
    index = retrieval.Index()
    result = retrieval.answer(request.message, index, request.topic_id)
    db.save_chat("student", request.message, topic_id=request.topic_id)
    db.save_chat("tutor", result["answer"], result["citations"], request.topic_id, result["mode"])
    return result


@app.get("/api/chat/history")
def chat_history() -> list[dict]:
    return [
        {"id": row["id"], "role": row["role"], "content": row["content"],
         "citations": json.loads(row["citations"] or "[]"), "mode": row["mode"],
         "created_at": row["created_at"]}
        for row in reversed(db.recent_chat(40))
    ]


@app.post("/api/assessments")
def create_assessment(request: AssessmentRequest) -> dict:
    if request.diagnostic and not request.topic_ids:
        request.topic_ids = [row["id"] for row in db.list_topics()
                             if not row["auto"] and row["id"] != "top_orientation"]
        request.count = max(request.count, min(8, len(request.topic_ids) * 2))
    questions, notice = quiz.generate(request.model_dump())
    if not questions:
        raise HTTPException(409, notice or "No questions could be generated for this scope.")
    assessment_id = db.create_assessment(questions, request.model_dump(), request.diagnostic)
    return {
        "id": assessment_id,
        "notice": notice,
        "questions": [
            {
                "id": question["id"], "prompt": question["prompt"], "kind": question["kind"],
                "options": question.get("options") or [], "topic_id": question.get("topic_id"),
                "topic_name": db.get_topic(question["topic_id"])["name"]
                if question.get("topic_id") and db.get_topic(question["topic_id"]) else "Uncategorised",
                "difficulty": question.get("difficulty", "medium"),
                "origin": question.get("origin", "bank"),
                "source": citation_for_unit(question.get("unit_id")),
            }
            for question in questions
        ],
    }


def citation_for_unit(unit_id: str | None) -> dict | None:
    if not unit_id:
        return None
    for row in db.list_units():
        if row["id"] == unit_id:
            return retrieval.citation(row, row["text"])
    return None


@app.get("/api/assessments")
def assessments() -> list[dict]:
    return [
        {"id": row["id"], "completed": bool(row["completed"]),
         "score": row["score"], "question_count": int(row["question_count"]),
         "diagnostic": bool(row["diagnostic"]),
         "created_at": row["created_at"]}
        for row in db.list_assessments()
    ]


@app.post("/api/assessments/{assessment_id}/submit")
def submit_assessment(assessment_id: str, request: SubmitRequest) -> dict:
    assessment = db.get_assessment(assessment_id)
    if assessment is None:
        raise HTTPException(404, "Assessment not found")
    questions = db.assessment_questions(assessment_id)
    existing = {row["question_id"]: row for row in db.get_conn().execute(
        "SELECT * FROM answers WHERE assessment_id=?", (assessment_id,)).fetchall()}

    feedback, rows, correct_count, graded = [], [], 0, 0
    before = {}
    for question in questions:
        prior_answer = existing.get(question["id"])
        given = request.answers.get(question["id"], prior_answer["student_answer"] if prior_answer else "")
        if prior_answer is not None:
            correct = bool(prior_answer["correct"])
        elif question["id"] in request.answers:
            correct = quiz.is_correct(question["kind"], question["answer"], given)
            rows.append((question["id"], given, correct))
        else:
            continue  # unanswered questions are skipped, not counted as wrong
        graded += 1
        correct_count += 1 if correct else 0
        topic_id = question["topic_id"]
        if topic_id:
            before.setdefault(topic_id, db.get_topic(topic_id)["mastery"])
        feedback.append({
            "question_id": question["id"], "prompt": question["prompt"],
            "student_answer": given, "correct": correct,
            "expected_answer": question["answer"], "explanation": question["explanation"],
            "topic_name": question["topic_name"], "topic_id": topic_id,
            "difficulty": question["difficulty"],
            "citation": citation_for_unit(question["unit_id"]),
        })

    if rows and not existing:
        db.record_answers(assessment_id, rows)
        mastery_changes = []
        for topic_id, seen_mastery in before.items():
            topic_questions = [q for q in rows if any(
                question["id"] == q[0] and question["topic_id"] == topic_id for question in questions)]
            for question_id, _given, correct in topic_questions:
                seen_mastery = learning.update_mastery(seen_mastery, correct)
            db.set_mastery(topic_id, seen_mastery, increment_evidence=len(topic_questions))
            mastery_changes.append({
                "topic_id": topic_id, "name": db.get_topic(topic_id)["name"],
                "before": round(before[topic_id], 4), "after": round(seen_mastery, 4),
                "evidence": len(topic_questions),
            })
    else:
        mastery_changes = [
            {"topic_id": topic_id, "name": db.get_topic(topic_id)["name"],
             "before": round(db.get_topic(topic_id)["mastery"], 4),
             "after": round(db.get_topic(topic_id)["mastery"], 4), "evidence": 0}
            for topic_id in before
        ]

    score = round(correct_count / graded, 4) if graded else 0.0
    if not existing:
        db.complete_assessment(assessment_id, score)
    weak = [
        {"id": row["id"], "name": row["name"], "mastery": round(float(row["mastery"]), 4)}
        for row in sorted(
            (db.get_topic(topic_id) for topic_id in before),
            key=lambda row: float(row["mastery"]),
        )
    ]
    misconceptions = []
    seen_topics = set()
    for item in feedback:
        if item["correct"] or not item["topic_id"] or item["topic_id"] in seen_topics:
            continue
        seen_topics.add(item["topic_id"])
        misconceptions.append(
            f"{item['topic_name']}: the missed question was “{item['prompt']}”. "
            f"Source says: {item['explanation']}"
        )
    return {
        "id": assessment_id, "score": score, "correct": correct_count, "total": graded,
        "feedback": feedback, "weak_topics": weak, "mastery_changes": mastery_changes,
        "misconceptions": misconceptions[:3],
    }