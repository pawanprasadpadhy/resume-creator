# Resume Creator

Edit your resume in a plain-text Markdown file, see a live preview as you type,
and click **Render / Generate PDF** to get an ATS-friendly PDF, generated in
Python with ReportLab (no browser or LaTeX dependency).

```
resume-creator/
├── backend/            Flask + ReportLab API
│   ├── app.py
│   ├── resume_parser.py
│   ├── pdf_generator.py
│   ├── sample_resume.md
│   └── requirements.txt
└── frontend/            React (Vite) app
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── MarkdownEditor.jsx
        │   ├── ResumePreview.jsx
        │   └── Toolbar.jsx
        └── utils/parseResume.js
```

## 1. Run the backend

```bash
cd backend
python3 -m venv resume-env
source resume-env/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The API runs at `http://localhost:5001`.

## 2. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The app talks to the backend at
`http://localhost:5001` by default — override with a `.env` file in
`frontend/` containing `VITE_API_BASE=http://your-backend-url` if needed.

## 3. Use it

1. Edit the markdown on the left (or **Import .md** an existing file).
2. Watch the live preview update on the right as you type.
3. Click **Render / Generate PDF** — the backend parses your markdown,
   renders it with ReportLab, and downloads `resume.pdf`.
4. **Export .md** any time to save your raw markdown source.

## Markdown format

The parser expects this structure (see `backend/sample_resume.md` for a full
example):

```markdown
# Your Full Name

email | phone | location | linkedin.com/in/you

## Summary

A short paragraph. Any section without ### subheadings or "- " bullets
is treated as a plain paragraph.

## Experience

### Job Title | Company | Location | Start - End

- Bullet point (measurable results are great for ATS scoring)
- Another bullet point

### Previous Job Title | Company | Location | Start - End

- Bullet point

## Education

### Degree | Institution | Location | Year

## Skills

- Languages: Python, JavaScript, SQL
- Tools: Git, Docker, AWS
```

Notes:

- `## ` starts a new section. Any heading name works (Summary, Experience,
  Education, Skills, Projects, Certifications, ...) — the parser infers
  whether it's a paragraph, a list, or a set of dated entries based on
  what's inside it.
- Inside a section, `### ` starts a dated entry (job, degree, project).
  Pipe-separate the header into `Title | Org | Location | Dates` — the
  first part is bold on the left, the last part is right-aligned as the
  date, and anything in between becomes an italic subtitle line.
- `- ` or `* ` bullets under an entry become bullet points; in a section
  with no `### ` entries, `- ` lines become a plain bulleted list (used
  for Skills/Certifications).
- Inline `**bold**` and `*italic*`/`_italic_` are supported everywhere.

## Matching a specific sample resume image

This project ships with a clean, standard single-column ATS layout. If you
have a specific resume image/template you want to match exactly, share it
and the fonts, spacing, section order, and header style in
`backend/pdf_generator.py` (and the mirrored CSS in
`frontend/src/index.css`) can be adjusted to replicate it precisely.

## Why ReportLab (and why this stays ATS-friendly)

- Single column, linear top-to-bottom / left-to-right reading order
- Core Helvetica fonts only — no embedded fonts, no images, no text boxes
- Section headers are real text, not graphics, so ATS parsers can read them
- The only `Table` usage is a borderless 2-column row for title/date
  alignment — visually easy to scan, and still extracts as plain text
