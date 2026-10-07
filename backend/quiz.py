"""Adaptive assessment generation with verification and cross-assessment novelty.

Two question sources:
  1. A small human-reviewed bank (`sample.BANK`) used offline; every item is keyed
     to a topic and to the source unit it is derived from.
  2. Optional Gemini generation, which is only kept when an independent
     verification pass reproduces the answer and every cited excerpt is
     verbatim present in the cited unit.
"""

from __future__ import annotations

import re
import uuid

from . import db, retrieval
from .sample import BANK

DIFFICULTY_ORDER = {"easy": 0, "medium": 1, "hard": 2}
DIFFICULTY_SCALE = 1.0


def normalize_answer(text: str) -> str:
    text = (text or "").strip().lower()
    text = text.replace("−", "-").replace("×", "x").replace(",", "")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^(the|a|an)\s+", "", text)
    return text.rstrip(".!")


def numeric_value(text: str) -> float | None:
    match = re.search(r"-?\d+(?:\.\d+)?", (text or "").replace(",", ""))
    return float(match.group()) if match else None


def is_correct(kind: str, expected: str, given: str, tolerance: float = 1e-6) -> bool:
    expected_norm, given_norm = normalize_answer(expected), normalize_answer(given)
    if not given_norm:
        return False
    if kind == "numerical":
        left, right = numeric_value(expected_norm), numeric_value(given_norm)
        if left is not None and right is not None and abs(left - right) <= tolerance:
            return True
    if kind in {"short", "numerical"}:
        expected_terms = [t for t in retrieval.tokenize(expected_norm) if len(t) > 2]
        given_terms = set(retrieval.tokenize(given_norm))
        if expected_terms and all(term in given_terms for term in expected_terms):
            return True
        return expected_norm == given_norm
    return expected_norm == given_norm


def unit_for_topic(topic_id: str, prefer_text: str = "") -> object | None:
    index = retrieval.Index()
    hits = index.search(prefer_text or "definition", k=3, topic_id=topic_id)
    if hits:
        return hits[0][0]
    rows = [row for row in db.list_units() if row["topic_id"] == topic_id]
    return rows[0] if rows else None


def bank_candidates(topic_ids: list[str], kind: str, difficulty: str) -> list[dict]:
    topics = {row["id"]: row for row in db.list_topics()}
    ordered = list(topics.values())
    if topic_ids:
        ordered = [row for row in ordered if row["id"] in topic_ids]
    ordered.sort(key=lambda row: row["mastery"])  # weakest topics first (adaptive)
    candidates: list[dict] = []
    for topic in ordered:
        for topic_index, item_kind, item_difficulty, prompt, answer, choices, explanation in BANK:
            if topics_name(topic_index) != topic["name"]:
                continue
            if kind != "mixed" and item_kind != kind:
                continue
            if difficulty != "adaptive" and item_difficulty != difficulty:
                continue
            unit = unit_for_topic(topic["id"], prompt)
            if unit is None:
                continue
            candidates.append({
                "id": db.new_id("q"), "prompt": prompt, "kind": item_kind,
                "options": choices, "answer": answer, "topic_id": topic["id"],
                "difficulty": item_difficulty, "unit_id": unit["id"],
                "explanation": explanation, "origin": "bank", "verified": True,
                "topic_mastery": float(topic["mastery"]),
            })
    if difficulty == "adaptive":
        candidates.sort(key=lambda item: (item["topic_mastery"],
                                          DIFFICULTY_ORDER[item["difficulty"]]))
    return candidates


def topics_name(topic_index: int) -> str:
    from .sample import TOPICS

    return TOPICS[topic_index][1]


def target_difficulty(topic_ids: list[str]) -> dict[str, str]:
    topics = {row["id"]: float(row["mastery"]) for row in db.list_topics()}
    mapping = {}
    for topic_id, mastery in topics.items():
        if mastery < 0.35:
            mapping[topic_id] = "easy"
        elif mastery < 0.7:
            mapping[topic_id] = "medium"
        else:
            mapping[topic_id] = "hard"
    return mapping


