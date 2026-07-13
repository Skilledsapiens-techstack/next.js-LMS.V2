from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "output/pdf/assets/skilled-sapiens-logo.png"
OUTPUT_DIR = ROOT / "output/pdf/cover-variations"

PAGE_WIDTH, PAGE_HEIGHT = A4

BRAND = colors.HexColor("#111111")
DEEP_BLUE = colors.HexColor("#15235A")
ACCENT = colors.HexColor("#DF312B")
ACCENT_SOFT = colors.HexColor("#FDE7E5")
GOLD = colors.HexColor("#FFD400")
GOLD_SOFT = colors.HexColor("#FFF4B8")
CANVAS = colors.HexColor("#EEF3FB")
SURFACE = colors.HexColor("#FFFFFF")
BORDER = colors.HexColor("#DDE3EC")
TEXT_MUTED = colors.HexColor("#55546A")


TITLE = "Scope of Work"
SUBTITLE = "Sales & Marketing Manager"
META_LEFT = "Role-wise Scope of Work"
META_RIGHT = "7 Projects"
TRACK = "Sales & Marketing | Digital Marketing | Product Marketing | Market Research"
WEBSITE = "www.skilledsapiens.com"


def draw_wrapped(c: canvas.Canvas, text: str, x: float, y: float, max_width: float, font: str, size: int, leading: float) -> float:
    c.setFont(font, size)
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if c.stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_logo_lockup(c: canvas.Canvas, x: float, y: float, logo_size: float = 20 * mm, dark: bool = True) -> None:
    c.drawImage(ImageReader(str(LOGO_PATH)), x, y - logo_size, width=logo_size, height=logo_size, mask="auto")
    c.setFillColor(BRAND if dark else SURFACE)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(x + logo_size + 8 * mm, y - 9 * mm, "Skilled Sapiens")
    c.setFillColor(TEXT_MUTED if dark else colors.HexColor("#F6F7FB"))
    c.setFont("Helvetica", 8.5)
    c.drawString(x + logo_size + 8 * mm, y - 15 * mm, "Get evolved with us")


def add_link(c: canvas.Canvas, x: float, y: float, width: float = 52 * mm, height: float = 8 * mm) -> None:
    c.linkURL("https://www.skilledsapiens.com", (x, y - 1.5 * mm, x + width, y + height), relative=0, thickness=0)


