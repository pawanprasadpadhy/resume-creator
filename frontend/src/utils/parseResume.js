// Mirrors backend/resume_parser.py so the live preview matches the PDF output.
// Keep this in sync with the Python parser if you change the markdown format.

// On its own line, starts a new PDF page before the next bullet, ### entry or ## section.
export const PAGE_BREAK_MARKER = "<!-- pagebreak -->";

// A marker that is the last non-blank line of a section belongs to the next
// ## section, not to an entry.
function popTrailingPageBreak(rawLines) {
	while (rawLines.length && !rawLines[rawLines.length - 1].trim()) {
		rawLines.pop();
	}
	if (
		rawLines.length &&
		rawLines[rawLines.length - 1].trim() === PAGE_BREAK_MARKER
	) {
		rawLines.pop();
		return true;
	}
	return false;
}

export function parseResumeMarkdown(markdownText) {
	const lines = (markdownText || "").replace(/\r\n/g, "\n").split("\n");

	let name = "";
	const contactLines = [];
	const sections = [];
	let current = null; // { heading, rawLines: [], pageBreakBefore }
	let pendingPageBreak = false; // marker seen right before the next "## "

	const finalizeSection = (section) => {
		const { heading, rawLines } = section;
		const base = { heading, pageBreakBefore: !!section.pageBreakBefore };
		const entries = extractEntries(rawLines);
		if (entries.length) {
			return { ...base, type: "entries", entries };
		}
		const { items: listItems, breaks: itemBreaks } = extractListItems(rawLines);
		if (listItems.length) {
			return { ...base, type: "list", items: listItems, pageBreakBeforeItems: itemBreaks };
		}
		const content = rawLines
			.map((l) => l.trim())
			.filter((l) => l && l !== PAGE_BREAK_MARKER)
			.join(" ");
		return { ...base, type: "text", content };
	};

	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+$/, "");
		const stripped = line.trim();

		if (stripped.startsWith("# ") && !stripped.startsWith("##")) {
			if (!name) name = stripped.slice(2).trim();
			continue;
		}

		if (stripped.startsWith("## ")) {
			if (current !== null) {
				pendingPageBreak = popTrailingPageBreak(current.rawLines);
				sections.push(finalizeSection(current));
			}
			current = {
				heading: stripped.slice(3).trim(),
				rawLines: [],
				pageBreakBefore: pendingPageBreak,
			};
			pendingPageBreak = false;
			continue;
		}

		if (stripped === PAGE_BREAK_MARKER && current === null) {
			pendingPageBreak = true;
			continue;
		}

		if (current === null && !stripped.startsWith("#")) {
			if (stripped) contactLines.push(stripped);
			continue;
		}

		if (current !== null) {
			current.rawLines.push(line);
		}
	}

	if (current !== null) sections.push(finalizeSection(current));

	return {
		name,
		contact: contactLines.join(" "),
		contactLines,
		sections,
	};
}

function extractEntries(rawLines) {
	const entries = [];
	let cur = null;
	let pendingPageBreak = false;

	for (const line of rawLines) {
		const stripped = line.trim();
		if (stripped === PAGE_BREAK_MARKER) {
			pendingPageBreak = true;
		} else if (stripped.startsWith("### ")) {
			if (cur !== null) entries.push(cur);
			const headerRaw = stripped.slice(4).trim();
			cur = {
				headerRaw,
				parts: headerRaw.split("|").map((p) => p.trim()),
				subtitles: [],
				bullets: [],
				pageBreakBefore: pendingPageBreak,
				pageBreakBeforeBullets: [],
			};
			pendingPageBreak = false;
		} else if (stripped.startsWith("- ") || stripped.startsWith("* ")) {
			if (cur !== null) {
				// A marker applies to the next bullet, or to the next entry if none follows.
				if (pendingPageBreak) {
					cur.pageBreakBeforeBullets.push(cur.bullets.length);
					pendingPageBreak = false;
				}
				cur.bullets.push(stripped.slice(2).trim());
			}
		} else if (stripped && cur !== null) {
			cur.subtitles.push(stripped);
		}
	}
	if (cur !== null) entries.push(cur);
	return entries;
}

// Returns { items, breaks } where breaks are indices of items preceded by a marker.
function extractListItems(rawLines) {
	const items = [];
	const breaks = [];
	let pendingPageBreak = false;
	for (const line of rawLines) {
		const stripped = line.trim();
		if (stripped === PAGE_BREAK_MARKER) {
			pendingPageBreak = true;
		} else if (stripped.startsWith("- ") || stripped.startsWith("* ")) {
			if (pendingPageBreak && items.length) breaks.push(items.length);
			pendingPageBreak = false;
			items.push(stripped.slice(2).trim());
		}
	}
	return { items, breaks };
}

// Split "**Company | detail**" into { company, right } for row layout.
// Right side can be dates (Feb 2022 - Sep 2022) or location (Bangalore, Karnataka, India).
export function parseCompanyDetailLine(text) {
	if (!text) return null;

	let stripped = text.trim();
	if (stripped.startsWith("**") && stripped.endsWith("**")) {
		stripped = stripped.slice(2, -2).trim();
	}

	const splitAt = stripped.lastIndexOf(" | ");
	if (splitAt === -1) return null;

	const company = stripped.slice(0, splitAt).trim();
	const right = stripped.slice(splitAt + 3).trim();
	if (!company || !right) return null;

	return { company, right };
}

/** @deprecated Use parseCompanyDetailLine */
export const parseCompanyDateLine = parseCompanyDetailLine;

// Convert a small subset of inline markdown (**bold**, *italic*/_italic_,
// [links](url)) into safe HTML for the live preview.
export function inlineMdToHtml(text) {
	if (!text) return "";
	let escaped = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

	escaped = escaped.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
	);
	escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
	escaped = escaped.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, "<i>$1</i>");
	escaped = escaped.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<i>$1</i>");
	return escaped;
}
