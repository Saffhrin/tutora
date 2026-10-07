"""Generate original demo material for the ingestion demo (PPTX, PDF, figure, transcript).

Run: python -m scripts.make_demo_assets  ->  writes into demo_assets/
"""

from __future__ import annotations

from pathlib import Path

from backend.sample import TEXTS, TOPICS

OUT = Path("demo_assets")


def slides() -> None:
    from pptx import Presentation
    from pptx.util import Inches, Pt

    presentation = Presentation()
    title = presentation.slides.add_slide(presentation.slide_layouts[0])
    title.shapes.title.text = "Introduction to Machine Learning"
    title.placeholders[1].text = "Tutora demo deck · original CC0 content"
    for index, (slug, name, description, _prerequisites) in enumerate(TOPICS):
        slide = presentation.slides.add_slide(presentation.slide_layouts[5])
        slide.shapes.title.text = name
        box = slide.shapes.add_textbox(Inches(0.7), Inches(1.8), Inches(8.5), Inches(3.4))
        frame = box.text_frame
        frame.word_wrap = True
        frame.text = description
        paragraph = frame.add_paragraph()
        paragraph.text = TEXTS[index]
        paragraph.font.size = Pt(12)
        notes = slide.notes_slide.notes_text_frame
        notes.text = f"Prerequisites and context for {name}. Ask students to recall the formula."
    presentation.save(OUT / "lecture_slides.pptx")


def pdf() -> None:
    import pymupdf

    document = pymupdf.open()
    for index, (_slug, name, _description, _prerequisites) in enumerate(TOPICS):
        page = document.new_page()
        page.insert_text((56, 72), name, fontsize=18)
        y = 110
        for line in _wrap(TEXTS[index], 88):
            page.insert_text((56, y), line, fontsize=11)
            y += 16
        # A small diagram so the figure-understanding path has something to read.
        page.draw_rect(pymupdf.Rect(56, y + 16, 260, y + 120), color=(0.1, 0.3, 0.25), width=1.2)
        page.insert_text((70, y + 50), f"Figure {index + 1}: {name}", fontsize=10)
        page.insert_text((70, y + 70), "loss", fontsize=9)
        page.insert_text((200, y + 100), "parameters", fontsize=9)
    document.save(OUT / "textbook_chapter.pdf")


def figure() -> None:
    import pymupdf

    page = pymupdf.open().new_page(width=520, height=340)
    page.insert_text((40, 44), "Training vs validation error", fontsize=15)
    page.draw_line(pymupdf.Point(60, 280), pymupdf.Point(470, 280), width=1.2)
    page.draw_line(pymupdf.Point(60, 280), pymupdf.Point(60, 80), width=1.2)
    page.insert_text((40, 300), "model complexity", fontsize=9)
    page.insert_text((70, 74), "error", fontsize=9)
    for start, end in (((70, 240), (200, 140)), ((200, 140), (300, 150)), ((300, 150), (450, 250))):
        page.draw_line(pymupdf.Point(*start), pymupdf.Point(*end), width=1.6)
    page.insert_text((250, 130), "validation", fontsize=9)
    page.draw_line(pymupdf.Point(70, 200), pymupdf.Point(450, 100), width=1.6)
    page.insert_text((380, 96), "training", fontsize=9)
    page.get_pixmap().save(str(OUT / "validation_curve.png"))


def transcript() -> None:
    lines = [
        "00:00 Welcome to the Tutora demo lecture on gradient descent.",
        "00:35 Gradient descent updates a parameter by subtracting the learning rate times the gradient.",
        "01:20 A learning rate that is too large can make training oscillate or diverge.",
        "02:05 Backpropagation computes gradients with the chain rule, layer by layer.",
    ]
    (OUT / "lecture_transcript.txt").write_text("\n\n".join(lines))


def _wrap(text: str, width: int) -> list[str]:
    words, lines, current = text.split(), [], ""
    for word in words:
        if len(current) + len(word) + 1 > width:
            lines.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()
    if current:
        lines.append(current)
    return lines


def main() -> None:
    OUT.mkdir(exist_ok=True)
    slides()
    pdf()
    figure()
    transcript()
    for path in sorted(OUT.iterdir()):
        print(f"{path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()