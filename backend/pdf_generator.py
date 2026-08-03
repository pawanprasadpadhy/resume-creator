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

from constants import *
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _escape(text: str) -> str:
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline_md(
    text: str,
    *,
    accent: bool = False,
    blue_links: bool = False,
    link_underline: bool = True,
) -> str:
    """Escape XML special chars, then convert a small subset of inline
    markdown (**bold**, *italic*/_italic_, [links](url)) into ReportLab markup."""
    escaped = _escape(text)
    link_color = "#2563eb" if (accent or blue_links) else "#1a1a1a"
    link_open = "<u>" if link_underline else ""
    link_close = "</u>" if link_underline else ""
    escaped = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        rf'<a href="\2" color="{link_color}">{link_open}\1{link_close}</a>',
        escaped,
    )
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"(?<!\w)\*(.+?)\*(?!\w)", r"<i>\1</i>", escaped)
    escaped = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"<i>\1</i>", escaped)
    if accent:
        escaped = re.sub(
            r"<b>(.+?)</b>",
            r'<font color="#2563eb"><b>\1</b></font>',
            escaped,
        )
    return escaped


def _styles():
    return {
        "name": ParagraphStyle(
            "Name",
            fontName="Helvetica-Bold",
            fontSize=NAME_FONT_SIZE,
            leading=NAME_FONT_SIZE + 1.5,
            textColor=COLOR_TEXT,
            alignment=TA_CENTER,
            spaceAfter=1,
        ),
        "contact": ParagraphStyle(
            "Contact",
            fontName="Helvetica",
            fontSize=CONTACT_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_MUTED,
            alignment=TA_CENTER,
            spaceAfter=0,
        ),
        "section_heading": ParagraphStyle(
            "SectionHeading",
            fontName="Helvetica-Bold",
            fontSize=SECTION_FONT_SIZE,
            leading=SECTION_FONT_SIZE + 1.3,
            textColor=COLOR_TEXT,
            spaceBefore=SECTION_SPACE_BEFORE,
            spaceAfter=0,
            letterSpacing=0.6,
        ),
        "entry_title": ParagraphStyle(
            "EntryTitle",
            fontName="Helvetica-Bold",
            fontSize=ENTRY_TITLE_FONT_SIZE,
            leading=ENTRY_TITLE_FONT_SIZE + 1,
            textColor=COLOR_TEXT,
        ),
        "entry_title_accent": ParagraphStyle(
            "EntryTitleAccent",
            fontName="Helvetica-Bold",
            fontSize=ENTRY_TITLE_FONT_SIZE,
            leading=ENTRY_TITLE_FONT_SIZE + 1,
            textColor=COLOR_ACCENT,
        ),
        "entry_date": ParagraphStyle(
            "EntryDate",
            fontName="Helvetica",
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_MUTED,
            alignment=TA_RIGHT,
            wordWrap="LTR",
        ),
        "entry_date_link": ParagraphStyle(
            "EntryDateLink",
            fontName="Helvetica",
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_ACCENT,
            alignment=TA_RIGHT,
            wordWrap="LTR",
        ),
        "entry_subtitle": ParagraphStyle(
            "EntrySubtitle",
            fontName="Helvetica",
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_MUTED,
            spaceAfter=0,
        ),
        "entry_subtitle_accent": ParagraphStyle(
            "EntrySubtitleAccent",
            fontName="Helvetica",
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_ACCENT,
            spaceAfter=0,
        ),
        "bullet_glyph": ParagraphStyle(
            "BulletGlyph",
            fontName="Helvetica",
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_TEXT,
            alignment=TA_LEFT,
            leftIndent=0,
            spaceAfter=0,
        ),
        "bullet_text": ParagraphStyle(
            "BulletText",
            fontName="Helvetica",
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_TEXT,
            alignment=TA_JUSTIFY,
            leftIndent=0,
            spaceAfter=0,
        ),
        "bullet_text_accent": ParagraphStyle(
            "BulletTextAccent",
            fontName="Helvetica",
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_ACCENT,
            alignment=TA_JUSTIFY,
            leftIndent=0,
            spaceAfter=0,
        ),
        "body": ParagraphStyle(
            "Body",
            fontName="Helvetica",
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_TEXT,
            alignment=TA_JUSTIFY,
            spaceAfter=0,
        ),
        "list_item": ParagraphStyle(
            "ListItem",
            fontName="Helvetica",
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            textColor=COLOR_TEXT,
            alignment=TA_JUSTIFY,
            leftIndent=0,
            spaceAfter=0,
        ),
    }


