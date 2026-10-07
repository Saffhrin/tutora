"""SQLite persistence, topic tagging and learner state for Tutora."""

from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
import time
import uuid
from pathlib import Path

DATA_DIR = Path(os.environ.get("TUTORA_DATA_DIR", "data"))
UPLOAD_DIR = DATA_DIR / "uploads"

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None

STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "is", "are", "was", "were", "be", "been",
    "it", "its", "this", "that", "these", "those", "for", "on", "at", "by", "with", "as", "from",
    "we", "you", "they", "he", "she", "i", "not", "no", "do", "does", "did", "can", "could",
    "will", "would", "should", "may", "might", "must", "than", "then", "there", "their", "them",
    "which", "who", "what", "when", "where", "why", "how", "if", "but", "so", "such", "more",
    "most", "other", "into", "also", "each", "all", "any", "some", "both", "only", "just",
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  prerequisites TEXT NOT NULL DEFAULT '[]', mastery REAL NOT NULL DEFAULT 0.3,
  evidence_count INTEGER NOT NULL DEFAULT 0, keywords TEXT NOT NULL DEFAULT '[]',
  auto INTEGER NOT NULL DEFAULT 0, created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready', error TEXT, stored_path TEXT, mime TEXT,
  created_at REAL NOT NULL, unit_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL, ord INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL, topic_id TEXT, location TEXT NOT NULL DEFAULT '{}',
  visual_description TEXT, keywords TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_units_source ON units(source_id);
CREATE INDEX IF NOT EXISTS idx_units_topic ON units(topic_id);
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY, created_at REAL NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
  score REAL, config TEXT NOT NULL DEFAULT '{}', diagnostic INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, ord INTEGER NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL, kind TEXT NOT NULL, options TEXT NOT NULL DEFAULT '[]',
  answer TEXT NOT NULL, topic_id TEXT, difficulty TEXT NOT NULL DEFAULT 'medium',
  unit_id TEXT, explanation TEXT NOT NULL DEFAULT '', signature TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'bank', verified INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_questions_assessment ON questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_questions_signature ON questions(signature);
