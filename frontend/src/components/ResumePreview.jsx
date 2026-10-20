import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
	parseResumeMarkdown,
	inlineMdToHtml,
	parseCompanyDetailLine,
} from "../utils/parseResume";
import { MinusIcon, PlusIcon } from "./Icons.jsx";

// The preview is laid out as a list of blocks that mirror the flowables
// backend/pdf_generator.py emits, sized in pt with the values from
// backend/constants.py. Blocks are measured off-screen and packed onto real
// letter-size pages the way ReportLab does, so page breaks land where the
// downloaded PDF puts them. Keep the numbers below in sync with constants.py.
const PT_PER_PX = 72 / 96;
const PAGE_CONTENT_HEIGHT_PT = 11 * 72 - 2 * 0.32 * 72 - 2 * 6; // page - margins - frame padding
const SECTION_SPACE_BEFORE = 5;
const ENTRY_GAP = 11;
const SECTION_END_GAP = 2;
const SECTION_BREAK_GAP = 8;
const SECTION_BREAK_HEADINGS = ["skills", "experience", "projects", "education"];

const PAGE_WIDTH_PX = 8.5 * 96;
const PAGES_SIDE_PADDING_PX = 32; // .pdf-pages horizontal padding (16px each side)

const ZOOM_MIN = 50;
const ZOOM_MAX = 150;
const ZOOM_STEP = 10;

const html = (text) => ({ __html: inlineMdToHtml(text) });

// Matches pdf_generator._date_paragraph: keep "City, Country" and "a, b" together.
function dateText(text) {
	if (!text) return "";
	const isLocation = text.includes(",") && !/\d{4}/.test(text);
	return isLocation ? text.replace(/ /g, " ") : text.replace(/, /g, ", ");
}

function Row({ left, right, leftClass = "", rightClass = "pdf-date" }) {
	return (
		<div className="pdf-row">
			<div className={leftClass} dangerouslySetInnerHTML={html(left)} />
			<div className={rightClass} dangerouslySetInnerHTML={html(dateText(right))} />
		</div>
	);
}

function Bullet({ text, accent = false }) {
	const detail = parseCompanyDetailLine(text);
	return (
		<div className={`pdf-bullet${detail ? " pdf-bullet--dated" : ""}`}>
			<span className="pdf-bullet-glyph">•</span>
			{detail ? (
				<>
					<div
						className={`pdf-text${accent ? " pdf-accent" : ""}`}
						dangerouslySetInnerHTML={html(detail.company)}
					/>
					<div className="pdf-date" dangerouslySetInnerHTML={html(dateText(detail.right))} />
				</>
			) : (
				<div className="pdf-text" dangerouslySetInnerHTML={html(text)} />
			)}
		</div>
	);
}

const spacer = (key, pt) => ({
	key,
	pt,
	isSpacer: true,
	el: <div style={{ height: `${pt}pt` }} />,
});

// One block per PDF flowable, in the same order as pdf_generator.build_pdf.
function buildBlocks(data) {
	const blocks = [];
	const push = (key, el, opts = {}) => blocks.push({ key, el, ...opts });

	if (data.name) {
		push("name", <div className="pdf-name">{data.name}</div>);
	}
	if (data.contactLines?.length) {
		push(
			"contact",
			<div
				className="pdf-contact"
				dangerouslySetInnerHTML={{
					__html: data.contactLines.map(inlineMdToHtml).join("<br/>"),
				}}
			/>
		);
	}
	blocks.push(spacer("header-space", 2));
	push("main-rule", <div className="pdf-rule pdf-rule--heavy" />);

	data.sections.forEach((section, s) => {
		const sectionKey = (section.heading || "").toLowerCase();
		const accentTitles = sectionKey === "projects";
		const accentCompanies = sectionKey === "experience";

		push(`s${s}-heading`, <div className="pdf-heading">{section.heading}</div>, {
			spaceBefore: SECTION_SPACE_BEFORE,
			breakBefore: section.pageBreakBefore,
		});
		push(`s${s}-rule`, <div className="pdf-rule" />);

		if (section.type === "entries") {
			section.entries.forEach((entry, e) => {
				const k = `s${s}-e${e}`;
				const parts = (entry.parts || []).filter((p) => p !== "");
				const title = parts[0] || "";
				const dates = parts.length >= 2 ? parts[parts.length - 1] : "";
				const middle = parts.length > 2 ? parts.slice(1, -1) : [];

				push(
					`${k}-header`,
					<Row
						left={title}
						right={dates}
						leftClass={`pdf-title${accentTitles ? " pdf-accent-text" : ""}`}
						rightClass={`pdf-date${accentTitles ? " pdf-date--link" : ""}`}
					/>,
					{ breakBefore: entry.pageBreakBefore }
				);
				if (middle.length) {
					push(
						`${k}-middle`,
						<div className="pdf-subtitle" dangerouslySetInnerHTML={html(middle.join(", "))} />
					);
				}
				entry.subtitles?.forEach((subtitle, t) => {
					const detail = parseCompanyDetailLine(subtitle);
					const subtitleClass = accentCompanies ? "pdf-company pdf-accent" : "pdf-subtitle";
					push(
						`${k}-sub${t}`,
						detail ? (
							<Row left={detail.company} right={detail.right} leftClass={subtitleClass} />
						) : (
							<div className={subtitleClass} dangerouslySetInnerHTML={html(subtitle)} />
						)
					);
				});
				entry.bullets.forEach((bullet, b) => {
					push(`${k}-b${b}`, <Bullet text={bullet} accent={accentCompanies} />);
				});
				if (e < section.entries.length - 1) {
					blocks.push(spacer(`${k}-gap`, ENTRY_GAP));
				}
			});
		} else if (section.type === "list") {
			section.items.forEach((item, i) => {
				push(`s${s}-i${i}`, <Bullet text={item} />);
			});
		} else if (section.type === "text") {
			push(
				`s${s}-text`,
				<div className="pdf-text" dangerouslySetInnerHTML={html(section.content)} />
			);
		}

		blocks.push(spacer(`s${s}-end`, SECTION_END_GAP));
		if (SECTION_BREAK_HEADINGS.includes(sectionKey)) {
			blocks.push(spacer(`s${s}-break`, SECTION_BREAK_GAP));
		}
	});

	return blocks;
}

