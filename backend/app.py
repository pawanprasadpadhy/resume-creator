"""
app.py

Flask backend for the Resume Creator project.

Endpoints:
  GET  /api/health          -> simple health check
  GET  /api/sample          -> returns the default pawan_resume.md content
  POST /api/generate-pdf    -> body: { "markdown": "..." }
                                returns: application/pdf binary

Run:
  python app.py
  (listens on http://localhost:5001)
"""

import io
import os

from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
from pdf_generator import build_pdf
from resume_parser import parse_resume_markdown

app = Flask(__name__)
CORS(app)  # allow the Vite dev server (different port) to call this API

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_RESUME_PATH = os.path.join(BASE_DIR, "pawan_resume.md")


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
    except Exception as exc:  # noqa: BLE001 - surface parse/render errors to the UI
        return jsonify({"error": f"Failed to generate PDF: {exc}"}), 500

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="resume.pdf",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
