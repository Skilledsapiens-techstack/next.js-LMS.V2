from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE_JSON = ROOT / "tmp/pdfs/project-role-source.json"
LOGO_PATH = ROOT / "output/pdf/assets/skilled-sapiens-logo.png"
OUTPUT_DIR = ROOT / "output/pdf/final-scope-of-work"

PAGE_WIDTH, PAGE_HEIGHT = A4

BRAND = colors.HexColor("#111111")
BRAND_STRONG = colors.HexColor("#000000")
ACCENT = colors.HexColor("#DF312B")
ACCENT_SOFT = colors.HexColor("#FDE7E5")
GOLD = colors.HexColor("#FFD400")
GOLD_SOFT = colors.HexColor("#FFF4B8")
CANVAS = colors.HexColor("#EEF3FB")
SURFACE = colors.HexColor("#FFFFFF")
SURFACE_MUTED = colors.HexColor("#F8FAFC")
BORDER = colors.HexColor("#DDE3EC")
TEXT_MUTED = colors.HexColor("#55546A")
TEXT_SOFT = colors.HexColor("#858399")
DEEP_BLUE = colors.HexColor("#15235A")

ABOUT_SKILLED_SAPIENS = [
    "Skilled Sapiens is a next-generation consulting firm specializing in Leadership Development, Talent Transformation, and Business Growth Solutions. We are committed to empowering students, working professionals, entrepreneurs, and organizations through a unique blend of Live Experiential Learning, Strategic Mentorship, and Business Consulting Services. Our ISO-certified methodologies focus on building real-world capabilities across functional domains including Sales & Marketing, Finance, Consulting, Product Management, Human Resources, and Entrepreneurship.",
    "At Skilled Sapiens, we combine deep industry insights with a highly personalized approach to deliver measurable career, business, and organizational outcomes. Our consulting philosophy is rooted in customized learning paths, intensive mentorship, and strategic interventions, ensuring that every individual and business we engage with is equipped for sustainable success.",
    "We currently operate across two major consulting verticals: Campus Connect Initiative and Business Connect Initiative.",
    "Under the educational consulting space, we focus on both Campus to Corporate and Corporate to Corporate consulting services. Our Campus to Corporate solutions prepare students and early-career professionals for corporate readiness through leadership training, experiential learning, profile building, and placement mentorship. We deliver end-to-end career consulting, from resume development and role-specific interview preparation to mock GD-PI sessions and off-campus placement support, ensuring a seamless transition from academia to industry.",
    "Through Corporate to Corporate consulting, we work with mid-level and senior professionals seeking strategic career transitions. We offer tailored career coaching, skill enhancement programs, resume and LinkedIn optimization, targeted job search assistance, and access to leadership networking opportunities. Our goal is to help corporate individuals navigate complex career transitions, accelerate growth, and secure high-impact roles in new domains or industries.",
    "The Business Connect Initiative at Skilled Sapiens extends our consulting expertise to entrepreneurs, startups, and growing businesses through two focused practices: DigiBrand and the Sapiens Incubation Centre.",
    "DigiBrand, our digital marketing and brand consulting division, empowers startups, brands, and enterprises to build powerful, scalable online presences. We provide end-to-end digital solutions, including branding and visual identity development, UI/UX website design, social media marketing, SEO, SEM, content strategy, email automation, performance analytics, UI/UX audits, and creation of corporate marketing collaterals such as pitch decks and brochures. At DigiBrand, we combine creativity with business strategy to drive digital growth and brand equity for our clients.",
    "The Sapiens Incubation Centre offers strategic consulting to entrepreneurs, helping them transform ideas into investable, scalable businesses. We assist startups with market research, investor pitch creation, fundraising strategy, prototype testing, business planning, legal compliance, lead generation, tax advisory, and personalized case-specific mentorship through our flagship Start-hub Mentorship Program. Our incubation consulting practice is designed to help early-stage ventures navigate the challenges of entrepreneurship and build sustainable, future-ready businesses.",
    "At Skilled Sapiens, we do not just train individuals or advise businesses - we partner with them on their journey to transformation. Our consulting engagements are outcome-driven, deeply collaborative, and tailored to the unique goals of each client, ensuring maximum impact across personal, professional, and business growth journeys.",
]

