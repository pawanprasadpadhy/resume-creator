import { useEffect, useMemo } from "react";
import { scoreResumeAts } from "../utils/atsScore.js";
import { CheckIcon, AlertIcon, XIcon } from "./Icons.jsx";

function StatusIcon({ status }) {
	if (status === "pass") {
		return (
			<CheckIcon
				size={16}
				className="ats-check-icon ats-check-icon--pass"
			/>
		);
	}
	if (status === "warn") {
		return (
			<AlertIcon
				size={16}
				className="ats-check-icon ats-check-icon--warn"
			/>
		);
	}
	return <XIcon size={16} className="ats-check-icon ats-check-icon--fail" />;
}

export default function AtsScoreModal({ markdown, open, onClose }) {
	const report = useMemo(
		() => (open ? scoreResumeAts(markdown) : null),
		[markdown, open],
	);

	useEffect(() => {
		if (!open) return;
		const onKey = (e) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open || !report) return null;

	const { score, grade, gradeHint, checks, summary } = report;
	const ringColor =
		score >= 75
			? "var(--ats-good)"
			: score >= 60
				? "var(--ats-warn)"
				: "var(--danger)";

	return (
		<div
			className="ats-backdrop"
			role="presentation"
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<div
				className="ats-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="ats-modal-title"
			>
				<header className="ats-modal-header">
					<div>
						<h2 id="ats-modal-title" className="ats-modal-title">
							ATS compatibility check
						</h2>
						<p className="ats-modal-sub">
							Heuristic score for this app's markdown → PDF
							format. Not affiliated with Jobscan or employer ATS
							vendors.
						</p>
					</div>
					<button
						type="button"
						className="btn btn-icon btn-ghost"
						onClick={onClose}
						aria-label="Close"
					>
						<XIcon size={18} />
					</button>
				</header>

				<div className="ats-score-row">
					<div
						className="ats-score-ring"
						style={{
							"--ats-score": score,
							"--ats-ring-color": ringColor,
						}}
					>
						<span className="ats-score-value">{score}</span>
						<span className="ats-score-of">/ 100</span>
					</div>
					<div className="ats-grade-block">
						<span className="ats-grade">{grade}</span>
						<p className="ats-grade-hint">{gradeHint}</p>
						<ul className="ats-stats">
							<li>{summary.sectionCount} sections</li>
							<li>
								{summary.experienceBullets} experience bullets
							</li>
							<li>~{summary.wordCount} words</li>
						</ul>
					</div>
				</div>

				<ul className="ats-check-list">
					{checks.map((c) => (
						<li
							key={c.id}
							className={`ats-check-item ats-check-item--${c.status}`}
						>
							<StatusIcon status={c.status} />
							<div className="ats-check-body">
								<span className="ats-check-label">
									{c.label}
								</span>
								<span className="ats-check-message">
									{c.message}
								</span>
							</div>
							<span className="ats-check-points">
								{c.points}/{c.maxPoints}
							</span>
						</li>
					))}
				</ul>

				<footer className="ats-modal-footer">
					<button
						type="button"
						className="btn btn-primary"
						onClick={onClose}
					>
						Done
					</button>
				</footer>
			</div>
		</div>
	);
}
