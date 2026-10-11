"""Weak-topic revision material and a spaced study plan (requirements 6b and 6c)."""

from __future__ import annotations

import datetime as dt
import re

from . import db, retrieval

WEAK_TOPIC_LIMIT = 3
CARDS_PER_TOPIC = 3
MAX_CARD_CHARS = 420


def weak_topics(limit: int = WEAK_TOPIC_LIMIT, topic_ids: list[str] | None = None) -> list[dict]:
    """Lowest-mastery topics first; ties broken by the least evidence."""
    rows = [row for row in db.list_topics() if row["id"] != "top_orientation"]
    if topic_ids:
        wanted = set(topic_ids)
        rows = [row for row in rows if row["id"] in wanted]
    rows.sort(key=lambda row: (float(row["mastery"]), -int(row["evidence_count"]), row["name"]))
    return [{"id": row["id"], "name": row["name"], "mastery": round(float(row["mastery"]), 4),
             "evidence_count": int(row["evidence_count"])} for row in rows[:limit]]


def _sentences(text: str) -> list[str]:
    flat = " ".join(text.split())
    parts = re.split(r"(?<=[.!?])\s+", flat)
    return [part.strip() for part in parts if len(part.strip()) > 30]


def _card_front(text: str, topic_name: str) -> str:
    """A prompt that the cited excerpt behind the card can actually answer."""
    for line in text.splitlines():
        heading = " ".join(line.split()).rstrip(":").strip()
        if 3 <= len(heading) <= 70 and not heading.endswith("."):
            return f"Explain: {heading}"
    return f"What does the material say about {topic_name}?"


def flashcards(count: int = 8, topic_ids: list[str] | None = None) -> dict:
    """Front/back cards taken verbatim from the weakest topics' cited units."""
    topics = weak_topics(topic_ids=topic_ids)
    cards: list[dict] = []
    for topic in topics:
        rows = db.get_conn().execute(
            "SELECT * FROM units WHERE topic_id=? ORDER BY ord LIMIT ?",
            (topic["id"], CARDS_PER_TOPIC),
        ).fetchall()
        for row in rows:
            sentences = _sentences(row["text"])
            if not sentences:
                continue
            excerpt = sentences[0][:MAX_CARD_CHARS]
            cards.append({
                "id": row["id"],
                "topic_id": topic["id"],
                "topic_name": topic["name"],
                "mastery": topic["mastery"],
                "front": _card_front(row["text"], topic["name"]),
                "back": excerpt,
                "citation": retrieval.citation(row, excerpt),
            })
        if len(cards) >= count:
            break
    return {"cards": cards[:count], "topics": topics}


def schedule(exam_date: str | None = None, minutes_per_day: int = 30, days: int = 7) -> dict:
    """Expanding-interval review plan: weaker topics come back sooner.

    The interval is 1 + round(mastery * 6) days, a crude stand-in for a forgetting curve
    driven by the BKT estimate rather than a fitted memory model (stated, not hidden).
    """
    topics = weak_topics(limit=6)
    today = dt.date.today()
    horizon = max(1, min(int(days), 30))
    exam = None
    if exam_date:
        try:
            exam = dt.date.fromisoformat(exam_date.strip())
        except ValueError:
            exam = None
    days_until_exam = None
    if exam is not None:
        days_until_exam = (exam - today).days
        if days_until_exam > 0:
            horizon = max(1, min(horizon, days_until_exam))
    plan = []
    for offset in range(horizon):
        day = today + dt.timedelta(days=offset)
        due = []
        for topic in topics:
            interval = 1 + round(topic["mastery"] * 6)
            if offset % interval == 0:
                due.append({"topic_id": topic["id"], "name": topic["name"],
                            "mastery": topic["mastery"],
                            "reason": f"mastery {topic['mastery']:.2f} from "
                                      f"{topic['evidence_count']} graded answer(s)"})
        if due:
            share = max(5, int(minutes_per_day / len(due)))
            plan.append({"date": day.isoformat(), "items": due,
                         "minutes": share * len(due), "minutes_per_topic": share})
    return {"exam_date": exam.isoformat() if exam else None, "days_until_exam": days_until_exam,
            "plan": plan, "topics": topics, "minutes_per_day": int(minutes_per_day),
            "method": "BKT mastery drives expanding review intervals; weak topics repeat sooner."}
