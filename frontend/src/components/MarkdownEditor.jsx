import { useMemo, useRef } from "react";

const INDENT = "  ";

export default function MarkdownEditor({ value, onChange }) {
	const textareaRef = useRef(null);

	const stats = useMemo(() => {
		const words = value.trim() ? value.trim().split(/\s+/).length : 0;
		const lines = value ? value.split("\n").length : 0;
		return { words, lines };
	}, [value]);

	// Tab / Shift+Tab indent instead of moving focus out of the editor.
	const handleKeyDown = (e) => {
		if (e.key !== "Tab" || e.metaKey || e.ctrlKey || e.altKey) return;
		e.preventDefault();
		const el = e.currentTarget;
		const { selectionStart: start, selectionEnd: end } = el;
		const lineStart = value.lastIndexOf("\n", start - 1) + 1;

		let next;
		let cursor;
		if (e.shiftKey) {
			if (!value.startsWith(INDENT, lineStart)) return;
			next =
				value.slice(0, lineStart) +
				value.slice(lineStart + INDENT.length);
			cursor = Math.max(lineStart, start - INDENT.length);
		} else {
			next = value.slice(0, start) + INDENT + value.slice(end);
			cursor = start + INDENT.length;
		}
		onChange(next);
		requestAnimationFrame(() => {
			textareaRef.current?.setSelectionRange(cursor, cursor);
		});
	};

	return (
		<section className="pane editor-pane" aria-label="Markdown editor">
			<div className="pane-header">
				<span className="pane-title">
					<span className="pane-dot pane-dot--editor" />
					Markdown
				</span>
				<span className="pane-meta">
					{stats.words.toLocaleString()} words ·{" "}
					{stats.lines.toLocaleString()} lines
				</span>
			</div>
			<textarea
				ref={textareaRef}
				className="editor-textarea"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={handleKeyDown}
				spellCheck={false}
				placeholder={
					"# Your Name\nemail | phone | location\n\n## Summary\n..."
				}
			/>
		</section>
	);
}
