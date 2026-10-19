import { useRef } from "react";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileDownIcon,
  FileTextIcon,
  LockIcon,
  MoonIcon,
  SpinnerIcon,
  SunIcon,
  TrashIcon,
  UploadIcon,
} from "./Icons.jsx";

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

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
  theme,
  onToggleTheme,
  onLock,
}) {
  const fileInputRef = useRef(null);
  const hasOptions = serverResumes.length > 0 || uploads.length > 0;
  const uploadSelected = selectedId.startsWith("upload:");

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <FileTextIcon size={18} />
        </span>
        <div className="brand-text">
          <span className="brand-title">Resume Creator</span>
          <span className="brand-sub">Markdown to ATS-ready PDF</span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="select-wrap">
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
          <ChevronDownIcon size={14} className="select-chevron" />
        </div>
        {uploadSelected && (
          <button
            className="btn btn-icon btn-danger-ghost"
            onClick={onRemoveUpload}
            title="Remove this upload"
            aria-label="Remove this upload"
          >
            <TrashIcon size={15} />
          </button>
        )}
      </div>

      <div className="topbar-actions">
        <button
          className="btn btn-ghost"
          onClick={() => fileInputRef.current?.click()}
          title="Upload a .md file (or drop it anywhere)"
        >
          <UploadIcon size={15} />
          <span className="btn-label">Upload</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadFile(file);
            e.target.value = "";
          }}
        />
        <button
          className="btn btn-ghost"
          onClick={onExportMarkdown}
          title="Save the markdown source"
        >
          <FileDownIcon size={15} />
          <span className="btn-label">Export .md</span>
        </button>
        <button
          className="btn btn-icon btn-ghost"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
        </button>
        {onLock && (
          <button
            className="btn btn-icon btn-ghost"
            onClick={onLock}
            title="Lock (forget the access key on this device)"
            aria-label="Lock"
          >
            <LockIcon size={15} />
          </button>
        )}
        <span className="topbar-divider" aria-hidden="true" />
        <button
          className="btn btn-primary"
          onClick={onGeneratePdf}
          disabled={isGenerating}
          title={`Download PDF (${IS_MAC ? "⌘" : "Ctrl"}+Enter)`}
        >
          {isGenerating ? <SpinnerIcon size={15} /> : <DownloadIcon size={15} />}
          <span>{isGenerating ? "Generating…" : "Download PDF"}</span>
          <kbd className="btn-kbd">{IS_MAC ? "⌘" : "Ctrl"}↵</kbd>
        </button>
      </div>
    </header>
  );
}
