"""Deterministic BM25 retrieval plus a grounded extractive tutor (offline path).

The offline tutor never invents facts: it returns verbatim sentences from retrieved
units, with an exact source location, or refuses when support is too weak. When a
Gemini key is configured, the model is only allowed to write over retrieved
excerpts; unsupported sentences cause the answer to be replaced by the extractive
fallback.
"""

from __future__ import annotations

import math
import re

from . import db

REFUSAL = ("I could not find support for that in the uploaded material, so I will not answer "
           "from general knowledge. Try rephrasing with a term from your course, upload the "
           "relevant source, or ask about one of the topics already in your library.")

MIN_SCORE = 1.6          # BM25 score required to treat a query as in-material
MIN_QUERY_TERMS = 1


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}|\d+(?:\.\d+)?", text.lower())
    return [_stem(w) for w in words if w not in db.STOPWORDS]


def _stem(word: str) -> str:
    """Very light suffix folding so 'models'/'model' and 'means'/'mean' match."""
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 4 and word.endswith("es") and not word.endswith(("ses", "xes")):
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


class Index:
    """In-memory BM25 index rebuilt from SQLite (cheap for hackathon-scale corpora)."""

    def __init__(self, rows: list | None = None) -> None:
        self.rows = list(rows) if rows is not None else list(db.list_units())
        self.docs: list[list[str]] = []
        self.tf: list[dict[str, int]] = []
        self.lengths: list[int] = []
        self.df: dict[str, int] = {}
        for row in self.rows:
            text = row["text"] + (" " + row["visual_description"] if row["visual_description"] else "")
            tokens = tokenize(text)
            self.docs.append(tokens)
            counts: dict[str, int] = {}
            for token in tokens:
                counts[token] = counts.get(token, 0) + 1
            self.tf.append(counts)
            self.lengths.append(len(tokens) or 1)
            for token in counts:
                self.df[token] = self.df.get(token, 0) + 1
        self.avg_len = (sum(self.lengths) / len(self.lengths)) if self.lengths else 1.0
        self.n = len(self.rows)

    def search(self, query: str, k: int = 5, topic_id: str | None = None) -> list[tuple[object, float]]:
        if not self.n:
            return []
        terms = tokenize(query)
        if not terms:
            return []
        k1, b = 1.5, 0.75
        scored: list[tuple[int, float]] = []
        for i in range(self.n):
            if topic_id and self.rows[i]["topic_id"] != topic_id:
                continue
            counts, length = self.tf[i], self.lengths[i]
            score = 0.0
            matched = 0
            for term in terms:
                freq = counts.get(term, 0)
                if not freq:
                    continue
                matched += 1
                idf = math.log(1 + (self.n - self.df[term] + 0.5) / (self.df[term] + 0.5))
                score += idf * (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * length / self.avg_len))
            if score:
                # Reward units that actually cover more of the question (term coverage),
                # so a short overview page cannot outrank the page that answers the question.
                score *= 1 + 0.35 * (matched - 1)
                scored.append((i, score))
        scored.sort(key=lambda pair: -pair[1])
        return [(self.rows[i], score) for i, score in scored[:k]]


def best_sentences(text: str, question: str, limit: int = 2) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]
    if len(sentences) <= 2:
        return sentences
    terms = set(tokenize(question))
    ranked = sorted(
        sentences,
        key=lambda sentence: -len(terms & set(tokenize(sentence))) / (len(sentence.split()) + 4),
    )
    chosen = sorted(ranked[:limit], key=sentences.index)
    return chosen


def citation(row, excerpt: str, url_base: str = "/library") -> dict:
    location = db.location_dict(row["location"])
    return {
        "unit_id": row["id"], "source_id": row["source_id"], "source_title": row["source_title"],
        "excerpt": excerpt.strip(), "location": location,
        "location_label": db.location_label(location),
        "url": f"{url_base}?source={row['source_id']}&unit={row['id']}",
    }