def _align_table() -> list:
    return [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]


def _bullet_row(
    text: str,
    styles: dict,
    content_width: float,
    *,
    accent: bool = False,
) -> Table:
    text_w = content_width - BULLET_TEXT_INDENT
    text_style = styles["bullet_text_accent"] if accent else styles["bullet_text"]
    table = Table(
        [
            [
                Paragraph("&bull;", styles["bullet_glyph"]),
                Paragraph(_inline_md(text, accent=accent), text_style),
            ]
        ],
        colWidths=[BULLET_TEXT_INDENT, text_w],
        hAlign="LEFT",
    )
    table.setStyle(TableStyle(_align_table()))
    return table


def _parse_company_detail_line(text: str) -> dict | None:
    """Split '**Company | detail**' into company + right-aligned detail."""
    if not text:
        return None

    stripped = text.strip()
    if stripped.startswith("**") and stripped.endswith("**"):
        stripped = stripped[2:-2].strip()

    split_at = stripped.rfind(" | ")
    if split_at == -1:
        return None

    company = stripped[:split_at].strip()
    right = stripped[split_at + 3 :].strip()
    if not company or not right:
        return None

    return {"company": company, "right": right}


def _parse_company_date_line(text: str) -> dict | None:
    return _parse_company_detail_line(text)


def _date_paragraph(text: str, styles: dict, *, blue_links: bool = False):
    style_key = "entry_date_link" if blue_links else "entry_date"
    md = _inline_md(text, blue_links=blue_links, link_underline=False)
    if not blue_links:
        md = md.replace(", ", ",&nbsp;")
    return Paragraph(md, styles[style_key])


def _bullet_paragraph(
    text: str, styles: dict, content_width: float, *, accent: bool = False
) -> Table:
    return _bullet_row(text, styles, content_width, accent=accent)