ABOUT_BULLETS = [
    ("Education Consulting Space", ["Campus to Corporate", "Corporate to Corporate"]),
    ("Business Consulting Space", ["DigiBrand", "Sapiens Incubation Centre"]),
]

PORTAL_BUCKETS = [
    (
        "Management Consulting Domain",
        ["Growth & Strategy Consultant", "Business Analyst"],
    ),
    (
        "Sales & Marketing Manager",
        ["Sales & Marketing Manager", "Digital Marketing Specialist", "Product Marketing Manager", "Market Research & Analytics"],
    ),
    (
        "Certified Product Manager | Product & Brand Management Role",
        ["Product & Brand Manager"],
    ),
    (
        "HR Manager | HR Roles",
        ["Employer Branding Manager", "HR Analytics Consultants", "Learning & Development Consultants", "Talent Acquisition Specialist"],
    ),
    (
        "Certified Equity Research & Fin Modeling Analyst",
        ["Equity Research & Financial Modeling Analyst"],
    ),
    (
        "Certified Private Equity & Venture Capital Analyst",
        ["Private Equity & Venture Capital Analyst"],
    ),
]


@dataclass
class HtmlNode:
    tag: str
    attrs: dict[str, str] = field(default_factory=dict)
    children: list["HtmlNode | str"] = field(default_factory=list)


class FragmentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = HtmlNode("root")
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in {"br", "hr"}:
            self.stack[-1].children.append(HtmlNode(tag, dict(attrs)))
            return
        node = HtmlNode(tag, {key: value or "" for key, value in attrs})
        self.stack[-1].children.append(node)
        self.stack.append(node)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        for idx in range(len(self.stack) - 1, 0, -1):
            if self.stack[idx].tag == tag:
                del self.stack[idx:]
                return

    def handle_data(self, data: str) -> None:
        if data:
            self.stack[-1].children.append(data)


class SectionCard(Flowable):
    def __init__(self, title: str, label: str, width: float = 170 * mm) -> None:
        super().__init__()
        self.title = title
        self.label = label
        self.width = width
        self.height = 20 * mm

    def draw(self) -> None:
        canvas = self.canv
        canvas.saveState()
        canvas.setFillColor(SURFACE)
        canvas.setStrokeColor(BORDER)
        canvas.roundRect(0, 0, self.width, self.height, 5, fill=1, stroke=1)
        canvas.setFillColor(GOLD)
        canvas.roundRect(0, self.height - 3 * mm, self.width, 3 * mm, 5, fill=1, stroke=0)
        canvas.setFillColor(ACCENT)
        canvas.setFont("Helvetica-Bold", 7)
        canvas.drawString(8 * mm, 12 * mm, self.label.upper())
        canvas.setFillColor(BRAND)
        canvas.setFont("Helvetica-Bold", 13)
        canvas.drawString(8 * mm, 6 * mm, self.title[:82])
        canvas.restoreState()


