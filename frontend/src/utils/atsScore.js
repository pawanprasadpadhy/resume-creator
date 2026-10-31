import { parseResumeMarkdown, PAGE_BREAK_MARKER } from "./parseResume.js";

function sectionHeadings(parsed) {
	return parsed.sections.map((s) => (s.heading || "").trim().toLowerCase());
}

function findSection(parsed, keywords) {
	const keys = Array.isArray(keywords) ? keywords : [keywords];
	return parsed.sections.find((s) =>
		keys.some((k) => s.heading.toLowerCase().includes(k)),
	);
}

function experienceBulletCount(expSection) {
	if (!expSection || expSection.type !== "entries") return 0;
	return expSection.entries.reduce((n, e) => n + (e.bullets?.length || 0), 0);
}

function countMetrics(text) {
	const matches = text.match(
		/\b\d+\s*%|\b\d+\+|\b\d{1,2}\/\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/gi,
	);
	return matches ? matches.length : 0;
}

/**
 * Heuristic ATS compatibility score for this app's markdown → PDF pipeline.
 * Not a substitute for Jobscan or employer-specific parsers.
 */
export function scoreResumeAts(markdownText) {
	const markdown = markdownText || "";
	const parsed = parseResumeMarkdown(markdown);
	const checks = [];
	let earned = 0;
	let total = 0;

	const addCheck = (id, label, points, { pass, partial, message }) => {
		total += points;
		let pts = 0;
		let status = "fail";
		if (pass) {
			pts = points;
			status = "pass";
		} else if (partial) {
			pts = Math.round(points * 0.5);
			status = "warn";
		}
		earned += pts;
		checks.push({
			id,
			label,
			status,
			message,
			points: pts,
			maxPoints: points,
		});
	};

	const headings = sectionHeadings(parsed);
	const hasName = Boolean(parsed.name?.trim());
	const plain = markdown.replace(new RegExp(PAGE_BREAK_MARKER, "g"), "");

	addCheck("name", "Name detected", 10, {
		pass: hasName,
		partial: !hasName && parsed.contactLines?.length > 0,
		message: hasName
			? `Heading: “${parsed.name}”.`
			: "Add `# Your Name` at the top so parsers read your name reliably.",
	});

	const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(
		plain,
	);
	addCheck("email", "Email address", 10, {
		pass: hasEmail,
		message: hasEmail
			? "Email found in contact lines."
			: "Include a plain-text email (not only inside a link).",
	});

	const hasPhone = /\+?\d[\d\s().\-]{8,}\d/.test(plain);
	addCheck("phone", "Phone number", 8, {
		pass: hasPhone,
		message: hasPhone
			? "Phone number detected."
			: "Add a phone number in the contact block.",
	});

	const hasExperience = headings.some((h) => h.includes("experience"));
	addCheck("experience-section", "Experience section", 12, {
		pass: hasExperience,
		message: hasExperience
			? "Experience section present."
			: "Add `## Experience` with `### Job Title | Company | … | Dates` entries.",
	});

	const expSection = findSection(parsed, "experience");
	const bullets = experienceBulletCount(expSection);
	addCheck("experience-bullets", "Experience bullet points", 10, {
		pass: bullets >= 4,
		partial: bullets >= 1 && bullets < 4,
		message:
			bullets >= 4
				? `${bullets} bullets under experience — good detail for ATS keyword matching.`
				: bullets >= 1
					? `Only ${bullets} experience bullet(s). Aim for 4+ with measurable impact.`
					: "Add `-` bullets under each role.",
	});

	const hasEducation = headings.some((h) => h.includes("education"));
	addCheck("education-section", "Education section", 10, {
		pass: hasEducation,
		message: hasEducation
			? "Education section present."
			: "Add `## Education` with school and degree entries.",
	});

	const hasSkills = headings.some(
		(h) => h.includes("skill") || h.includes("technical"),
	);
	addCheck("skills-section", "Skills section", 10, {
		pass: hasSkills,
		message: hasSkills
			? "Skills section present."
			: "Add `## Skills` (list or labeled lines) for keyword coverage.",
	});

	const hasSummary = headings.some((h) => h.includes("summary"));
	addCheck("summary-section", "Professional summary", 6, {
		pass: hasSummary,
		message: hasSummary
			? "Summary section present (optional but helpful)."
			: "Consider a short `## Summary` paragraph for top-of-resume keywords.",
	});

	const metrics = countMetrics(plain);
	addCheck("metrics", "Quantified results", 8, {
		pass: metrics >= 5,
		partial: metrics >= 2 && metrics < 5,
		message:
			metrics >= 5
				? `${metrics} dates/percentages/metrics detected — strong for ATS and recruiters.`
				: metrics >= 2
					? `${metrics} quantified hints found. Add more %, counts, or time ranges in bullets.`
					: "Add numbers (%, counts, scale) to experience bullets where possible.",
	});

	const hasImages = /!\[[^\]]*\]\([^)]+\)/.test(plain);
	addCheck("no-images", "No embedded images", 8, {
		pass: !hasImages,
		message: hasImages
			? "Remove `![alt](url)` images — many ATS parsers skip or break on them."
			: "No images — PDF stays text-first (ATS-friendly).",
	});

	const hasHtml = /<(?!!--)[a-z][\s\S]*?>/i.test(plain);
	addCheck("no-html", "No raw HTML", 6, {
		pass: !hasHtml,
		message: hasHtml
			? "Avoid HTML tags; stick to markdown this editor understands."
			: "No raw HTML detected.",
	});

	const tableDivider = /^\|[\s\-:|]+\|$/m.test(plain);
	const tableRow = /^\|.+\|.+\|/m.test(plain);
	const hasTables = tableDivider && tableRow;
	addCheck("no-tables", "No markdown tables", 6, {
		pass: !hasTables,
		message: hasTables
			? "Markdown tables often parse poorly in ATS — use bullets or `###` entries instead."
			: "No multi-column markdown tables.",
	});

	const wordCount = plain.split(/\s+/).filter(Boolean).length;
	addCheck("length", "Resume length", 6, {
		pass: wordCount >= 250 && wordCount <= 1200,
		partial:
			(wordCount >= 150 && wordCount < 250) ||
			(wordCount > 1200 && wordCount <= 1800),
		message:
			wordCount < 150
				? `Very short (~${wordCount} words). Add more substance for keyword match.`
				: wordCount > 1800
					? `Long (~${wordCount} words). Trim for a tighter one–two page PDF.`
					: wordCount > 1200
						? `~${wordCount} words — OK for a master file; trim for single-page applications.`
						: wordCount < 250
							? `~${wordCount} words — a bit thin; expand experience or projects.`
							: `~${wordCount} words — reasonable length for ATS PDF export.`,
	});

	let parseOk = true;
	try {
		if (!parsed.sections.length && !hasName) parseOk = false;
	} catch {
		parseOk = false;
	}
	addCheck("parse", "Parser compatibility", 10, {
		pass: parseOk && (hasName || parsed.contactLines?.length > 0),
		message: parseOk
			? "Markdown matches this app's resume format (same rules as PDF export)."
			: "Fix structure so sections and headings parse correctly.",
	});

	const score = total ? Math.round((earned / total) * 100) : 0;
	let grade = "Needs work";
	let gradeHint =
		"Address failed checks below before applying to competitive roles.";

	if (score >= 90) {
		grade = "Excellent";
		gradeHint =
			"Structure and content look ATS-friendly for this PDF pipeline. Tailor keywords per job posting.";
	} else if (score >= 75) {
		grade = "Good";
		gradeHint =
			"Solid base — fix remaining items and match keywords to each job description.";
	} else if (score >= 60) {
		grade = "Fair";
		gradeHint =
			"Usable, but improving contact info, sections, and metrics will help parsing and ranking.";
	}

	const failed = checks.filter((c) => c.status === "fail").length;
	const warned = checks.filter((c) => c.status === "warn").length;

	return {
		score,
		grade,
		gradeHint,
		checks,
		summary: {
			wordCount,
			sectionCount: parsed.sections.length,
			experienceBullets: bullets,
			failed,
			warned,
		},
	};
}
