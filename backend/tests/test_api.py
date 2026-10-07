import json

from backend import db, learning, quiz


def test_dashboard_seeds_sample_course(client):
    body = client.get("/api/dashboard").json()
    assert body["stats"]["sources"] == 1
    assert body["stats"]["units"] == 7
    assert body["stats"]["topics"] == 7
    assert len(body["topics"]) == 7
    assert body["provider"]["enabled"] is False
    assert "never treated as evidence" in body["disclaimer"]


def test_grounded_chat_cites_exact_slide(client):
    body = client.post("/api/chat", json={"message": "How do I compute mean squared error?"}).json()
    assert body["grounded"] is True
    assert body["citations"], "a grounded answer must cite its source"
    citation = body["citations"][0]
    assert citation["location"]["slide"] == 3
    assert citation["url"].startswith("/library?source=")
    assert "MSE" in citation["excerpt"] or "mean squared error" in citation["excerpt"].lower()
    assert "2" in citation["excerpt"]


def test_off_material_query_is_declined(client):
    body = client.post("/api/chat", json={"message": "Explain the political history of France"}).json()
    assert body["grounded"] is False
    assert body["citations"] == []
    assert "could not find support" in body["answer"]


def test_assessment_questions_are_tagged_and_answers_hidden(client):
    body = client.post("/api/assessments", json={"topic_ids": [], "count": 4, "kind": "mixed"}).json()
    assert len(body["questions"]) == 4
    for question in body["questions"]:
        assert question["topic_name"]
        assert question["difficulty"] in {"easy", "medium", "hard"}
        assert question["source"]["location"]
        assert "answer" not in question
        if question["kind"] == "mcq":
            assert len(question["options"]) >= 3


def test_questions_do_not_repeat_across_assessments(client):
    first = client.post("/api/assessments", json={"count": 5, "kind": "mcq"}).json()
    second = client.post("/api/assessments", json={"count": 5, "kind": "mcq"}).json()
    first_prompts = {question["prompt"] for question in first["questions"]}
    second_prompts = {question["prompt"] for question in second["questions"]}
    assert not first_prompts & second_prompts, "questions repeated across assessments"
    assert len(second_prompts) == len(second["questions"])


def test_submission_grades_updates_mastery_and_is_idempotent(client):
    topics = client.get("/api/topics").json()
    regression = next(topic for topic in topics if topic["name"] == "Linear Regression")
    created = client.post("/api/assessments",
                          json={"topic_ids": [regression["id"]], "count": 3}).json()
    keys = {}
    for question in created["questions"]:
        keys[question["id"]] = "wrong on purpose"

    report = client.post(f"/api/assessments/{created['id']}/submit", json={"answers": keys}).json()
    assert report["total"] == len(created["questions"])
    assert report["score"] == 0.0
    assert report["feedback"][0]["expected_answer"]
    assert report["feedback"][0]["citation"]["source_title"]
    change = next(item for item in report["mastery_changes"] if item["topic_id"] == regression["id"])
    assert change["after"] < change["before"], "wrong answers must lower the mastery estimate"
    assert report["misconceptions"], "missed questions must produce misconception notes"

    again = client.post(f"/api/assessments/{created['id']}/submit", json={"answers": keys}).json()
    assert again["score"] == report["score"]
    assert again["mastery_changes"][0]["evidence"] == 0, "double submission must not double-count"
    after = next(topic for topic in client.get("/api/topics").json() if topic["id"] == regression["id"])
    assert after["evidence_count"] == change["evidence"]


def test_correct_answers_raise_mastery(client):
    topics = {topic["name"]: topic for topic in client.get("/api/topics").json()}
    topic = topics["Gradient Descent"]
    created = client.post("/api/assessments",
                          json={"topic_ids": [topic["id"]], "count": 1}).json()
    question = created["questions"][0]
    expected = next(
        row["answer"] for row in db.assessment_questions(created["id"]) if row["id"] == question["id"]
    )
    report = client.post(f"/api/assessments/{created['id']}/submit",
                         json={"answers": {question["id"]: expected}}).json()
    assert report["score"] == 1.0
    change = report["mastery_changes"][0]
    assert change["after"] > change["before"]


def test_short_answer_and_numeric_grading_tolerances():
    assert quiz.is_correct("numerical", "3.8", "3.80") is True
    assert quiz.is_correct("numerical", "0.8", "80%") is False
    assert quiz.is_correct("short", "data leakage", "It is data leakage.") is True
    assert quiz.is_correct("mcq", "Underfitting", "underfitting") is True
    assert quiz.is_correct("mcq", "Underfitting", "Overfitting") is False
    assert quiz.is_correct("short", "L2", "") is False


def test_pasted_text_source_is_ingested_and_tagged(client):
    text = ("Gradient clipping rescales gradients whose norm exceeds a threshold before each "
            "parameter update. This prevents unstable gradient steps.\n\n"
            "Weight decay is a regularization technique that shrinks weights toward zero each "
            "update, reducing model complexity.")
    created = client.post("/api/sources/text",
                          json={"title": "Optimization stability notes", "text": text}).json()
    assert created["status"] == "ready"
    assert created["unit_count"] == 2
    detail = client.get(f"/api/sources/{created['id']}").json()
    assert detail["units"][0]["location"]["label"] == "paragraph 1"
    tagged = {unit["topic_name"] for unit in detail["units"]}
    assert tagged - {None}, "units must be tagged to a topic"


def test_upload_rejects_unsupported_type(client):
    response = client.post("/api/sources/upload",
                           files={"file": ("notes.exe", b"MZ", "application/octet-stream")})
    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_txt_file_end_to_end(client):
    payload = (b"Neural networks use backpropagation to compute gradients.\n\n"
               b"Backpropagation applies the chain rule through each layer.")
    response = client.post("/api/sources/upload", files={"file": ("notes.txt", payload, "text/plain")})
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "text"
    assert body["unit_count"] == 2
    chat = client.post("/api/chat", json={"message": "What does backpropagation apply?"}).json()
    assert chat["grounded"] is True
    titles = {citation["source_title"] for citation in chat["citations"]}
    assert titles & {"notes"}


def test_mastery_update_is_bounded_and_rewards_correct_answers():
    low = 0.2
    assert 0.0 < learning.update_mastery(low, False) < 1.0
    assert learning.update_mastery(0.95, True) > learning.update_mastery(0.95, False)
    assert learning.update_mastery(0.0, True) <= 0.99


def test_empty_scope_reports_reason_instead_of_crashing(client):
    response = client.post("/api/assessments", json={"topic_ids": ["does-not-exist"], "count": 3})
    assert response.status_code == 409
    assert "verified" in response.json()["detail"].lower()