def variation_one(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setFillColor(CANVAS)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    c.setFillColor(SURFACE)
    c.roundRect(17 * mm, 17 * mm, PAGE_WIDTH - 34 * mm, PAGE_HEIGHT - 34 * mm, 10, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(17 * mm, PAGE_HEIGHT - 45 * mm, PAGE_WIDTH - 34 * mm, 5 * mm, fill=1, stroke=0)
    c.setFillColor(DEEP_BLUE)
    c.rect(17 * mm, 17 * mm, 5 * mm, PAGE_HEIGHT - 34 * mm, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(22 * mm, 17 * mm, PAGE_WIDTH - 39 * mm, 30 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD_SOFT)
    c.circle(PAGE_WIDTH - 44 * mm, PAGE_HEIGHT - 60 * mm, 30 * mm, fill=1, stroke=0)
    c.setFillColor(ACCENT_SOFT)
    c.circle(PAGE_WIDTH - 4 * mm, PAGE_HEIGHT - 28 * mm, 28 * mm, fill=1, stroke=0)

    draw_logo_lockup(c, 36 * mm, PAGE_HEIGHT - 55 * mm)

    x = 36 * mm
    y = PAGE_HEIGHT - 124 * mm
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(x, y, "Live Projects")
    y -= 16 * mm
    c.setFillColor(DEEP_BLUE)
    c.setFont("Helvetica-Bold", 34)
    c.drawString(x, y, TITLE)
    y -= 10 * mm
    c.setFillColor(BRAND)
    y = draw_wrapped(c, SUBTITLE, x, y, 130 * mm, "Helvetica-Bold", 18, 22)

    c.setStrokeColor(BORDER)
    c.roundRect(x, y - 28 * mm, 126 * mm, 19 * mm, 4, fill=0, stroke=1)
    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 7 * mm, y - 16 * mm, "DOCUMENT TYPE")
    c.drawString(x + 72 * mm, y - 16 * mm, "PROJECTS")
    c.setFillColor(BRAND)
    c.setFont("Helvetica", 10)
    c.drawString(x + 7 * mm, y - 22 * mm, META_LEFT)
    c.drawString(x + 72 * mm, y - 22 * mm, META_RIGHT)

    c.setFillColor(TEXT_MUTED)
    draw_wrapped(c, f"Track: {TRACK}", x, y - 40 * mm, 132 * mm, "Helvetica", 9, 12)
    c.setFillColor(SURFACE)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(36 * mm, 32 * mm, WEBSITE)
    add_link(c, 36 * mm, 32 * mm)
    c.save()


def variation_two(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setFillColor(SURFACE)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    c.setFillColor(CANVAS)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    c.setFillColor(SURFACE)
    c.roundRect(15 * mm, 16 * mm, PAGE_WIDTH - 30 * mm, PAGE_HEIGHT - 32 * mm, 8, fill=1, stroke=0)
    c.setFillColor(DEEP_BLUE)
    c.rect(15 * mm, 16 * mm, 62 * mm, PAGE_HEIGHT - 32 * mm, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(15 * mm, 16 * mm, PAGE_WIDTH - 30 * mm, 25 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(15 * mm, PAGE_HEIGHT - 47 * mm, 62 * mm, 5 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD_SOFT)
    c.circle(50 * mm, PAGE_HEIGHT - 118 * mm, 25 * mm, fill=1, stroke=0)
    c.setFillColor(ACCENT_SOFT)
    c.circle(PAGE_WIDTH - 35 * mm, 65 * mm, 24 * mm, fill=1, stroke=0)

    c.drawImage(ImageReader(str(LOGO_PATH)), 30 * mm, PAGE_HEIGHT - 65 * mm, width=20 * mm, height=20 * mm, mask="auto")
    c.setFillColor(SURFACE)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(30 * mm, PAGE_HEIGHT - 76 * mm, "Skilled Sapiens")
    c.setFillColor(colors.HexColor("#E6EAF5"))
    c.setFont("Helvetica", 8)
    c.drawString(30 * mm, PAGE_HEIGHT - 82 * mm, "Get evolved with us")

    x = 90 * mm
    y = PAGE_HEIGHT - 83 * mm
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, "LIVE PROJECTS")
    y -= 20 * mm
    c.setFillColor(DEEP_BLUE)
    c.setFont("Helvetica-Bold", 36)
    c.drawString(x, y, TITLE)
    y -= 12 * mm
    c.setFillColor(BRAND)
    y = draw_wrapped(c, SUBTITLE, x, y, 87 * mm, "Helvetica-Bold", 18, 23)

    c.setFillColor(SURFACE)
    c.setStrokeColor(BORDER)
    c.roundRect(x, y - 30 * mm, 82 * mm, 20 * mm, 4, fill=1, stroke=1)
    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 6 * mm, y - 18 * mm, "FORMAT")
    c.drawString(x + 48 * mm, y - 18 * mm, "COUNT")
    c.setFillColor(BRAND)
    c.setFont("Helvetica", 10)
    c.drawString(x + 6 * mm, y - 24 * mm, "Scope of Work")
    c.drawString(x + 48 * mm, y - 24 * mm, META_RIGHT)

    c.setFillColor(TEXT_MUTED)
    draw_wrapped(c, TRACK, x, y - 45 * mm, 87 * mm, "Helvetica", 9, 12)
    c.setFillColor(SURFACE)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(28 * mm, 31 * mm, WEBSITE)
    add_link(c, 28 * mm, 31 * mm)
    c.save()


def variation_three(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setFillColor(CANVAS)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    c.setFillColor(SURFACE)
    c.roundRect(18 * mm, 18 * mm, PAGE_WIDTH - 36 * mm, PAGE_HEIGHT - 36 * mm, 8, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(18 * mm, PAGE_HEIGHT - 46 * mm, PAGE_WIDTH - 36 * mm, 6 * mm, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(18 * mm, PAGE_HEIGHT - 46 * mm, 55 * mm, 6 * mm, fill=1, stroke=0)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.7)
    c.line(34 * mm, 70 * mm, PAGE_WIDTH - 34 * mm, 70 * mm)

    draw_logo_lockup(c, 34 * mm, PAGE_HEIGHT - 62 * mm, logo_size=19 * mm)

    x = 34 * mm
    y = PAGE_HEIGHT - 128 * mm
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x, y, "LIVE PROJECTS")
    y -= 14 * mm
    c.setFillColor(DEEP_BLUE)
    c.setFont("Helvetica-Bold", 38)
    c.drawString(x, y, TITLE)
    y -= 12 * mm
    c.setFillColor(BRAND)
    y = draw_wrapped(c, SUBTITLE, x, y, 135 * mm, "Helvetica-Bold", 19, 23)

    c.setFillColor(SURFACE)
    c.setStrokeColor(BORDER)
    c.roundRect(x, y - 38 * mm, 135 * mm, 28 * mm, 4, fill=0, stroke=1)
    c.setFillColor(GOLD_SOFT)
    c.rect(x, y - 19 * mm, 135 * mm, 9 * mm, fill=1, stroke=0)
    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 6 * mm, y - 16 * mm, "DOCUMENT")
    c.drawString(x + 78 * mm, y - 16 * mm, "PROJECT COUNT")
    c.setFillColor(BRAND)
    c.setFont("Helvetica", 10)
    c.drawString(x + 6 * mm, y - 28 * mm, META_LEFT)
    c.drawString(x + 78 * mm, y - 28 * mm, META_RIGHT)

    c.setFillColor(TEXT_MUTED)
    draw_wrapped(c, f"Track: {TRACK}", x, 56 * mm, 125 * mm, "Helvetica", 9, 12)
    c.setFillColor(DEEP_BLUE)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, 35 * mm, WEBSITE)
    add_link(c, x, 35 * mm)
    c.setFillColor(ACCENT)
    c.circle(PAGE_WIDTH - 39 * mm, 35 * mm, 6 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.circle(PAGE_WIDTH - 51 * mm, 35 * mm, 6 * mm, fill=1, stroke=0)
    c.save()


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    variation_one(OUTPUT_DIR / "cover-variation-1-executive-minimal.pdf")
    variation_two(OUTPUT_DIR / "cover-variation-2-bold-sidebar.pdf")
    variation_three(OUTPUT_DIR / "cover-variation-3-formal-document.pdf")


if __name__ == "__main__":
    main()