def generate(config: dict) -> tuple[list[dict], str | None]:
    count = max(1, min(10, int(config.get("count", 5))))
    kind = config.get("kind", "mixed")
    difficulty = config.get("difficulty", "adaptive")
    topic_ids = list(config.get("topic_ids") or [])
    if not db.list_units():
        return [], "Your library is empty. Upload a source or load the sample course first."

    seen = db.seen_signatures()
    candidates = bank_candidates(topic_ids, kind, difficulty)
    selected, used_signatures, used_topics = [], set(), set()
    for item in candidates:
        signature = db.question_signature(item["prompt"])
        if signature in seen or signature in used_signatures:
            continue
        selected.append(item)
        used_signatures.add(signature)
        used_topics.add(item["topic_id"])
        if len(selected) >= count:
            break

    notice = None
    if len(selected) < count:
        extra, extra_notice = gemini_questions(config, count - len(selected), seen | used_signatures)
        selected.extend(extra)
        notice = extra_notice

    if not selected:
        return [], ("Every verified question for this scope has already been used in a previous "
                    "assessment. Widen the topic scope, or set GEMINI_API_KEY to generate new "
                    "verified items.")
    if len(selected) < count:
        notice = notice or (f"Only {len(selected)} verified unseen questions were available for "
                            f"this scope out of the {count} requested.")
    return selected, notice


def gemini_questions(config: dict, needed: int, seen: set[str]) -> tuple[list[dict], str | None]:
    if needed <= 0:
        return [], None
    try:
        from . import provider

        if not provider.is_enabled():
            return [], ("Question generation fell back to the reviewed bank because no Gemini API "
                        "key is configured.")
    except Exception:
        return [], None

    topic_ids = config.get("topic_ids") or [row["id"] for row in db.list_topics()][:4]
    units = []
    for topic_id in topic_ids:
        for row in db.list_units():
            if row["topic_id"] == topic_id:
                units.append(row)
                break
    if not units:
        return [], None
    context = "\n\n".join(
        f"[UNIT {row['id']}] ({row['source_title']}, {db.location_label(row['location'])})\n{row['text']}"
        for row in units
    )
    difficulty = config.get("difficulty", "adaptive")
    prompt = (
        "Create exam questions strictly from the numbered UNIT excerpts. Use only facts, numbers "
        "and formulas stated in them.\n"
        f"Kind requested: {config.get('kind', 'mixed')}. Difficulty: {difficulty}. "
        f"Produce {needed} questions.\n"
        'Return JSON {"questions":[{"prompt":str,"kind":"mcq"|"short"|"numerical",'
        '"options":[str],"answer":str,"unit_id":str,"difficulty":"easy"|"medium"|"hard",'
        '"explanation":str}]} with exactly one correct option for mcq.\n\n' + context
    )
    try:
        payload = provider.generate_json(prompt)
    except Exception as error:
        return [], f"Gemini question generation failed ({error}); used the reviewed bank instead."

    produced: list[dict] = []
    for raw in (payload.get("questions") or [])[:needed * 2]:
        verified, reason = verify_generated(raw, units)
        if not verified:
            continue
        signature = db.question_signature(verified["prompt"])
        if signature in seen:
            continue
        seen.add(signature)
        produced.append(verified)
        if len(produced) >= needed:
            break
    notice = None
    if not produced:
        notice = ("Generated questions failed verification (independent re-solve plus verbatim "
                  "excerpt check), so they were discarded.")
    return produced, notice


def verify_generated(raw: dict, units: list) -> tuple[dict | None, str]:
    prompt = str(raw.get("prompt") or "").strip()
    answer = str(raw.get("answer") or "").strip()
    kind = str(raw.get("kind") or "short").lower()
    unit_id = str(raw.get("unit_id") or "").strip()
    if len(prompt) < 15 or not answer:
        return None, "incomplete item"
    if kind not in {"mcq", "short", "numerical"}:
        return None, "unsupported kind"
    unit = next((row for row in units if row["id"] == unit_id), None)
    if unit is None:
        return None, "unknown cited unit"
    options = [str(option) for option in (raw.get("options") or [])]
    if kind == "mcq":
        if len(options) < 3 or not any(normalize_answer(answer) == normalize_answer(o) for o in options):
            return None, "mcq answer not among options"
    try:
        from . import provider

        check = provider.generate_json(
            "Answer the question using only the excerpt. Reply JSON "
            '{"answer": str, "supported": bool}.\n\n'
            f"Excerpt:\n{unit['text']}\n\nQuestion: {prompt}"
        )
    except Exception:
        return None, "cross-check unavailable"
    if not check.get("supported"):
        return None, "excerpt does not support it"
    second = str(check.get("answer", ""))
    if not is_correct(kind, answer, second) and not is_correct(kind, second, answer):
        return None, "independent re-solve disagreed"
    return {
        "id": db.new_id("q"), "prompt": prompt, "kind": kind, "options": options,
        "answer": answer, "topic_id": unit["topic_id"] or None, "unit_id": unit["id"],
        "difficulty": str(raw.get("difficulty") or "medium").lower(),
        "explanation": str(raw.get("explanation") or "Generated from the cited excerpt and "
                          "verified by an independent answer check."),
        "origin": "gemini", "verified": True,
    }, "ok"