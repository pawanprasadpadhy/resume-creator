export default function MarkdownEditor({ value, onChange }) {
  return (
    <div className="editor-pane">
      <div className="pane-header">Markdown Editor</div>
      <textarea
        className="editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="# Your Name
email | phone | location

## Summary
..."
      />
    </div>
  );
}
