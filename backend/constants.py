"""Layout, typography, and color constants for PDF generation."""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch

PAGE_MARGIN = 0.32 * inch
# ReportLab Frame default horizontal padding (must match platypus Frame defaults).
FRAME_H_PADDING = 6
CONTENT_WIDTH = letter[0] - 2 * PAGE_MARGIN - 2 * FRAME_H_PADDING
DATE_COL_MAX = 1.58 * inch
DATE_COL_RATIO = 0.22

# Bullet layout: glyph at BULLET_INDENT, text + wrapped lines at BULLET_TEXT_INDENT.
BULLET_INDENT = 6
BULLET_TEXT_INDENT = 12

NAME_FONT_SIZE = 20
CONTACT_FONT_SIZE = 8.5
SECTION_FONT_SIZE = 9.5
ENTRY_TITLE_FONT_SIZE = 9
BODY_FONT_SIZE = 9
BODY_LEADING = 11

HEADER_SPACER = 2
MAIN_RULE_AFTER = 2
SECTION_RULE_AFTER = 2
ENTRY_GAP = BODY_LEADING  # one blank line between roles
SECTION_END_GAP = 2
SECTION_SPACE_BEFORE = 5
SECTION_BREAK_HEADINGS = frozenset({"skills", "experience", "projects", "education"})
SECTION_BREAK_GAP = 8

PAGE_BREAK_BEFORE = ""

COLOR_TEXT = colors.HexColor("#1a1a1a")
COLOR_MUTED = colors.HexColor("#444444")
COLOR_RULE = colors.HexColor("#333333")
COLOR_ACCENT = colors.HexColor("#2563eb")


def column_widths(content_width: float) -> tuple[float, float]:
    """Return (title_col, date_col) widths that fit the frame."""
    date_col = min(DATE_COL_MAX, content_width * DATE_COL_RATIO)
    title_col = content_width - date_col
    return title_col, date_col