def _two_column_table(left_para, right_para, content_width: float) -> Table:
    title_col, date_col = column_widths(content_width)
    table = Table(
        [[left_para, right_para]],
        colWidths=[title_col, date_col],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            _align_table()
            + [
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    return table


def _company_date_row(
    subtitle: str, styles: dict, content_width: float, *, accent: bool = False
) -> list | None:
    parsed = _parse_company_detail_line(subtitle)
    if not parsed:
        return None

    company_style = (
        styles["entry_subtitle_accent"] if accent else styles["entry_subtitle"]
    )
    company_para = Paragraph(
        _inline_md(parsed["company"], accent=accent), company_style
    )
    date_para = _date_paragraph(parsed["right"], styles)

    return [_two_column_table(company_para, date_para, content_width)]


def _company_date_bullet_row(
    bullet: str, styles: dict, content_width: float, *, accent: bool = False
) -> list | None:
    parsed = _parse_company_detail_line(bullet)
    if not parsed:
        return None

    _, date_col = column_widths(content_width)
    company_w = content_width - BULLET_TEXT_INDENT - date_col
    text_style = styles["bullet_text_accent"] if accent else styles["bullet_text"]
    table = Table(
        [
            [
                Paragraph("&bull;", styles["bullet_glyph"]),
                Paragraph(_inline_md(parsed["company"], accent=accent), text_style),
                _date_paragraph(parsed["right"], styles),
            ]
        ],
        colWidths=[BULLET_TEXT_INDENT, company_w, date_col],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            _align_table()
            + [
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("ALIGN", (1, 0), (1, 0), "LEFT"),
                ("ALIGN", (2, 0), (2, 0), "RIGHT"),
            ]
        )
    )
    return [table]


def _entry_header_row(
    entry: dict, styles: dict, content_width: float, *, accent_title: bool = False
):
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

    title_style = (
        styles["entry_title_accent"] if accent_title else styles["entry_title"]
    )
    title_para = Paragraph(_inline_md(title), title_style)
    date_para = _date_paragraph(dates, styles, blue_links=accent_title)

    flowables = [_two_column_table(title_para, date_para, content_width)]
    if middle:
        flowables.append(
            Paragraph(_inline_md(", ".join(middle)), styles["entry_subtitle"])
        )
    return flowables


def _content_width(doc: SimpleDocTemplate) -> float:
    """Usable line width inside the frame (excludes default frame padding)."""
    return doc.width - 2 * FRAME_H_PADDING


def _rule_flowable(
    content_width: float, *, thickness: float, space_after: float
) -> HRFlowable:
    return HRFlowable(
        width=content_width,
        thickness=thickness,
        color=COLOR_RULE,
        spaceAfter=space_after,
        hAlign="LEFT",
    )


def _list_item_paragraph(item: str, styles: dict, content_width: float):
    text_w = content_width - BULLET_TEXT_INDENT
    table = Table(
        [
            [
                Paragraph("&bull;", styles["bullet_glyph"]),
                Paragraph(_inline_md(item), styles["list_item"]),
            ]
        ],
        colWidths=[BULLET_TEXT_INDENT, text_w],
        hAlign="LEFT",
    )
    table.setStyle(TableStyle(_align_table()))
    return table


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
    content_width = _content_width(doc)

    if resume_data.get("name"):
        story.append(Paragraph(_escape(resume_data["name"]), styles["name"]))

    contact_lines = resume_data.get("contact_lines") or []
    if not contact_lines and resume_data.get("contact"):
        contact_lines = [resume_data["contact"]]
    if contact_lines:
        contact_html = "<br/>".join(
            _inline_md(line, blue_links=True) for line in contact_lines
        )
        story.append(Paragraph(contact_html, styles["contact"]))

    story.append(Spacer(1, HEADER_SPACER))
    story.append(
        _rule_flowable(content_width, thickness=0.8, space_after=MAIN_RULE_AFTER)
    )

    for section in resume_data.get("sections", []):
        if (
            PAGE_BREAK_BEFORE
            and (section.get("heading") or "").lower() == PAGE_BREAK_BEFORE.lower()
        ):
            story.append(PageBreak())

        heading = (section.get("heading") or "").upper()
        story.append(Paragraph(_escape(heading), styles["section_heading"]))
        story.append(
            _rule_flowable(content_width, thickness=0.5, space_after=SECTION_RULE_AFTER)
        )

        sec_type = section.get("type")

        if sec_type == "entries":
            heading_lower = (section.get("heading") or "").lower()
            accent_titles = heading_lower == "projects"
            accent_companies = heading_lower == "experience"
            subtitle_style_key = (
                "entry_subtitle_accent" if accent_companies else "entry_subtitle"
            )

            for i, entry in enumerate(section.get("entries", [])):
                story.extend(
                    _entry_header_row(
                        entry,
                        styles,
                        content_width,
                        accent_title=accent_titles,
                    )
                )
                for subtitle in entry.get("subtitles", []):
                    company_row = _company_date_row(
                        subtitle,
                        styles,
                        content_width,
                        accent=accent_companies,
                    )
                    if company_row:
                        story.extend(company_row)
                    else:
                        story.append(
                            Paragraph(
                                _inline_md(subtitle, accent=accent_companies),
                                styles[subtitle_style_key],
                            )
                        )
                for bullet in entry.get("bullets", []):
                    company_bullet = _company_date_bullet_row(
                        bullet,
                        styles,
                        content_width,
                        accent=accent_companies,
                    )
                    if company_bullet:
                        story.extend(company_bullet)
                    else:
                        story.append(_bullet_paragraph(bullet, styles, content_width))
                if i < len(section["entries"]) - 1:
                    story.append(Spacer(1, ENTRY_GAP))

        elif sec_type == "list":
            for item in section.get("items", []):
                story.append(_list_item_paragraph(item, styles, content_width))

        elif sec_type == "text":
            story.append(
                Paragraph(_inline_md(section.get("content", "")), styles["body"])
            )

        story.append(Spacer(1, SECTION_END_GAP))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
