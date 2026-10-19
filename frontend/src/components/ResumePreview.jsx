import { useMemo } from "react";
import {
	parseResumeMarkdown,
	inlineMdToHtml,
	parseCompanyDetailLine,
} from "../utils/parseResume";
import { MinusIcon, PlusIcon } from "./Icons.jsx";

function EntryHeaderRow({ entry, accentTitle = false }) {
	const parts = (entry.parts || []).filter((p) => p !== "");
	let title = "";
	let dates = "";
	let middle = [];

	if (parts.length >= 2) {
		title = parts[0];
		dates = parts[parts.length - 1];
		middle = parts.slice(1, -1);
	} else if (parts.length === 1) {
		title = parts[0];
	}

	return (
		<>
			<div className="entry-header-row">
				<span
					className={`entry-title${accentTitle ? " entry-title--accent" : ""}`}
					dangerouslySetInnerHTML={{ __html: inlineMdToHtml(title) }}
				/>
				<span
					className="entry-date"
					dangerouslySetInnerHTML={{ __html: inlineMdToHtml(dates) }}
				/>
			</div>
			{middle.length > 0 && (
				<div
					className="entry-subtitle"
					dangerouslySetInnerHTML={{
						__html: inlineMdToHtml(middle.join(", ")),
					}}
				/>
			)}
		</>
	);
}

function PageBreakMarker() {
	return <div className="page-break" aria-hidden="true" />;
}

function ListItem({ item }) {
	return <li dangerouslySetInnerHTML={{ __html: inlineMdToHtml(item) }} />;
}

function BulletItem({ bullet, accentCompany }) {
	const companyDetail = parseCompanyDetailLine(bullet);

	if (companyDetail) {
		return (
			<li className="company-date-bullet">
				<div className="entry-header-row entry-company-row">
					<span
						className={`entry-company-name${accentCompany ? " entry-subtitle--accent" : ""}`}
						dangerouslySetInnerHTML={{
							__html: inlineMdToHtml(companyDetail.company),
						}}
					/>
					<span
						className="entry-date"
						dangerouslySetInnerHTML={{
							__html: inlineMdToHtml(companyDetail.right),
						}}
					/>
				</div>
			</li>
		);
	}

	return <li dangerouslySetInnerHTML={{ __html: inlineMdToHtml(bullet) }} />;
}

function SubtitleRow({ subtitle, accentCompany }) {
	const companyDetail = parseCompanyDetailLine(subtitle);

	if (companyDetail) {
		return (
			<div className="entry-header-row entry-company-row">
				<span
					className={`entry-company-name${accentCompany ? " entry-subtitle--accent" : ""}`}
					dangerouslySetInnerHTML={{
						__html: inlineMdToHtml(companyDetail.company),
					}}
				/>
				<span
					className="entry-date"
					dangerouslySetInnerHTML={{
						__html: inlineMdToHtml(companyDetail.right),
					}}
				/>
			</div>
		);
	}

	return (
		<div
			className={`entry-subtitle${accentCompany ? " entry-subtitle--accent" : ""}`}
			dangerouslySetInnerHTML={{ __html: inlineMdToHtml(subtitle) }}
		/>
	);
}

const ZOOM_MIN = 50;
const ZOOM_MAX = 150;
const ZOOM_STEP = 10;

export default function ResumePreview({ markdown, zoom, onZoomChange }) {
	const data = useMemo(() => parseResumeMarkdown(markdown), [markdown]);
	const setZoom = (z) =>
		onZoomChange(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)));

	return (
		<section className="pane preview-pane" aria-label="Live preview">
			<div className="pane-header">
				<span className="pane-title">
					<span className="pane-dot pane-dot--preview" />
					Live preview
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
					<button
						className="zoom-value"
						onClick={() => setZoom(100)}
						title="Reset to 100%"
					>
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
			<div className="preview-scroll">
			<div className="resume-paper" style={{ zoom: zoom / 100 }}>
				{data.name && <h1 className="resume-name">{data.name}</h1>}
				{data.contactLines?.length > 0 && (
					<div className="resume-contact">
						{data.contactLines.map((line, i) => (
							<p
								key={i}
								className="resume-contact-line"
								dangerouslySetInnerHTML={{
									__html: inlineMdToHtml(line),
								}}
							/>
						))}
					</div>
				)}
				<hr className="rule-heavy" />

				{data.sections.map((section, i) => {
					const sectionKey = section.heading.toLowerCase();
					const accentProjectTitles = sectionKey === "projects";
					const accentCompanyNames = sectionKey === "experience";
					const sectionBreak = [
						"skills",
						"experience",
						"projects",
						"education",
					].includes(sectionKey);

					return (
						<div
							key={i}
							className={`resume-section${sectionBreak ? " resume-section--break" : ""}`}
						>
							{section.pageBreakBefore && <PageBreakMarker />}
							<h2 className="section-heading">
								{section.heading}
							</h2>
							<hr className="rule-light" />

							{section.type === "entries" &&
								section.entries.map((entry, j) => (
									<div key={j} className="entry-block">
										{entry.pageBreakBefore && (
											<PageBreakMarker />
										)}
										<EntryHeaderRow
											entry={entry}
											accentTitle={accentProjectTitles}
										/>
										{entry.subtitles?.map((subtitle, k) => (
											<SubtitleRow
												key={k}
												subtitle={subtitle}
												accentCompany={
													accentCompanyNames
												}
											/>
										))}
										{entry.bullets.length > 0 && (
											<ul className="bullet-list">
												{entry.bullets.map((b, k) => (
													<BulletItem
														key={k}
														bullet={b}
														accentCompany={
															accentCompanyNames
														}
													/>
												))}
											</ul>
										)}
									</div>
								))}

							{section.type === "list" && (
								<ul className="bullet-list">
									{section.items.map((item, j) => (
										<ListItem key={j} item={item} />
									))}
								</ul>
							)}

							{section.type === "text" && (
								<p
									className="section-text"
									dangerouslySetInnerHTML={{
										__html: inlineMdToHtml(section.content),
									}}
								/>
							)}
						</div>
					);
				})}

				{data.sections.length === 0 && !data.name && (
					<p className="preview-empty">
						Start typing your resume markdown on the left…
					</p>
				)}
			</div>
			</div>
		</section>
	);
}