class CoverBlock(Flowable):
    def __init__(self, role_name: str, project_count: int, categories: list[str]) -> None:
        super().__init__()
        self.role_name = role_name
        self.project_count = project_count
        self.categories = categories
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
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.7)
        canvas.line(34 * mm, 70 * mm, PAGE_WIDTH - 34 * mm, 70 * mm)

        logo_size = 19 * mm
        canvas.drawImage(ImageReader(str(LOGO_PATH)), 34 * mm, PAGE_HEIGHT - 94 * mm, width=logo_size, height=logo_size, mask="auto")
        canvas.setFillColor(BRAND)
        canvas.setFont("Helvetica-Bold", 19)
        canvas.drawString(61 * mm, PAGE_HEIGHT - 81 * mm, "Skilled Sapiens")
        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont("Helvetica", 9)
        canvas.drawString(61 * mm, PAGE_HEIGHT - 88 * mm, "Get evolved with us")

        x = 34 * mm
        y = PAGE_HEIGHT - 128 * mm
        canvas.setFillColor(ACCENT)
        canvas.setFont("Helvetica-Bold", 13)
        canvas.drawString(x, y, "LIVE PROJECTS")
        y -= 14 * mm
        canvas.setFillColor(DEEP_BLUE)
        canvas.setFont("Helvetica-Bold", 38)
        canvas.drawString(x, y, "Scope of Work")
        y -= 12 * mm
        y = self._draw_wrapped(canvas, self.role_name, x, y, 135 * mm, "Helvetica-Bold", 19, 23, BRAND)

        meta_top = y - 10 * mm
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.7)
        canvas.roundRect(x, meta_top - 28 * mm, 135 * mm, 28 * mm, 4, fill=0, stroke=1)
        canvas.setFillColor(GOLD_SOFT)
        canvas.rect(x, meta_top - 9 * mm, 135 * mm, 9 * mm, fill=1, stroke=0)
        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.drawString(x + 6 * mm, meta_top - 6 * mm, "DOCUMENT")
        canvas.drawString(x + 78 * mm, meta_top - 6 * mm, "PROJECT COUNT")
        canvas.setFillColor(BRAND)
        canvas.setFont("Helvetica", 10)
        canvas.drawString(x + 6 * mm, meta_top - 20 * mm, "Role-wise Scope of Work")
        canvas.drawString(x + 78 * mm, meta_top - 20 * mm, f"{self.project_count} Project{'s' if self.project_count != 1 else ''}")

        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont("Helvetica", 9)
        track = " / ".join(self.categories) if self.categories else "Live Project"
        self._draw_wrapped(canvas, f"Track: {track}", x, 56 * mm, 125 * mm, "Helvetica", 9, 12, TEXT_MUTED)

        canvas.setFillColor(DEEP_BLUE)
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawString(x, 35 * mm, "www.skilledsapiens.com")
        canvas.linkURL("https://www.skilledsapiens.com", (x, 33 * mm, x + 52 * mm, 40 * mm), relative=0, thickness=0)
        canvas.setFillColor(GOLD)
        canvas.circle(PAGE_WIDTH - 51 * mm, 35 * mm, 6 * mm, fill=1, stroke=0)
        canvas.setFillColor(ACCENT)
        canvas.circle(PAGE_WIDTH - 39 * mm, 35 * mm, 6 * mm, fill=1, stroke=0)
        canvas.restoreState()


def slugify(value: str) -> str:
    value = value.lower().replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "role"


def fit_canvas_text(canvas, text: str, font_name: str, font_size: float, max_width: float) -> str:
    if canvas.stringWidth(text, font_name, font_size) <= max_width:
        return text
    ellipsis = "..."
    while text and canvas.stringWidth(text + ellipsis, font_name, font_size) > max_width:
        text = text[:-1]
    return text.rstrip() + ellipsis