CREATE TABLE IF NOT EXISTS answers (
  assessment_id TEXT NOT NULL, question_id TEXT NOT NULL, student_answer TEXT NOT NULL DEFAULT '',
  correct INTEGER NOT NULL DEFAULT 0, created_at REAL NOT NULL,
  PRIMARY KEY (assessment_id, question_id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL,
  citations TEXT NOT NULL DEFAULT '[]', topic_id TEXT, mode TEXT,
  created_at REAL NOT NULL
);
"""


def get_conn() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(DATA_DIR / "tutora.db", check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.executescript(SCHEMA)
            _conn.commit()
        return _conn


def reset() -> None:
    """Test helper: drop every table and rebuild."""
    conn = get_conn()
    with _lock:
        for table in ("topics", "sources", "units", "assessments", "questions", "answers", "chat_messages"):
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.executescript(SCHEMA)
        conn.commit()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def keywords(text: str, limit: int = 18) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}", text.lower())
    counts: dict[str, int] = {}
    for word in words:
        if word in STOPWORDS:
            continue
        counts[word] = counts.get(word, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [word for word, _ in ranked[:limit]]


# ---------------------------------------------------------------- topics

def create_topic(name: str, description: str = "", prerequisites: list[str] | None = None,
                 auto: bool = False, topic_id: str | None = None) -> str:
    topic_id = topic_id or new_id("top")
    profile = keywords(f"{name} {description}")
    with _lock:
        conn = get_conn()
        conn.execute(
            "INSERT OR REPLACE INTO topics (id,name,description,prerequisites,mastery,"
            "evidence_count,keywords,auto,created_at) VALUES (?,?,?,?,COALESCE("
            "(SELECT mastery FROM topics WHERE id=?),0.3),COALESCE((SELECT evidence_count FROM topics"
            " WHERE id=?),0),?,?,?)",
            (topic_id, name, description, json.dumps(prerequisites or []), topic_id, topic_id,
             json.dumps(profile), 1 if auto else 0, time.time()),
        )
        conn.commit()
    return topic_id


def topic_by_name(name: str) -> sqlite3.Row | None:
    return get_conn().execute("SELECT * FROM topics WHERE lower(name)=lower(?)", (name,)).fetchone()


def get_topic(topic_id: str) -> sqlite3.Row | None:
    return get_conn().execute("SELECT * FROM topics WHERE id=?", (topic_id,)).fetchone()


def list_topics() -> list[sqlite3.Row]:
    return get_conn().execute(
        "SELECT t.*, (SELECT COUNT(*) FROM units u WHERE u.topic_id=t.id) AS unit_count "
        "FROM topics t ORDER BY t.auto, t.created_at, t.name"
    ).fetchall()


def topic_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"], "name": row["name"], "description": row["description"],
        "prerequisites": json.loads(row["prerequisites"] or "[]"),
        "mastery": round(float(row["mastery"]), 4),
        "evidence_count": int(row["evidence_count"]),
        "unit_count": int(row["unit_count"]) if "unit_count" in row.keys() else 0,
        "auto": bool(row["auto"]),
    }


def set_mastery(topic_id: str, mastery: float, increment_evidence: int = 0) -> None:
    with _lock:
        conn = get_conn()
        conn.execute(
            "UPDATE topics SET mastery=?, evidence_count=evidence_count+? WHERE id=?",
            (round(mastery, 4), increment_evidence, topic_id),
        )
        conn.commit()


AUTO_TOPIC_CAP = 8


def match_topic(text: str, source_title: str = "") -> str | None:
    """Deterministically tag a unit to the best matching topic profile."""
    unit_words = set(keywords(text, 30))
    best_id, best_score = None, 0.0
    for row in list_topics():
        profile = set(json.loads(row["keywords"] or "[]"))
        if not profile:
            continue
        overlap = len(unit_words & profile)
        score = overlap / (len(profile) ** 0.5 or 1)
        if overlap >= 2 and score > best_score:
            best_id, best_score = row["id"], score
    if best_id:
        return best_id
    slug = re.sub(r"[^a-z0-9]+", " ", (source_title or "uploaded material").lower()).strip()
    if not slug:
        return None
    existing = get_conn().execute(
        "SELECT id FROM topics WHERE auto=1 AND lower(name)=?", (slug.title(),)
    ).fetchone()
    if existing:
        return existing["id"]
    auto_count = get_conn().execute("SELECT COUNT(*) c FROM topics WHERE auto=1").fetchone()["c"]
    if auto_count >= AUTO_TOPIC_CAP:
        return None
    return create_topic(slug.title(), f"Auto-grouped units from “{source_title}”. No prerequisite "
                         "information was stated in the material.", auto=True)


# ---------------------------------------------------------------- sources & units

def create_source(title: str, kind: str, stored_path: str | None = None,
                  mime: str | None = None) -> str:
    source_id = new_id("src")
    with _lock:
        conn = get_conn()
        conn.execute(
            "INSERT INTO sources (id,title,kind,status,stored_path,mime,created_at,unit_count)"
            " VALUES (?,?,?,'processing',?,?,?,0)",
            (source_id, title, kind, stored_path, mime, time.time()),
        )
        conn.commit()
    return source_id


def finish_source(source_id: str, status: str, error: str | None = None) -> None:
    with _lock:
        conn = get_conn()
        conn.execute("UPDATE sources SET status=?, error=? WHERE id=?", (status, error, source_id))
        conn.execute("UPDATE sources SET unit_count=(SELECT COUNT(*) FROM units WHERE source_id=?)"
                     " WHERE id=?", (source_id, source_id))
        conn.commit()


def add_unit(source_id: str, text: str, location: dict, visual_description: str | None = None,
             topic_id: str | None = None, topic_name_hint: str = "") -> str:
    unit_id = new_id("unit")
    with _lock:
        conn = get_conn()
        order = conn.execute("SELECT COALESCE(MAX(ord),-1)+1 n FROM units WHERE source_id=?",
                             (source_id,)).fetchone()["n"]
        if topic_id is None:
            topic_id = match_topic(f"{text} {visual_description or ''} {topic_name_hint}", topic_name_hint)
        conn.execute(
            "INSERT INTO units (id,source_id,ord,text,topic_id,location,visual_description,keywords)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (unit_id, source_id, order, text, topic_id, json.dumps(location), visual_description,
             json.dumps(keywords(text + " " + (visual_description or "")))),
        )
        conn.commit()
    return unit_id


def get_source(source_id: str) -> sqlite3.Row | None:
    return get_conn().execute("SELECT * FROM sources WHERE id=?", (source_id,)).fetchone()


def list_sources() -> list[sqlite3.Row]:
    return get_conn().execute("SELECT * FROM sources ORDER BY created_at DESC").fetchall()


def source_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"], "title": row["title"], "kind": row["kind"], "status": row["status"],
        "error": row["error"], "unit_count": int(row["unit_count"]),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(row["created_at"])),
    }


def list_units(source_id: str | None = None) -> list[sqlite3.Row]:
    if source_id:
        return get_conn().execute(
            "SELECT u.*, s.title source_title, t.name topic_name FROM units u"
            " JOIN sources s ON s.id=u.source_id LEFT JOIN topics t ON t.id=u.topic_id"
            " WHERE u.source_id=? ORDER BY u.ord", (source_id,)).fetchall()
    return get_conn().execute(
        "SELECT u.*, s.title source_title, t.name topic_name FROM units u"
        " JOIN sources s ON s.id=u.source_id LEFT JOIN topics t ON t.id=u.topic_id"
        " ORDER BY s.created_at, u.ord").fetchall()


def unit_dict(row: sqlite3.Row) -> dict:
    location = json.loads(row["location"] or "{}")
    return {
        "id": row["id"], "source_id": row["source_id"], "text": row["text"],
        "topic_id": row["topic_id"], "topic_name": row["topic_name"],
        "location": location, "visual_description": row["visual_description"],
        "source_title": row["source_title"] if "source_title" in row.keys() else None,
    }


def location_label(location) -> str:
    location = location_dict(location)
    if location.get("page"):
        return f"page {location['page']}"
    if location.get("slide"):
        return f"slide {location['slide']}"
    if location.get("timestamp_seconds") is not None:
        seconds = int(location["timestamp_seconds"])
        return f"{seconds // 60:02d}:{seconds % 60:02d}"
    return location.get("label") or "whole document"


def location_dict(location) -> dict:
    if isinstance(location, str):
        try:
            location = json.loads(location or "{}")
        except json.JSONDecodeError:
            location = {}
    if not isinstance(location, dict):
        location = {}
    return location


# ---------------------------------------------------------------- assessments

def question_signature(prompt: str) -> str:
    import hashlib

    normalized = re.sub(r"[^a-z0-9 ]+", "", prompt.lower())
    return hashlib.sha1(" ".join(normalized.split()).encode()).hexdigest()[:16]


def seen_signatures() -> set[str]:
    rows = get_conn().execute("SELECT DISTINCT signature FROM questions").fetchall()
    return {row["signature"] for row in rows}


def create_assessment(questions: list[dict], config: dict, diagnostic: bool = False) -> str:
    assessment_id = new_id("asm")
    with _lock:
        conn = get_conn()
        conn.execute("INSERT INTO assessments (id,created_at,completed,config,diagnostic)"
                     " VALUES (?,?,0,?,?)",
                     (assessment_id, time.time(), json.dumps(config), 1 if diagnostic else 0))
        for index, question in enumerate(questions):
            conn.execute(
                "INSERT INTO questions (id,assessment_id,ord,prompt,kind,options,answer,topic_id,"
                "difficulty,unit_id,explanation,signature,origin,verified)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (question["id"], assessment_id, index, question["prompt"], question["kind"],
                 json.dumps(question.get("options") or []), question["answer"], question.get("topic_id"),
                 question.get("difficulty", "medium"), question.get("unit_id"),
                 question.get("explanation", ""), question_signature(question["prompt"]),
                 question.get("origin", "bank"), 1 if question.get("verified", True) else 0),
            )
        conn.commit()
    return assessment_id


def assessment_questions(assessment_id: str) -> list[sqlite3.Row]:
    return get_conn().execute(
        "SELECT q.*, t.name topic_name FROM questions q LEFT JOIN topics t ON t.id=q.topic_id"
        " WHERE q.assessment_id=? ORDER BY q.ord", (assessment_id,)).fetchall()


def get_assessment(assessment_id: str) -> sqlite3.Row | None:
    return get_conn().execute("SELECT * FROM assessments WHERE id=?", (assessment_id,)).fetchone()


def list_assessments() -> list[sqlite3.Row]:
    return get_conn().execute(
        "SELECT a.*, (SELECT COUNT(*) FROM questions q WHERE q.assessment_id=a.id) AS question_count"
        " FROM assessments a ORDER BY a.created_at DESC").fetchall()


def record_answers(assessment_id: str, rows: list[tuple[str, str, bool]]) -> None:
    with _lock:
        conn = get_conn()
        conn.executemany(
            "INSERT OR REPLACE INTO answers (assessment_id,question_id,student_answer,correct,created_at)"
            " VALUES (?,?,?,?,?)",
            [(assessment_id, qid, answer, 1 if correct else 0, time.time())
             for qid, answer, correct in rows],
        )
        conn.commit()


def complete_assessment(assessment_id: str, score: float) -> None:
    with _lock:
        conn = get_conn()
        conn.execute("UPDATE assessments SET completed=1, score=? WHERE id=?", (score, assessment_id))
        conn.commit()


def save_chat(role: str, content: str, citations: list[dict] | None = None,
              topic_id: str | None = None, mode: str | None = None) -> str:
    message_id = new_id("msg")
    with _lock:
        conn = get_conn()
        conn.execute("INSERT INTO chat_messages (id,role,content,citations,topic_id,mode,created_at)"
                     " VALUES (?,?,?,?,?,?,?)",
                     (message_id, role, content, json.dumps(citations or []), topic_id, mode, time.time()))
        conn.commit()
    return message_id


def recent_chat(limit: int = 12) -> list[sqlite3.Row]:
    return get_conn().execute(
        "SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()