// Pack measured blocks onto pages like a ReportLab Frame: a block that doesn't
// fit moves whole to the next page (rows and bullets are one-row tables, which
// never split), spaceBefore is dropped at the top of a page, and a spacer that
// doesn't fit is discarded instead of carried over.
function paginate(blocks, heightsPt) {
	const pages = [[]];
	let used = 0;
	const newPage = () => {
		pages.push([]);
		used = 0;
	};

	blocks.forEach((block, i) => {
		let page = pages[pages.length - 1];
		if (block.breakBefore && page.length) {
			newPage();
			page = pages[pages.length - 1];
		}
		const atTop = page.length === 0;
		const before = atTop ? 0 : block.spaceBefore || 0;
		const height = heightsPt[i] + before;

		if (!atTop && used + height > PAGE_CONTENT_HEIGHT_PT + 0.5) {
			newPage();
			if (block.isSpacer) return;
			pages[pages.length - 1].push(i);
			used = heightsPt[i];
			return;
		}
		page.push(i);
		used += height;
	});

	return pages.filter((p) => p.length);
}

export default function ResumePreview({ markdown, zoom, onZoomChange }) {
	const data = useMemo(() => parseResumeMarkdown(markdown), [markdown]);
	const blocks = useMemo(() => buildBlocks(data), [data]);
	const measureRef = useRef(null);
	const scrollRef = useRef(null);
	// 100% = the page fills the pane width (never larger than its real size),
	// so the whole page is visible without horizontal scrolling.
	const [fitScale, setFitScale] = useState(1);
	// Pages hold indices into a block list, so keep each layout together with
	// the exact blocks it was computed from. After an edit, `blocks` changes a
	// render before the layout effect re-paginates; rendering from the stored
	// pair means old indices never point into a shorter, newer list.
	const [layout, setLayout] = useState({ blocks: [], pages: [] });
	const { pages } = layout;
	// Re-measure once web fonts finish loading, since they change line wraps.
	const [fontEpoch, setFontEpoch] = useState(0);

	useEffect(() => {
		document.fonts?.ready.then(() => setFontEpoch((n) => n + 1));
	}, []);

	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const update = () => {
			const available = el.clientWidth - PAGES_SIDE_PADDING_PX;
			setFitScale(Math.min(1, Math.max(0.2, available / PAGE_WIDTH_PX)));
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	useLayoutEffect(() => {
		const nodes = measureRef.current?.children ?? [];
		const heightsPt = Array.from(nodes, (n) => n.getBoundingClientRect().height * PT_PER_PX);
		setLayout({ blocks, pages: paginate(blocks, heightsPt) });
	}, [blocks, fontEpoch]);

	const setZoom = (z) => onZoomChange(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)));
	const isEmpty = data.sections.length === 0 && !data.name;

	return (
		<section className="pane preview-pane" aria-label="Live preview">
			<div className="pane-header">
				<span className="pane-title">
					<span className="pane-dot pane-dot--preview" />
					Live preview
					{!isEmpty && pages.length > 0 && (
						<span className="pane-meta">
							· {pages.length} {pages.length === 1 ? "page" : "pages"}
						</span>
					)}
				</span>
				<div className="zoom-control" role="group" aria-label="Zoom">
					<button
						className="zoom-btn"
						onClick={() => setZoom(zoom - ZOOM_STEP)}
						disabled={zoom <= ZOOM_MIN}
						aria-label="Zoom out"
					>
						<MinusIcon size={13} />
					</button>
					<button className="zoom-value" onClick={() => setZoom(100)} title="Reset to 100%">
						{zoom}%
					</button>
					<button
						className="zoom-btn"
						onClick={() => setZoom(zoom + ZOOM_STEP)}
						disabled={zoom >= ZOOM_MAX}
						aria-label="Zoom in"
					>
						<PlusIcon size={13} />
					</button>
				</div>
			</div>

			<div className="preview-scroll" ref={scrollRef}>
				{isEmpty ? (
					<p className="preview-empty">Start typing your resume markdown on the left…</p>
				) : (
					<div className="pdf-pages" style={{ zoom: (fitScale * zoom) / 100 }}>
						{pages.map((indices, p) => (
							<div className="pdf-page" key={p}>
								<div className="pdf-frame">
									{indices.map((i, pos) => {
										const block = layout.blocks[i];
										const before = pos > 0 ? block.spaceBefore : 0;
										return (
											<div
												key={block.key}
												style={before ? { paddingTop: `${before}pt` } : undefined}
											>
												{block.el}
											</div>
										);
									})}
								</div>
								<span className="pdf-page-number">
									{p + 1} / {pages.length}
								</span>
							</div>
						))}
					</div>
				)}

				{/* Off-screen copy at the exact page width, used only for measuring. */}
				<div className="pdf-measure-wrap" aria-hidden="true">
					<div className="pdf-frame" ref={measureRef}>
						{blocks.map((block) => (
							<div key={block.key}>{block.el}</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
