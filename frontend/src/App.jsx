import { useEffect, useRef, useState } from "react";
import MarkdownEditor from "./components/MarkdownEditor.jsx";
import ResumePreview from "./components/ResumePreview.jsx";
import Toolbar from "./components/Toolbar.jsx";
import UnlockScreen from "./components/UnlockScreen.jsx";
import { AlertIcon, UploadIcon, XIcon } from "./components/Icons.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5001").replace(/\/+$/, "");

// "owner" builds (the personal site) ask for an access key that unlocks the
// private resumes on the backend; "public" builds only ever see the sample.
const APP_MODE = import.meta.env.VITE_APP_MODE === "owner" ? "owner" : "public";

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
const THEME_KEY = "resume-creator:theme";
const ZOOM_KEY = "resume-creator:zoom";
const ACCESS_KEY_KEY = "resume-creator:access-key";
const MARKDOWN_FILE = /\.(md|markdown|txt)$/i;

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

  // "checking" -> "granted" | "locked". Public builds never lock.
  const [access, setAccess] = useState(APP_MODE === "owner" ? "checking" : "granted");
  const [accessKey, setAccessKey] = useState(() =>
    APP_MODE === "owner" ? readStorage(ACCESS_KEY_KEY, "") : ""
  );

  const apiFetch = (path, key = accessKey) =>
    fetch(`${API_BASE}${path}`, {
      headers: APP_MODE === "owner" && key ? { "X-Access-Key": key } : {},
    });

  // index.html sets data-theme before first paint; start from that value.
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || "light"
  );
  const [zoom, setZoom] = useState(() => readStorage(ZOOM_KEY, 100));
  const [mobileView, setMobileView] = useState("editor");
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStorage(THEME_KEY, theme);
  }, [theme]);
  useEffect(() => writeStorage(ZOOM_KEY, zoom), [zoom]);

  // Errors are shown as a toast that clears itself.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => writeStorage(UPLOADS_KEY, uploads), [uploads]);
  useEffect(() => {
    if (selectedId) writeStorage(SELECTED_KEY, selectedId);
  }, [selectedId]);

  const loadServerResume = (file) => {
    const requestId = ++latestRequest.current;
    setSelectedId(serverId(file));
    return apiFetch(`/api/resumes/${encodeURIComponent(file)}`)
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

  const loadResumeList = (key = accessKey) => {
    // Restore the last selection if it still exists, else the backend default.
    const remembered = readStorage(SELECTED_KEY, "");
    const rememberedUpload = uploads.find((u) => u.id === remembered);
    if (rememberedUpload) selectUpload(rememberedUpload);

    apiFetch("/api/resumes", key)
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
  };

  // Resolves to true / false, or rejects if the backend is unreachable.
  const checkOwnerKey = (key) =>
    apiFetch("/api/access", key)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => Boolean(data?.owner));

  useEffect(() => {
    if (APP_MODE !== "owner") {
      loadResumeList();
      return;
    }
    checkOwnerKey(accessKey)
      .then((isOwner) => {
        if (isOwner) {
          setAccess("granted");
          loadResumeList();
        } else {
          setAccess("locked");
        }
      })
      .catch(() => {
        // Can't verify while the backend is down; uploads still work.
        setAccess("granted");
        setError("Could not reach the server. Your saved resumes will load once it's back.");
      });
    // Run once on mount; uploads are read from their initial (stored) value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnlock = async (key) => {
    const isOwner = await checkOwnerKey(key);
    if (!isOwner) return false;
    writeStorage(ACCESS_KEY_KEY, key);
    setAccessKey(key);
    setAccess("granted");
    loadResumeList(key);
    return true;
  };

  const handleLock = () => {
    try {
      localStorage.removeItem(ACCESS_KEY_KEY);
    } catch {
      // Storage blocked -- nothing was saved anyway.
    }
    setAccessKey("");
    setServerResumes([]);
    setSelectedId("");
    setMarkdown(FALLBACK_SAMPLE);
    setAccess("locked");
  };

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
    if (!MARKDOWN_FILE.test(file.name)) {
      setError("Please choose a .md, .markdown or .txt file.");
      return;
    }
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

  // ⌘/Ctrl+Enter downloads the PDF from anywhere, including the editor.
  const generateRef = useRef(handleGeneratePdf);
  generateRef.current = handleGeneratePdf;
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        generateRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Drop a markdown file anywhere on the page to upload it. The depth counter
  // stops the overlay flickering as the drag moves over child elements.
  const isFileDrag = (e) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const dragHandlers = {
    onDragEnter: (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current++;
      setIsDragging(true);
    },
    onDragOver: (e) => {
      if (isFileDrag(e)) e.preventDefault();
    },
    onDragLeave: (e) => {
      if (!isFileDrag(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    },
    onDrop: (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleUploadFile(file);
    },
  };

  if (access === "locked") {
    return <UnlockScreen onUnlock={handleUnlock} />;
  }

  return (
    <div className="app-shell" {...dragHandlers}>
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
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onLock={APP_MODE === "owner" && accessKey ? handleLock : undefined}
      />

      <div className="view-tabs" role="tablist" aria-label="View">
        {["editor", "preview"].map((view) => (
          <button
            key={view}
            role="tab"
            aria-selected={mobileView === view}
            className={`view-tab${mobileView === view ? " is-active" : ""}`}
            onClick={() => setMobileView(view)}
          >
            {view === "editor" ? "Editor" : "Preview"}
          </button>
        ))}
      </div>

      <main className={`split-view show-${mobileView}`}>
        <MarkdownEditor value={markdown} onChange={handleMarkdownChange} />
        <ResumePreview markdown={markdown} zoom={zoom} onZoomChange={setZoom} />
      </main>

      {error && (
        <div className="toast" role="alert">
          <AlertIcon size={16} />
          <span className="toast-text">{error}</span>
          <button className="toast-close" onClick={() => setError("")} aria-label="Dismiss">
            <XIcon size={14} />
          </button>
        </div>
      )}

      {isDragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card">
            <UploadIcon size={28} />
            <strong>Drop your markdown resume</strong>
            <span>.md, .markdown or .txt</span>
          </div>
        </div>
      )}
    </div>
  );
}
