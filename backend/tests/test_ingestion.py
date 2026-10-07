"""Offline extraction tests: no network and no Gemini key are used."""

from pathlib import Path

import pytest

from backend import ingestion


def test_text_file_units_have_no_invented_locations(tmp_path: Path):
    path = tmp_path / "notes.txt"
    path.write_text("Gradient descent reduces loss.\n\nLearning rate controls step size.\n")
    units = ingestion.extract_file(path, "notes.txt")
    assert [unit["text"] for unit in units] == [
        "Gradient descent reduces loss.", "Learning rate controls step size.",
    ]
    assert all(unit["location"] == {} for unit in units)


def test_pdf_pages_keep_page_numbers(tmp_path: Path):
    pymupdf = pytest.importorskip("pymupdf")
    path = tmp_path / "slides.pdf"
    document = pymupdf.open()
    for text in ("Linear regression minimizes squared error.", "Regularization penalizes large weights."):
        page = document.new_page()
        page.insert_text((72, 72), text)
    document.save(path)
    units = ingestion.extract_file(path, "slides.pdf")
    assert [unit["location"]["page"] for unit in units] == [1, 2]
    assert "squared error" in units[0]["text"]


def test_pptx_slides_keep_slide_numbers(tmp_path: Path):
    pptx = pytest.importorskip("pptx")
    path = tmp_path / "deck.pptx"
    presentation = pptx.Presentation()
    for title in ("Gradient Descent", "Model Evaluation"):
        slide = presentation.slides.add_slide(presentation.slide_layouts[5])
        slide.shapes.title.text = title
    presentation.save(path)
    units = ingestion.extract_file(path, "deck.pptx")
    assert [unit["location"]["slide"] for unit in units] == [1, 2]


def test_image_without_api_key_gives_actionable_error(tmp_path: Path):
    path = tmp_path / "figure.png"
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"0" * 32)
    with pytest.raises(ValueError) as error:
        ingestion.extract_file(path, "figure.png")
    assert "GEMINI_API_KEY" in str(error.value)


def test_extension_mismatch_is_rejected(tmp_path: Path):
    path = tmp_path / "fake.pdf"
    path.write_text("this is not a pdf")
    with pytest.raises(ValueError) as error:
        ingestion.extract_file(path, "fake.pdf")
    assert "do not match" in str(error.value)


def test_empty_file_is_rejected(tmp_path: Path):
    path = tmp_path / "empty.txt"
    path.write_text("")
    with pytest.raises(ValueError) as error:
        ingestion.extract_file(path, "empty.txt")
    assert "empty" in str(error.value).lower()


def test_unsupported_extension_is_rejected(tmp_path: Path):
    path = tmp_path / "notes.exe"
    path.write_bytes(b"MZ")
    with pytest.raises(ValueError) as error:
        ingestion.extract_file(path, "notes.exe")
    assert "Unsupported file type" in str(error.value)