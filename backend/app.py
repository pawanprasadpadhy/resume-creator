"""
app.py

Flask backend for the Resume Creator project.

Endpoints:
  GET  /api/health          -> simple health check
  GET  /api/sample          -> returns the default pawan_resume.md content
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
DEFAULT_RESUME_PATH = os.path.join(BASE_DIR, "resume_mastercard_da.md")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/sample")
def sample():
    with open(DEFAULT_RESUME_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    return jsonify({"markdown": content})


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
