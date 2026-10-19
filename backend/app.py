"""
app.py

Flask backend for the Resume Creator project.

Endpoints:
  GET  /api/health          -> simple health check
  GET  /api/sample          -> returns the default resume's markdown
  GET  /api/access          -> { "owner": bool } for the X-Access-Key header
  GET  /api/resumes         -> lists the bundled .md resumes visible to the caller
  GET  /api/resumes/<file>  -> returns one visible bundled resume's markdown
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
  PUBLIC_RESUMES    comma-separated .md files anyone can load
                    (default: sample_resume.md)
  OWNER_ACCESS_KEY  secret that unlocks every bundled resume when sent as the
                    X-Access-Key header. Unset -> only PUBLIC_RESUMES are
                    served, except under `python app.py` (debug), where the
                    local developer is treated as the owner.
"""

import hmac
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

PUBLIC_RESUMES = [
    f.strip()
    for f in os.environ.get("PUBLIC_RESUMES", "sample_resume.md").split(",")
    if f.strip()
]
OWNER_ACCESS_KEY = os.environ.get("OWNER_ACCESS_KEY", "")


def _is_owner() -> bool:
    if not OWNER_ACCESS_KEY:
        return app.debug
    provided = request.headers.get("X-Access-Key", "")
    return hmac.compare_digest(provided.encode(), OWNER_ACCESS_KEY.encode())


def _bundled_resume_files():
    return sorted(f for f in os.listdir(BASE_DIR) if f.endswith(".md"))


def _visible_resume_files():
    files = _bundled_resume_files()
    if _is_owner():
        return files
    return [f for f in files if f in PUBLIC_RESUMES]


def _default_resume_file(files):
    if DEFAULT_RESUME_FILE in files:
        return DEFAULT_RESUME_FILE
    return files[0] if files else None


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
    filename = _default_resume_file(_visible_resume_files())
    if not filename:
        return jsonify({"error": "no resumes available"}), 404
    with open(os.path.join(BASE_DIR, filename), "r", encoding="utf-8") as f:
        content = f.read()
    return jsonify({"markdown": content})


@app.get("/api/access")
def access():
    return jsonify({"owner": _is_owner()})


@app.get("/api/resumes")
def list_resumes():
    files = _visible_resume_files()
    return jsonify(
        {
            "resumes": [{"file": f, "label": _resume_label(f)} for f in files],
            "default": _default_resume_file(files),
        }
    )


@app.get("/api/resumes/<filename>")
def get_resume(filename):
    # Only serve names from the visible listing: this keeps private resumes
    # private and stops the URL escaping BASE_DIR.
    if filename not in _visible_resume_files():
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
