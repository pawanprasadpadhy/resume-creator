"""
resume_parser.py

Parses a constrained "resume markdown" format into a structured dict that
pdf_generator.py can render into an ATS-friendly PDF.

Expected format
---------------
# Full Name
contact line (free text, usually pipe-separated: email | phone | location | links)

## Section Heading          (e.g. Summary, Experience, Education, Skills, Projects, Certifications)
Plain paragraph text                       -> rendered as a "text" section
  OR
### Entry header | Company | Location | Dates   -> rendered as an "entries" section
- bullet
- bullet
  OR
- List item (used for Skills / Certifications / anything without ### subheadings)
                                            -> rendered as a "list" section

Any number of ## sections, in any order, are supported. Section "type" is
inferred automatically from its content (see _infer_section_type).
"""

import re


def parse_resume_markdown(markdown_text: str) -> dict:
    lines = markdown_text.replace("\r\n", "\n").split("\n")

    name = ""
    contact = ""
    sections = []

    current_section = None  # {"heading": str, "raw_lines": [...]}

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        if stripped.startswith("# ") and not stripped.startswith("##"):
            # Top-level heading -> resume name (first one wins; ignore stray extras)
            if not name:
                name = stripped[2:].strip()
            continue

        if stripped.startswith("## "):
            # Starting a new section
            if current_section is not None:
                sections.append(_finalize_section(current_section))
            current_section = {"heading": stripped[3:].strip(), "raw_lines": []}
            continue

        if current_section is None and not stripped.startswith("#"):
            # Lines between the name and the first "## " section are the contact line
            if stripped:
                if contact:
                    contact += " " + stripped
                else:
                    contact = stripped
            continue

        if current_section is not None:
            current_section["raw_lines"].append(line)

    if current_section is not None:
        sections.append(_finalize_section(current_section))

    return {"name": name, "contact": contact, "sections": sections}


def _finalize_section(section: dict) -> dict:
    heading = section["heading"]
    raw_lines = section["raw_lines"]

    entries = _extract_entries(raw_lines)
    if entries:
        return {"heading": heading, "type": "entries", "entries": entries}

    list_items = _extract_list_items(raw_lines)
    if list_items:
        return {"heading": heading, "type": "list", "items": list_items}

    # Fall back to plain paragraph text
    content = " ".join(l.strip() for l in raw_lines if l.strip())
    return {"heading": heading, "type": "text", "content": content}


def _extract_entries(raw_lines):
    """Sections containing '### ' subheadings become a list of entries,
    each with a parsed header (title/org/location/dates) and its bullets."""
    entries = []
    current = None

    for line in raw_lines:
        stripped = line.strip()
        if stripped.startswith("### "):
            if current is not None:
                entries.append(current)
            header_raw = stripped[4:].strip()
            current = {
                "header_raw": header_raw,
                "parts": [p.strip() for p in header_raw.split("|")],
                "bullets": [],
            }
        elif stripped.startswith("- ") or stripped.startswith("* "):
            if current is not None:
                current["bullets"].append(stripped[2:].strip())
        # ignore blank lines / stray text inside entries sections

    if current is not None:
        entries.append(current)

    return entries


def _extract_list_items(raw_lines):
    items = []
    for line in raw_lines:
        stripped = line.strip()
        if stripped.startswith("- ") or stripped.startswith("* "):
            items.append(stripped[2:].strip())
    return items


if __name__ == "__main__":
    import json
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else "sample_resume.md"
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    print(json.dumps(parse_resume_markdown(text), indent=2))