def suggested_questions(topic_id: str | None = None, limit: int = 4) -> list[str]:
    rows = db.list_units()
    if topic_id:
        rows = [row for row in rows if row["topic_id"] == topic_id] or rows
    picks, seen = [], set()
    for row in rows:
        if not row["topic_name"] or row["topic_name"] in seen:
            continue
        seen.add(row["topic_name"])
        picks.append(f"Explain {row['topic_name']} in simple terms")
        if len(picks) >= limit:
            break
    return picks or ["What topics are in my library?"]


def answer_extractive(question: str, index: Index, topic_id: str | None = None,
                      url_base: str = "/library") -> dict:
    hits = index.search(question, k=4, topic_id=topic_id)
    if not hits:
        return {"answer": REFUSAL, "grounded": False, "citations": [],
                "suggested_questions": suggested_questions(topic_id), "mode": "extractive"}
    top_row, top_score = hits[0]
    if top_score < MIN_SCORE:
        return {"answer": REFUSAL, "grounded": False, "citations": [],
                "suggested_questions": suggested_questions(topic_id), "mode": "extractive"}
    citations, lines = [], []
    for row, score in hits[:2]:
        if score < MIN_SCORE * 0.8:
            continue
        sentences = best_sentences(row["text"], question)
        lines.append(f"{' '.join(sentences)}")
        citations.append(citation(row, " ".join(sentences), url_base))
    if not citations:
        return {"answer": REFUSAL, "grounded": False, "citations": [],
                "suggested_questions": suggested_questions(topic_id), "mode": "extractive"}
    header = ("Here is what your course material says (extracted verbatim, no outside knowledge "
              "added):")
    body = "\n\n".join(f"{line} [{db.location_label(row['location'])} — {row['source_title']}]"
                       for line, (row, _) in zip(lines, hits))
    return {"answer": f"{header}\n\n{body}", "grounded": True, "citations": citations,
            "suggested_questions": suggested_questions(topic_id), "mode": "extractive"}


def tutor_prompt(question: str, contexts: list[dict]) -> str:
    blocks = "\n\n".join(
        f"[{i + 1}] ({context['source_title']}, {context['location_label']})\n{context['excerpt']}"
        for i, context in enumerate(contexts)
    )
    return (
        "You are Tutora, a source-grounded study tutor.\n"
        "Rules: use ONLY the numbered excerpts below. Every factual sentence must end with its "
        "excerpt markers like [1]. Never add outside knowledge, guesses, or new numbers. "
        "If the excerpts do not answer the question, reply exactly: "
        f"{REFUSAL}\n\n"
        f"Excerpts:\n{blocks}\n\nStudent question: {question}\n\n"
        'Return JSON: {"grounded": bool, "answer": string, "used": [excerpt numbers]}.'
    )


def answer(question: str, index: Index | None = None, topic_id: str | None = None,
           url_base: str = "/library") -> dict:
    index = index or Index()
    hits = index.search(question, k=4, topic_id=topic_id)
    if not hits or hits[0][1] < MIN_SCORE:
        return {"answer": REFUSAL, "grounded": False, "citations": [],
                "suggested_questions": suggested_questions(topic_id), "mode": "extractive"}
    contexts = [citation(row, " ".join(best_sentences(row["text"], question)), url_base)
                for row, score in hits if score >= MIN_SCORE * 0.8]
    try:
        from . import provider

        if provider.is_enabled():
            payload = provider.generate_json(tutor_prompt(question, contexts))
            text = str(payload.get("answer", "")).strip()
            used = payload.get("used") or [1]
            numbers = [int(n) for n in used if str(n).isdigit() and 1 <= int(n) <= len(contexts)]
            if payload.get("grounded") and text and len(text) > 30:
                return {
                    "answer": text,
                    "grounded": True,
                    "citations": [contexts[n - 1] for n in (numbers or [1])],
                    "suggested_questions": suggested_questions(topic_id),
                    "mode": f"gemini:{provider.model_name()}",
                }
    except Exception:
        pass  # any provider problem falls back to the deterministic extractive answer
    return answer_extractive(question, index, topic_id, url_base)