from __future__ import annotations

import json
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

from generate_project_role_pdfs import (
    ACCENT,
    BORDER,
    BRAND,
    CANVAS,
    DEEP_BLUE,
    GOLD,
    GOLD_SOFT,
    LOGO_PATH,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    ROOT,
    SOURCE_JSON,
    SectionCard,
    SURFACE,
    TEXT_MUTED,
    TEXT_SOFT,
    make_styles,
    parse_html_blocks,
    slugify,
)


OUTPUT_DIR = ROOT / "output/pdf/final-scope-of-work"


class ToolkitCover(Flowable):
    def __init__(self, title: str, subtitle: str) -> None:
        super().__init__()
        self.title = title
        self.subtitle = subtitle
        self.width = PAGE_WIDTH
        self.height = PAGE_HEIGHT

    def _draw_wrapped(self, canvas, text: str, x: float, y: float, max_width: float, font: str, size: int, leading: float, color) -> float:
        canvas.setFillColor(color)
        canvas.setFont(font, size)
        words = text.split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if canvas.stringWidth(candidate, font, size) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        for line in lines:
            canvas.drawString(x, y, line)
            y -= leading
        return y

    def draw(self) -> None:
        canvas = self.canv
        canvas.saveState()
        canvas.setFillColor(CANVAS)
        canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
        canvas.setFillColor(SURFACE)
        canvas.roundRect(18 * mm, 18 * mm, PAGE_WIDTH - 36 * mm, PAGE_HEIGHT - 36 * mm, 8, fill=1, stroke=0)
        canvas.setFillColor(GOLD)
        canvas.rect(18 * mm, PAGE_HEIGHT - 46 * mm, PAGE_WIDTH - 36 * mm, 6 * mm, fill=1, stroke=0)
        canvas.setFillColor(ACCENT)
        canvas.rect(18 * mm, PAGE_HEIGHT - 46 * mm, 55 * mm, 6 * mm, fill=1, stroke=0)

        logo_size = 19 * mm
        canvas.drawImage(ImageReader(str(LOGO_PATH)), 34 * mm, PAGE_HEIGHT - 94 * mm, width=logo_size, height=logo_size, mask="auto")
        canvas.setFillColor(BRAND)
        canvas.setFont("Helvetica-Bold", 19)
        canvas.drawString(61 * mm, PAGE_HEIGHT - 81 * mm, "Skilled Sapiens")
        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont("Helvetica", 9)
        canvas.drawString(61 * mm, PAGE_HEIGHT - 88 * mm, "Get evolved with us")

        x = 34 * mm
        y = PAGE_HEIGHT - 132 * mm
        canvas.setFillColor(ACCENT)
        canvas.setFont("Helvetica-Bold", 13)
        canvas.drawString(x, y, "PROJECT TOOLKIT")
        y -= 14 * mm
        canvas.setFillColor(DEEP_BLUE)
        y = self._draw_wrapped(canvas, self.title, x, y, 135 * mm, "Helvetica-Bold", 32, 37, DEEP_BLUE)
        y -= 5 * mm
        canvas.setFillColor(BRAND)
        self._draw_wrapped(canvas, self.subtitle, x, y, 128 * mm, "Helvetica", 13, 17, BRAND)

        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.7)
        canvas.line(34 * mm, 70 * mm, PAGE_WIDTH - 34 * mm, 70 * mm)
        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont("Helvetica", 9)
        canvas.drawString(x, 56 * mm, "Standalone reference document for Live Project students")
        canvas.setFillColor(DEEP_BLUE)
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawString(x, 35 * mm, "www.skilledsapiens.com")
        canvas.linkURL("https://www.skilledsapiens.com", (x, 33 * mm, x + 52 * mm, 40 * mm), relative=0, thickness=0)
        canvas.setFillColor(GOLD)
        canvas.circle(PAGE_WIDTH - 51 * mm, 35 * mm, 6 * mm, fill=1, stroke=0)
        canvas.setFillColor(ACCENT)
        canvas.circle(PAGE_WIDTH - 39 * mm, 35 * mm, 6 * mm, fill=1, stroke=0)
        canvas.restoreState()


def draw_page(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(CANVAS)
    canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    canvas.setFillColor(SURFACE)
    canvas.roundRect(13 * mm, 12 * mm, PAGE_WIDTH - 26 * mm, PAGE_HEIGHT - 24 * mm, 8, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, PAGE_HEIGHT - 8 * mm, PAGE_WIDTH, 8 * mm, fill=1, stroke=0)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, PAGE_HEIGHT - 8 * mm, 52 * mm, 8 * mm, fill=1, stroke=0)
    logo_size = 8.5 * mm
    canvas.drawImage(ImageReader(str(LOGO_PATH)), 22 * mm, PAGE_HEIGHT - 20 * mm, width=logo_size, height=logo_size, mask="auto")
    canvas.setFillColor(BRAND)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(33 * mm, PAGE_HEIGHT - 16.5 * mm, "Skilled Sapiens")
    canvas.setFillColor(TEXT_SOFT)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(PAGE_WIDTH - 22 * mm, PAGE_HEIGHT - 16.5 * mm, doc.toolkit_title)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(22 * mm, 15 * mm, PAGE_WIDTH - 22 * mm, 15 * mm)
    canvas.setFillColor(TEXT_SOFT)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(22 * mm, 9.5 * mm, "Project Toolkit")
    website = "www.skilledsapiens.com"
    website_x = PAGE_WIDTH / 2 - 19 * mm
    canvas.drawString(website_x, 9.5 * mm, website)
    canvas.linkURL("https://www.skilledsapiens.com", (website_x, 8.5 * mm, website_x + 38 * mm, 12 * mm), relative=0, thickness=0)
    canvas.drawRightString(PAGE_WIDTH - 22 * mm, 9.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf(item: dict, styles: dict) -> Path:
    title = item["title"]
    output_path = OUTPUT_DIR / f"skilled-sapiens-{slugify(title)}.pdf"
    doc = BaseDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=22 * mm,
        rightMargin=22 * mm,
        topMargin=24 * mm,
        bottomMargin=21 * mm,
    )
    doc.toolkit_title = title
    cover_frame = Frame(0, 0, PAGE_WIDTH, PAGE_HEIGHT, id="cover", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame]),
            PageTemplate(id="document", frames=[frame], onPage=draw_page),
        ]
    )

    story = [
        ToolkitCover(title, item.get("summary") or "Project toolkit reference"),
        NextPageTemplate("document"),
        PageBreak(),
        SectionCard(title, "Project Toolkit", width=doc.width),
        Spacer(1, 5 * mm),
    ]
    if item.get("summary"):
        story.append(Paragraph(escape(item["summary"]), styles["muted"]))
        story.append(Spacer(1, 4 * mm))
    story.extend(parse_html_blocks(item.get("content"), styles))
    doc.build(story)
    return output_path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    data = json.loads(SOURCE_JSON.read_text())["rows"][0]["data"]
    toolkit = {item["title"]: item for item in data["toolkit"]}
    styles = make_styles()
    outputs = [
        build_pdf(toolkit["Live Project Guidelines"], styles),
        build_pdf(toolkit["How to Start your Project (4-week Framework)"], styles),
    ]
    print(json.dumps({"pdf_count": len(outputs), "pdfs": [str(path.relative_to(ROOT)) for path in outputs]}, indent=2))


if __name__ == "__main__":
    main()
