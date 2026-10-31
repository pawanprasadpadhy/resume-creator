# Private resumes

Everything in this folder except this README is git-ignored, so personal resumes never reach GitHub.

- **Locally:** drop `.md` resumes here. `python app.py` runs in debug mode and shows them without an access key.
- **Production (Render):** add each file under **Environment → Secret Files** (same filename), and set `PRIVATE_RESUMES_DIR=/etc/secrets`. They are only served to requests carrying the `OWNER_ACCESS_KEY` as `X-Access-Key`.

Resumes everyone may see go in `backend/public_resumes/` instead.
