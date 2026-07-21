import { useEffect, useState } from "react";
import MarkdownEditor from "./components/MarkdownEditor.jsx";
import ResumePreview from "./components/ResumePreview.jsx";
import Toolbar from "./components/Toolbar.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

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

export default function App() {
  const [markdown, setMarkdown] = useState(FALLBACK_SAMPLE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Try to load the backend's sample resume on first load; fall back silently.
    fetch(`${API_BASE}/api/sample`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data?.markdown) setMarkdown(data.markdown);
      })
      .catch(() => {
        // Backend not running yet -- keep the built-in fallback sample.
      });
  }, []);

  const handleLoadSample = () => {
    fetch(`${API_BASE}/api/sample`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data?.markdown) setMarkdown(data.markdown);
      })
      .catch(() => setMarkdown(FALLBACK_SAMPLE));
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setMarkdown(String(e.target?.result ?? ""));
    reader.readAsText(file);
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
      setError(
        err.message?.includes("fetch")
          ? "Could not reach the backend. Is it running on http://localhost:5001?"
          : err.message
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-shell">
      <Toolbar
        onLoadSample={handleLoadSample}
        onImportFile={handleImportFile}
        onExportMarkdown={handleExportMarkdown}
        onGeneratePdf={handleGeneratePdf}
        isGenerating={isGenerating}
        error={error}
      />
      <div className="split-view">
        <MarkdownEditor value={markdown} onChange={setMarkdown} />
        <ResumePreview markdown={markdown} />
      </div>
    </div>
  );
}
