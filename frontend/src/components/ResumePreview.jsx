import { useMemo } from "react";
import {
	parseResumeMarkdown,
	inlineMdToHtml,
	parseCompanyDetailLine,
} from "../utils/parseResume";

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

export default function ResumePreview({ markdown }) {
	const data = useMemo(() => parseResumeMarkdown(markdown), [markdown]);

	return (
		<div className="preview-pane">
			<div className="pane-header">Live Preview</div>
			<div className="resume-paper">
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

					return (
						<div key={i} className="resume-section">
							<h2 className="section-heading">
								{section.heading}
							</h2>
							<hr className="rule-light" />

							{section.type === "entries" &&
								section.entries.map((entry, j) => (
									<div key={j} className="entry-block">
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
	);
}
