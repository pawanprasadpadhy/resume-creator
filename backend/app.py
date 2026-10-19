"""
app.py

Flask backend for the Resume Creator project.

Endpoints:
  GET  /api/health          -> simple health check
  GET  /api/sample          -> returns the default resume's markdown
  GET  /api/resumes         -> lists the bundled .md resumes in this folder
  GET  /api/resumes/<file>  -> returns one bundled resume's markdown
  POST /api/generate-pdf    -> body: { "markdown": "..." }
                                returns: application/pdf binary

Run (local):
  python app.py
  (listens on http://localhost:5001)

Run (production):
  gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60

Environment:
  ALLOWED_ORIGINS   comma-separated origins allowed to call the API
                    (default: http://localhost:5173)
"""

import io
import os

from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
from pdf_generator import build_pdf
from resume_parser import parse_resume_markdown

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # reject request bodies over 1 MB

ALLOWED_ORIGINS = [
    o.strip().rstrip("/")
    for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_RESUME_FILE = "resume_mastercard_da.md"
DEFAULT_RESUME_PATH = os.path.join(BASE_DIR, DEFAULT_RESUME_FILE)


def _bundled_resume_files():
    return sorted(f for f in os.listdir(BASE_DIR) if f.endswith(".md"))


def _resume_label(filename: str) -> str:
    """resume_mastercard_da.md -> "Mastercard DA", pawan_resume.md -> "Pawan"."""
    stem = filename[: -len(".md")]
    words = [w for w in stem.split("_") if w and w.lower() != "resume"] or [stem]
    return " ".join(w.upper() if len(w) <= 2 else w.capitalize() for w in words)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/sample")
def sample():
    with open(DEFAULT_RESUME_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    return jsonify({"markdown": content})


@app.get("/api/resumes")
def list_resumes():
    files = _bundled_resume_files()
    return jsonify(
        {
            "resumes": [{"file": f, "label": _resume_label(f)} for f in files],
            "default": DEFAULT_RESUME_FILE if DEFAULT_RESUME_FILE in files else None,
        }
    )


@app.get("/api/resumes/<filename>")
def get_resume(filename):
    # Only serve names from the directory listing, so the URL can't escape BASE_DIR.
    if filename not in _bundled_resume_files():
        return jsonify({"error": "resume not found"}), 404
    with open(os.path.join(BASE_DIR, filename), "r", encoding="utf-8") as f:
        content = f.read()
    return jsonify({"file": filename, "markdown": content})


@app.post("/api/generate-pdf")
def generate_pdf():
    payload = request.get_json(silent=True) or {}
    markdown_text = payload.get("markdown", "")

    if not markdown_text.strip():
        return jsonify({"error": "markdown content is empty"}), 400

    try:
        resume_data = parse_resume_markdown(markdown_text)
        pdf_bytes = build_pdf(resume_data)
    except Exception:  # noqa: BLE001 - log details, return a generic message
        app.logger.exception("PDF generation failed")
        return (
            jsonify({"error": "Failed to generate PDF. Check the markdown format."}),
            500,
        )

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="resume.pdf",
    )


@app.errorhandler(413)
def payload_too_large(_err):
    return jsonify({"error": "Resume is too large (max 1 MB)."}), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
