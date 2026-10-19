import { useEffect, useRef, useState } from "react";
import MarkdownEditor from "./components/MarkdownEditor.jsx";
import ResumePreview from "./components/ResumePreview.jsx";
import Toolbar from "./components/Toolbar.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5001").replace(/\/+$/, "");

const FALLBACK_SAMPLE = `# Your Name
you@email.com | (555) 123-4567 | City, State | linkedin.com/in/you

## Summary
A brief 2-3 sentence summary of your experience and strengths.

## Experience
### Job Title | Company Name | Location | Start - End
- Accomplishment or responsibility, ideally with a measurable result
- Another bullet point

## Education
### Degree | Institution | Location | Year

## Skills
- Languages: Python, JavaScript
- Tools: Git, Docker
`;

// Uploaded resumes live in the browser only: the Render disk is ephemeral and
// shared by every visitor, so nothing user-uploaded is sent to the server.
const UPLOADS_KEY = "resume-creator:uploads";
const SELECTED_KEY = "resume-creator:selected";

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) -- uploads just won't persist.
  }
}

const serverId = (file) => `server:${file}`;

export default function App() {
  const [markdown, setMarkdown] = useState(FALLBACK_SAMPLE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  // [{ file, label }] bundled with the backend
  const [serverResumes, setServerResumes] = useState([]);
  // [{ id, label, markdown, updatedAt }] uploaded in this browser
  const [uploads, setUploads] = useState(() => readStorage(UPLOADS_KEY, []));
  const [selectedId, setSelectedId] = useState("");
  // Ignore responses for a selection the user has already moved away from.
  const latestRequest = useRef(0);

  useEffect(() => writeStorage(UPLOADS_KEY, uploads), [uploads]);
  useEffect(() => {
    if (selectedId) writeStorage(SELECTED_KEY, selectedId);
  }, [selectedId]);

  const loadServerResume = (file) => {
    const requestId = ++latestRequest.current;
    setSelectedId(serverId(file));
    return fetch(`${API_BASE}/api/resumes/${encodeURIComponent(file)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server returned ${res.status}`))))
      .then((data) => {
        if (requestId === latestRequest.current && data?.markdown) {
          setMarkdown(data.markdown);
        }
      });
  };

  const selectUpload = (upload) => {
    latestRequest.current++;
    setSelectedId(upload.id);
    setMarkdown(upload.markdown);
  };

  useEffect(() => {
    // Restore the last selection if it still exists, else the backend default.
    const remembered = readStorage(SELECTED_KEY, "");
    const rememberedUpload = uploads.find((u) => u.id === remembered);
    if (rememberedUpload) selectUpload(rememberedUpload);

    fetch(`${API_BASE}/api/resumes`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const list = data?.resumes ?? [];
        setServerResumes(list);
        if (rememberedUpload) return;
        const rememberedFile = list.find((r) => serverId(r.file) === remembered)?.file;
        const initial = rememberedFile || data?.default || list[0]?.file;
        if (initial) return loadServerResume(initial);
      })
      .catch(() => {
        // Backend unreachable -- keep uploads and the built-in fallback sample.
        if (!rememberedUpload && uploads[0]) selectUpload(uploads[0]);
      });
    // Run once on mount; uploads are read from their initial (stored) value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectResume = (id) => {
    setError("");
    if (id.startsWith("server:")) {
      loadServerResume(id.slice("server:".length)).catch(() =>
        setError("Could not load that resume from the server.")
      );
      return;
    }
    const upload = uploads.find((u) => u.id === id);
    if (upload) selectUpload(upload);
  };

  const handleUploadFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      const label = file.name.replace(/\.(md|markdown|txt)$/i, "");
      // Re-uploading a file with the same name replaces it with the new version.
      const existing = uploads.find((u) => u.label === label);
      const upload = {
        id: existing?.id ?? `upload:${Date.now().toString(36)}`,
        label,
        markdown: text,
        updatedAt: Date.now(),
      };
      setError("");
      setUploads((prev) =>
        existing
          ? prev.map((u) => (u.id === existing.id ? upload : u))
          : [...prev, upload]
      );
      selectUpload(upload);
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  };

  const handleRemoveUpload = () => {
    const remaining = uploads.filter((u) => u.id !== selectedId);
    setUploads(remaining);
    const fallbackFile = serverResumes[0]?.file;
    if (fallbackFile) {
      loadServerResume(fallbackFile).catch(() => setMarkdown(FALLBACK_SAMPLE));
    } else if (remaining[0]) {
      selectUpload(remaining[0]);
    } else {
      setSelectedId("");
      setMarkdown(FALLBACK_SAMPLE);
    }
  };

  const handleMarkdownChange = (value) => {
    setMarkdown(value);
    // Edits to an uploaded resume are kept; bundled resumes act as templates.
    if (selectedId.startsWith("upload:")) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === selectedId ? { ...u, markdown: value, updatedAt: Date.now() } : u
        )
      );
    }
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGeneratePdf = async () => {
    setError("");
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      // fetch() rejects with a TypeError on network failures; the message
      // differs per browser ("Failed to fetch", "Load failed", ...).
      setError(
        err instanceof TypeError
          ? "Could not reach the server. It may be waking up, please try again in a few seconds."
          : err.message
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-shell">
      <Toolbar
        serverResumes={serverResumes.map((r) => ({ id: serverId(r.file), label: r.label }))}
        uploads={uploads}
        selectedId={selectedId}
        onSelectResume={handleSelectResume}
        onUploadFile={handleUploadFile}
        onRemoveUpload={handleRemoveUpload}
        onExportMarkdown={handleExportMarkdown}
        onGeneratePdf={handleGeneratePdf}
        isGenerating={isGenerating}
        error={error}
      />
      <div className="split-view">
        <MarkdownEditor value={markdown} onChange={handleMarkdownChange} />
        <ResumePreview markdown={markdown} />
      </div>
    </div>
  );
}
