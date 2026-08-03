// Mirrors backend/resume_parser.py so the live preview matches the PDF output.
// Keep this in sync with the Python parser if you change the markdown format.

export function parseResumeMarkdown(markdownText) {
	const lines = (markdownText || "").replace(/\r\n/g, "\n").split("\n");

	let name = "";
	const contactLines = [];
	const sections = [];
	let current = null; // { heading, rawLines: [] }

	const finalizeSection = (section) => {
		const { heading, rawLines } = section;
		const entries = extractEntries(rawLines);
		if (entries.length) {
			return { heading, type: "entries", entries };
		}
		const listItems = extractListItems(rawLines);
		if (listItems.length) {
			return { heading, type: "list", items: listItems };
		}
		const content = rawLines
			.map((l) => l.trim())
			.filter(Boolean)
			.join(" ");
		return { heading, type: "text", content };
	};

	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+$/, "");
		const stripped = line.trim();

		if (stripped.startsWith("# ") && !stripped.startsWith("##")) {
			if (!name) name = stripped.slice(2).trim();
			continue;
		}

		if (stripped.startsWith("## ")) {
			if (current !== null) sections.push(finalizeSection(current));
			current = { heading: stripped.slice(3).trim(), rawLines: [] };
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

	for (const line of rawLines) {
		const stripped = line.trim();
		if (stripped.startsWith("### ")) {
			if (cur !== null) entries.push(cur);
			const headerRaw = stripped.slice(4).trim();
			cur = {
				headerRaw,
				parts: headerRaw.split("|").map((p) => p.trim()),
				subtitles: [],
				bullets: [],
			};
		} else if (stripped.startsWith("- ") || stripped.startsWith("* ")) {
			if (cur !== null) cur.bullets.push(stripped.slice(2).trim());
		} else if (stripped && cur !== null) {
			cur.subtitles.push(stripped);
		}
	}
	if (cur !== null) entries.push(cur);
	return entries;
}

function extractListItems(rawLines) {
	const items = [];
	for (const line of rawLines) {
		const stripped = line.trim();
		if (stripped.startsWith("- ") || stripped.startsWith("* ")) {
			items.push(stripped.slice(2).trim());
		}
	}
	return items;
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
