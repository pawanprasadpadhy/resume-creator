"""
pdf_generator.py

Renders the structured dict produced by resume_parser.parse_resume_markdown()
into an ATS-friendly PDF using ReportLab (pure Python, no browser / LaTeX
dependency).

ATS-friendly design choices:
- Single column, standard reading order (top-to-bottom, left-to-right)
- Core (built-in) fonts: Helvetica family -- no embedded/custom fonts
- No images, text boxes, headers/footers, or multi-column layouts
- Section headers are plain bold text, not graphics
- Dates/company info kept as real selectable text (borderless 2-col table
  used only for visual alignment; reading order is still linear per row)
"""

import io
import re

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib import colors


PAGE_MARGIN = 0.55 * inch

COLOR_TEXT = colors.HexColor("#1a1a1a")
COLOR_MUTED = colors.HexColor("#444444")
COLOR_RULE = colors.HexColor("#333333")


def _escape(text: str) -> str:
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline_md(text: str) -> str:
    """Escape XML special chars, then convert a small subset of inline
    markdown (**bold**, *italic*/_italic_) into ReportLab paragraph markup."""
    escaped = _escape(text)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"(?<!\w)\*(.+?)\*(?!\w)", r"<i>\1</i>", escaped)
    escaped = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"<i>\1</i>", escaped)
    return escaped


def _styles():
    return {
        "name": ParagraphStyle(
            "Name", fontName="Helvetica-Bold", fontSize=21, leading=24,
            textColor=COLOR_TEXT, alignment=TA_CENTER, spaceAfter=4,
        ),
        "contact": ParagraphStyle(
            "Contact", fontName="Helvetica", fontSize=9.5, leading=13,
            textColor=COLOR_MUTED, alignment=TA_CENTER, spaceAfter=2,
        ),
        "section_heading": ParagraphStyle(
            "SectionHeading", fontName="Helvetica-Bold", fontSize=11.5,
            leading=14, textColor=COLOR_TEXT, spaceBefore=10, spaceAfter=2,
            letterSpacing=0.6,
        ),
        "entry_title": ParagraphStyle(
            "EntryTitle", fontName="Helvetica-Bold", fontSize=10.5,
            leading=13, textColor=COLOR_TEXT,
        ),
        "entry_date": ParagraphStyle(
            "EntryDate", fontName="Helvetica", fontSize=9.5, leading=13,
            textColor=COLOR_MUTED, alignment=TA_LEFT,
        ),
        "entry_subtitle": ParagraphStyle(
            "EntrySubtitle", fontName="Helvetica-Oblique", fontSize=9.5,
            leading=12.5, textColor=COLOR_MUTED, spaceAfter=2,
        ),
        "bullet": ParagraphStyle(
            "Bullet", fontName="Helvetica", fontSize=9.8, leading=13,
            textColor=COLOR_TEXT, leftIndent=14, bulletIndent=2,
            spaceAfter=1.5,
        ),
        "body": ParagraphStyle(
            "Body", fontName="Helvetica", fontSize=9.8, leading=13.5,
            textColor=COLOR_TEXT, spaceAfter=2,
        ),
        "list_item": ParagraphStyle(
            "ListItem", fontName="Helvetica", fontSize=9.8, leading=13,
            textColor=COLOR_TEXT, leftIndent=14, bulletIndent=2,
            spaceAfter=1.5,
        ),
    }


def _entry_header_row(entry: dict, styles: dict):
    parts = entry.get("parts") or [entry.get("header_raw", "")]
    parts = [p for p in parts if p != ""]

    if len(parts) >= 2:
        title = parts[0]
        dates = parts[-1]
        middle = parts[1:-1]
    else:
        title = parts[0] if parts else ""
        dates = ""
        middle = []

    title_para = Paragraph(_inline_md(title), styles["entry_title"])
    date_para = Paragraph(_inline_md(dates), styles["entry_date"])

    table = Table(
        [[title_para, date_para]],
        colWidths=[4.7 * inch, 1.85 * inch],
    )
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    flowables = [table]
    if middle:
        flowables.append(Paragraph(_inline_md(", ".join(middle)), styles["entry_subtitle"]))
    return flowables


def _list_item_paragraph(item: str, styles: dict):
    if ":" in item:
        label, rest = item.split(":", 1)
        text = f"<b>{_inline_md(label).strip()}:</b>{_inline_md(rest)}"
    else:
        text = _inline_md(item)
    return Paragraph(f"&bull;&nbsp;&nbsp;{text}", styles["list_item"])


def build_pdf(resume_data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=PAGE_MARGIN,
        rightMargin=PAGE_MARGIN,
        topMargin=PAGE_MARGIN,
        bottomMargin=PAGE_MARGIN,
        title=resume_data.get("name") or "Resume",
    )

    styles = _styles()
    story = []

    if resume_data.get("name"):
        story.append(Paragraph(_escape(resume_data["name"]), styles["name"]))
    if resume_data.get("contact"):
        story.append(Paragraph(_inline_md(resume_data["contact"]), styles["contact"]))

    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_RULE, spaceAfter=6))

    for section in resume_data.get("sections", []):
        heading = (section.get("heading") or "").upper()
        story.append(Paragraph(_escape(heading), styles["section_heading"]))
        story.append(HRFlowable(width="100%", thickness=0.6, color=COLOR_RULE, spaceAfter=5))

        sec_type = section.get("type")

        if sec_type == "entries":
            for i, entry in enumerate(section.get("entries", [])):
                story.extend(_entry_header_row(entry, styles))
                for bullet in entry.get("bullets", []):
                    story.append(Paragraph(f"&bull;&nbsp;&nbsp;{_inline_md(bullet)}", styles["bullet"]))
                if i < len(section["entries"]) - 1:
                    story.append(Spacer(1, 6))

        elif sec_type == "list":
            for item in section.get("items", []):
                story.append(_list_item_paragraph(item, styles))

        elif sec_type == "text":
            story.append(Paragraph(_inline_md(section.get("content", "")), styles["body"]))

        story.append(Spacer(1, 4))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
