import { useRef } from "react";

export default function Toolbar({
  serverResumes,
  uploads,
  selectedId,
  onSelectResume,
  onUploadFile,
  onRemoveUpload,
  onExportMarkdown,
  onGeneratePdf,
  isGenerating,
  error,
}) {
  const fileInputRef = useRef(null);
  const hasOptions = serverResumes.length > 0 || uploads.length > 0;
  const uploadSelected = selectedId.startsWith("upload:");

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="app-title">📄 Resume Creator</span>
      </div>
      <div className="toolbar-right">
        <select
          className="resume-select"
          aria-label="Select resume"
          value={hasOptions ? selectedId : ""}
          onChange={(e) => onSelectResume(e.target.value)}
          disabled={!hasOptions}
        >
          {!selectedId && <option value="">Select a resume…</option>}
          {serverResumes.length > 0 && (
            <optgroup label="Saved resumes">
              {serverResumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </optgroup>
          )}
          {uploads.length > 0 && (
            <optgroup label="Your uploads">
              {uploads.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {uploadSelected && (
          <button
            className="btn btn-secondary"
            onClick={onRemoveUpload}
            title="Remove this upload from the list"
          >
            Remove
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload .md
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadFile(file);
            e.target.value = "";
          }}
        />
        <button className="btn btn-secondary" onClick={onExportMarkdown}>
          Export .md
        </button>
        <button
          className="btn btn-primary"
          onClick={onGeneratePdf}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating…" : "Render / Generate PDF"}
        </button>
      </div>
      {error && <div className="toolbar-error">{error}</div>}
    </div>
  );
}