def clean_inline(text: str) -> str:
    text = normalize_source_text(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_source_text(text: str | None) -> str:
    if not text:
        return ""
    replacements = {
        "\\n": "\n",
        "&nbsp;": " ",
        "\u00a0": " ",
        "\u2013": "-",
        "\u2014": "-",
        "\u2192": "->",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def inline_markup(node: HtmlNode | str) -> str:
    if isinstance(node, str):
        return escape(normalize_source_text(node))

    if node.tag == "br":
        return "<br/>"

    content = "".join(inline_markup(child) for child in node.children)
    if not content:
        return ""
    if node.tag in {"strong", "b"}:
        return f"<b>{content}</b>"
    if node.tag in {"em", "i"}:
        return f"<i>{content}</i>"
    if node.tag == "u":
        return f"<u>{content}</u>"
    return content


def node_text(node: HtmlNode | str) -> str:
    if isinstance(node, str):
        return clean_inline(node)
    return clean_inline(" ".join(node_text(child) for child in node.children))


def parse_html_blocks(html: str | None, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    if not html:
        return [Paragraph("Not specified.", styles["muted"])]

    html = normalize_source_text(html)
    parser = FragmentParser()
    parser.feed(html)
    flows: list[Flowable] = []

    def normalize_markup(markup: str) -> str:
        markup = re.sub(r"\s+", " ", markup)
        markup = re.sub(r"</b>\s*", "</b> ", markup)
        markup = re.sub(r"</i>\s*", "</i> ", markup)
        markup = re.sub(r"</u>\s*", "</u> ", markup)
        markup = re.sub(r"\s*<br/>\s*", "<br/>", markup)
        markup = re.sub(r"\s+([,.;:!?])", r"\1", markup)
        return markup.strip()

    def add_paragraph(markup: str, style_name: str = "body") -> None:
        markup = normalize_markup(markup)
        if markup:
            flows.append(Paragraph(markup, styles[style_name]))
            flows.append(Spacer(1, 2.5 * mm))

    def walk(children: Iterable[HtmlNode | str]) -> None:
        children_list = list(children)
        pending: list[str] = []

        def flush() -> None:
            if pending:
                add_paragraph(" ".join(pending))
                pending.clear()

        for idx, child in enumerate(children_list):
            if isinstance(child, str):
                text = inline_markup(child)
                if text:
                    pending.append(text)
                continue

            if child.tag in {"p", "div"}:
                flush()
                add_paragraph("".join(inline_markup(grandchild) for grandchild in child.children))
            elif child.tag in {"strong", "b"}:
                text = inline_markup(child)
                plain = node_text(child)
                next_child = children_list[idx + 1] if idx + 1 < len(children_list) else None
                next_plain = node_text(next_child) if next_child is not None else ""
                is_inline_fragment = bool(pending) or next_plain.startswith((",", ".", ":", ";", "!", "?"))
                if plain and len(plain) <= 120 and not is_inline_fragment:
                    flush()
                    add_paragraph(text, "subheading")
                else:
                    pending.append(text)
            elif child.tag in {"h1", "h2", "h3", "h4"}:
                flush()
                add_paragraph(inline_markup(child), "subheading")
            elif child.tag in {"ul", "ol"}:
                flush()
                numbered = child.tag == "ol"
                index = 1
                for item in [grandchild for grandchild in child.children if isinstance(grandchild, HtmlNode) and grandchild.tag == "li"]:
                    text = "".join(inline_markup(grandchild) for grandchild in item.children)
                    if text:
                        bullet = f"{index}." if numbered else "-"
                        flows.append(Paragraph(text, styles["bullet"], bulletText=bullet))
                        flows.append(Spacer(1, 1.8 * mm))
                        index += 1
            elif child.tag == "li":
                flush()
                text = "".join(inline_markup(grandchild) for grandchild in child.children)
                if text:
                    flows.append(Paragraph(text, styles["bullet"], bulletText="-"))
                    flows.append(Spacer(1, 1.8 * mm))
            elif child.tag == "br":
                pending.append("<br/>")
            else:
                text = inline_markup(child)
                if text:
                    pending.append(text)
        flush()

    walk(parser.root.children)
    return flows or [Paragraph("Not specified.", styles["muted"])]


def parse_content_field(raw: str | None, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    raw_original = (raw or "").strip()
    if not raw_original:
        return [Paragraph("Not specified.", styles["muted"])]

    try:
        parsed = json.loads(raw_original)
    except json.JSONDecodeError:
        return parse_html_blocks(normalize_source_text(raw_original), styles)

    if not isinstance(parsed, list):
        return parse_html_blocks(raw, styles)

    flows: list[Flowable] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        title = clean_inline(str(item.get("title") or ""))
        body = item.get("description") or item.get("note") or item.get("content") or ""
        body = normalize_source_text(str(body)).strip()
        if title and title.lower() not in {"project deliverables", "additional note"}:
            flows.append(Paragraph(escape(title), styles["subheading"]))
            flows.append(Spacer(1, 1.5 * mm))
        if body:
            flows.extend(parse_html_blocks(body, styles))
    return flows or [Paragraph("Not specified.", styles["muted"])]


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "eyebrow": ParagraphStyle(
            "Eyebrow",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=ACCENT,
            alignment=TA_LEFT,
            spaceAfter=3 * mm,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=27,
            leading=31,
            textColor=BRAND,
            alignment=TA_CENTER,
            spaceAfter=5 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=12,
            leading=17,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER,
            spaceAfter=6 * mm,
        ),
        "cover_eyebrow": ParagraphStyle(
            "CoverEyebrow",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=ACCENT,
            alignment=TA_CENTER,
            spaceAfter=3 * mm,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=BRAND,
            spaceAfter=5 * mm,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=BRAND,
            spaceBefore=2 * mm,
            spaceAfter=3 * mm,
        ),
        "subheading": ParagraphStyle(
            "Subheading",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=BRAND,
            spaceBefore=1 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.6,
            leading=14,
            textColor=BRAND,
            alignment=TA_JUSTIFY,
            spaceAfter=1.5 * mm,
        ),
        "table_body": ParagraphStyle(
            "TableBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.4,
            leading=13.5,
            textColor=BRAND,
            alignment=TA_LEFT,
            spaceAfter=0,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.4,
            leading=13.8,
            leftIndent=9 * mm,
            firstLineIndent=0,
            bulletIndent=1.5 * mm,
            textColor=BRAND,
            alignment=TA_JUSTIFY,
        ),
        "muted": ParagraphStyle(
            "Muted",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=TEXT_MUTED,
            alignment=TA_JUSTIFY,
        ),
        "label": ParagraphStyle(
            "Label",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=TEXT_MUTED,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=TEXT_SOFT,
        ),
    }


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
    font_name = "Helvetica"
    font_size = 8
    canvas.setFont(font_name, font_size)
    header_role = fit_canvas_text(canvas, doc.role_name, font_name, font_size, 67 * mm)
    canvas.drawRightString(PAGE_WIDTH - 22 * mm, PAGE_HEIGHT - 16.5 * mm, header_role)

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(22 * mm, 15 * mm, PAGE_WIDTH - 22 * mm, 15 * mm)
    canvas.setFillColor(TEXT_SOFT)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(22 * mm, 9.5 * mm, "Scope of Work")
    website = "www.skilledsapiens.com"
    website_x = PAGE_WIDTH / 2 - 19 * mm
    canvas.drawString(website_x, 9.5 * mm, website)
    canvas.linkURL(
        "https://www.skilledsapiens.com",
        (website_x, 8.5 * mm, website_x + 38 * mm, 12 * mm),
        relative=0,
        thickness=0,
    )
    canvas.drawRightString(PAGE_WIDTH - 22 * mm, 9.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def metadata_table(project: dict, styles: dict[str, ParagraphStyle], include_project_role: bool = False) -> Table:
    company = project.get("company_name") or "Skilled Sapiens"
    data = [
        [Paragraph("Company", styles["label"]), Paragraph(escape(company), styles["body"])],
        [Paragraph("Role Category", styles["label"]), Paragraph(escape(project.get("role_category") or "Not specified"), styles["body"])],
    ]
    if include_project_role:
        data.append(
            [
                Paragraph("Project Role", styles["label"]),
                Paragraph(escape(project.get("role_name") or "Not specified"), styles["body"]),
            ]
        )
    table = Table(data, colWidths=[38 * mm, 118 * mm], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE_MUTED),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def section(title: str, html: str | None, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    flows: list[Flowable] = [Paragraph(title, styles["h2"])]
    flows.extend(parse_content_field(html, styles))
    return flows


def role_summary_table(projects: list[dict], role_order: list[str], styles: dict[str, ParagraphStyle]) -> Table:
    counts = Counter(project.get("role_name") or "Live Project" for project in projects)
    rows = [
        [
            Paragraph("Role", styles["label"]),
            Paragraph("Projects", styles["label"]),
        ]
    ]
    for role in role_order:
        count = counts.get(role, 0)
        if count:
            rows.append(
                [
                    Paragraph(escape(role), styles["table_body"]),
                    Paragraph(f"{count} project{'s' if count != 1 else ''}", styles["table_body"]),
                ]
            )
    total = sum(counts.values())
    rows.append(
        [
            Paragraph("<b>Total</b>", styles["table_body"]),
            Paragraph(f"<b>{total} project{'s' if total != 1 else ''}</b>", styles["table_body"]),
        ]
    )
    table = Table(rows, colWidths=[118 * mm, 38 * mm], hAlign="LEFT", repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GOLD_SOFT),
                ("BACKGROUND", (0, 1), (-1, -2), SURFACE_MUTED),
                ("BACKGROUND", (0, -1), (-1, -1), ACCENT_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def index_table(projects: list[dict], styles: dict[str, ParagraphStyle]) -> Table:
    rows = [
        [
            Paragraph("S. No.", styles["label"]),
            Paragraph("Role", styles["label"]),
            Paragraph("Project Name", styles["label"]),
        ]
    ]
    for index, project in enumerate(projects, start=1):
        project_role = project.get("role_name") or "Live Project"
        rows.append(
            [
                Paragraph(str(index), styles["table_body"]),
                Paragraph(escape(project_role), styles["table_body"]),
                Paragraph(escape(project.get("title") or "Untitled Project"), styles["table_body"]),
            ]
        )

    table = Table(rows, colWidths=[18 * mm, 52 * mm, 86 * mm], hAlign="LEFT", repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GOLD_SOFT),
                ("TEXTCOLOR", (0, 0), (-1, 0), BRAND),
                ("BACKGROUND", (0, 1), (-1, -1), SURFACE_MUTED),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def about_skilled_sapiens(styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    flows: list[Flowable] = [
        SectionCard("About Skilled Sapiens", "Company Overview", width=156 * mm),
        Spacer(1, 5 * mm),
    ]
    for idx, paragraph in enumerate(ABOUT_SKILLED_SAPIENS):
        flows.append(Paragraph(escape(paragraph), styles["body"]))
        flows.append(Spacer(1, 2.2 * mm))
        if idx == 2:
            for heading, items in ABOUT_BULLETS:
                flows.append(Paragraph(escape(heading), styles["subheading"]))
                for item in items:
                    flows.append(Paragraph(escape(item), styles["bullet"], bulletText="-"))
                    flows.append(Spacer(1, 1.2 * mm))
                flows.append(Spacer(1, 1 * mm))
    return flows


def build_role_pdf(role_name: str, projects: list[dict], toolkit: list[dict], styles: dict[str, ParagraphStyle], role_order: list[str]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"skilled-sapiens-scope-of-work-{slugify(role_name)}.pdf"
    output_path = OUTPUT_DIR / filename

    doc = BaseDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=22 * mm,
        rightMargin=22 * mm,
        topMargin=24 * mm,
        bottomMargin=21 * mm,
    )
    doc.role_name = role_name
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    cover_frame = Frame(0, 0, PAGE_WIDTH, PAGE_HEIGHT, id="cover", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame]),
            PageTemplate(id="document", frames=[frame], onPage=draw_page),
        ]
    )

    categories = sorted({p.get("role_category") or "Live Project" for p in projects})
    project_count = len(projects)
    story: list[Flowable] = [CoverBlock(role_name, project_count, categories), NextPageTemplate("document")]
    story.append(PageBreak())

    story.append(SectionCard("Index", "Scope of Work", width=doc.width))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph(f"{project_count} project{'s' if project_count != 1 else ''} included in this role-wise scope of work document.", styles["muted"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Role Summary", styles["subheading"]))
    story.append(role_summary_table(projects, role_order, styles))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("Project Index", styles["subheading"]))
    story.append(index_table(projects, styles))
    story.append(PageBreak())

    story.extend(about_skilled_sapiens(styles))
    story.append(PageBreak())

    is_finance_document = any(category.strip().lower() == "finance" for category in categories)
    for item in toolkit:
        title = item.get("title") or ""
        if is_finance_document and "4-week framework" in title.lower():
            continue
        story.append(SectionCard(item["title"], "Project Toolkit", width=doc.width))
        story.append(Spacer(1, 5 * mm))
        if item.get("summary"):
            story.append(Paragraph(escape(item["summary"]), styles["muted"]))
            story.append(Spacer(1, 3 * mm))
        story.extend(parse_html_blocks(item.get("content"), styles))
        story.append(PageBreak())

    story.append(SectionCard("Project Details", role_name, width=doc.width))
    story.append(Spacer(1, 6 * mm))

    for index, project in enumerate(projects, start=1):
        if index > 1:
            story.append(PageBreak())
        story.append(Paragraph(f"Project {index}", styles["eyebrow"]))
        story.append(Paragraph(escape(project.get("title") or "Untitled Project"), styles["h1"]))
        story.append(metadata_table(project, styles, include_project_role=True))
        story.append(Spacer(1, 5 * mm))

        project_sections = [
            ("Project Brief", project.get("brief")),
            ("Objectives", project.get("objectives")),
            ("Action Items", project.get("action_items")),
            ("Deliverables", project.get("deliverables")),
        ]
        for title, html in project_sections:
            story.extend(section(title, html, styles))
            story.append(Spacer(1, 1.5 * mm))

    doc.build(story)
    return output_path


def main() -> None:
    source = json.loads(SOURCE_JSON.read_text())
    data = source["rows"][0]["data"]
    projects = data["projects"]
    toolkit = data["toolkit"]

    by_role: dict[str, list[dict]] = defaultdict(list)
    for project in projects:
        by_role[project.get("role_name") or project.get("role_id") or "Live Project"].append(project)

    buckets: list[tuple[str, list[str], list[dict]]] = []
    assigned_roles: set[str] = set()
    for bucket_name, role_order in PORTAL_BUCKETS:
        bucket_projects: list[dict] = []
        for role in role_order:
            role_projects = sorted(by_role.get(role, []), key=lambda p: p.get("title") or "")
            bucket_projects.extend(role_projects)
            if role_projects:
                assigned_roles.add(role)
        buckets.append((bucket_name, role_order, bucket_projects))

    missing_roles = sorted(set(by_role) - assigned_roles)
    if missing_roles:
        raise RuntimeError(f"Unmapped role(s): {', '.join(missing_roles)}")

    styles = make_styles()
    outputs = []
    for bucket_name, role_order, bucket_projects in buckets:
        outputs.append(build_role_pdf(bucket_name, bucket_projects, toolkit, styles, role_order))

    manifest = {
        "pdf_count": len(outputs),
        "project_count": len(projects),
        "roles": [
            {
                "role_name": bucket_name,
                "project_count": len(bucket_projects),
                "pdf": str((OUTPUT_DIR / f"skilled-sapiens-scope-of-work-{slugify(bucket_name)}.pdf").relative_to(ROOT)),
                "included_roles": [
                    {"role_name": role, "project_count": len(by_role.get(role, []))}
                    for role in role_order
                    if by_role.get(role)
                ],
            }
            for bucket_name, role_order, bucket_projects in buckets
        ],
    }
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
