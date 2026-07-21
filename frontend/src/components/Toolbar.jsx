import { useRef } from "react";

export default function Toolbar({
  onLoadSample,
  onImportFile,
  onExportMarkdown,
  onGeneratePdf,
  isGenerating,
  error,
}) {
  const fileInputRef = useRef(null);

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="app-title">📄 Resume Creator</span>
      </div>
      <div className="toolbar-right">
        <button className="btn btn-secondary" onClick={onLoadSample}>
          Load Sample
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Import .md
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown,text/plain"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
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
