"""Team-built test set: in-material questions with known source locations, plus
off-material queries. Locations are derived from backend.sample so the ground truth
can never drift from the seeded course."""

from __future__ import annotations

from backend.sample import TEXTS, TOPICS

# The seeded sample course stores TEXTS[i] on slide i + 2 (slide 1 is the orientation unit).
SLIDE_OFFSET = 2

# (question, topic slug) — each expects an answer grounded in that topic's slide.
IN_MATERIAL: list[tuple[str, str]] = [
    ("What is the difference between classification and regression?", "supervised"),
    ("What does generalization mean for a supervised model?", "supervised"),
    ("How is the prediction of simple linear regression computed?", "regression"),
    ("How do I compute mean squared error?", "regression"),
    ("Why does mean squared error penalize large errors?", "regression"),
    ("How does gradient descent update a parameter?", "gradient"),
    ("What does the learning rate control?", "gradient"),
    ("What happens if the learning rate is too large?", "gradient"),
    ("What is a typical sign of overfitting?", "overfitting"),
    ("How does L2 regularization change the training loss?", "overfitting"),
    ("What can excessive regularization cause?", "overfitting"),
    ("Why should hyperparameters be chosen on a validation set?", "evaluation"),
    ("How do I compute precision and recall?", "evaluation"),
    ("What is data leakage?", "evaluation"),
    ("Why are nonlinear activation functions needed in a neural network?", "neural"),
    ("What is ReLU of a negative number?", "neural"),
    ("What does backpropagation compute?", "neural"),
]

# Queries the material does not cover: the tutor must decline instead of answering.
OFF_MATERIAL: list[str] = [
    "Who won the 2022 football World Cup?",
    "Explain the political history of France in the nineteenth century.",
    "What is the capital of Australia?",
    "Give me a sourdough bread recipe with exact oven temperatures.",
    "How do I file my income tax return in India?",
    "What is the plot of the film Inception?",
    "Which vitamin prevents scurvy?",
    "How do I tune a guitar to open G?",
]


def topic_slug_to_slide() -> dict[str, int]:
    return {slug: index + SLIDE_OFFSET for index, (slug, *_rest) in enumerate(TOPICS)}


def in_material_cases() -> list[dict]:
    slides = topic_slug_to_slide()
    return [
        {"question": question, "topic_slug": slug, "expected_slide": slides[slug]}
        for question, slug in IN_MATERIAL
    ]


def expected_slide_text(slug: str) -> str:
    index = [item[0] for item in TOPICS].index(slug)
    return TEXTS[index]