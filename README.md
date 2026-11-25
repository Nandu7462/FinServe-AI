# FinServe AI

FinServe AI is an independent workspace for preparing and reviewing customer communications using HDFC Bank public sources. The catalog covers deposits, payment transfers, cheque services, credit card controls and digital banking security.

## Run locally

From the project directory in PowerShell, install the backend and build the frontend.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
npm --prefix frontend ci
npm --prefix frontend run build
.\.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open [FinServe AI](http://127.0.0.1:8000). On subsequent starts only the last command is needed. On macOS or Linux use `.venv/bin/python`. Node 22.12 or newer is required for the frontend. The Vite development server proxies API requests to port 8000.

## Host an evaluation on Render

The included `render.yaml` builds the React interface and serves it from FastAPI on one free Render web service. Use only public bank information for a shared evaluation. Several API routes, including draft history and customer preferences, currently accept requests without a signed-in staff session.

1. Create a free Neon PostgreSQL project for the evaluation. Copy its connection URL, change the prefix from `postgresql://` to `postgresql+psycopg://`, and keep its TLS parameters.
2. In Render, create a **Blueprint** from this repository. Enter the connection URL as `DATABASE_URL` and set a distinct password for each evaluation role in the prompted secret fields.
3. After deployment, open the Render service URL, select an evaluation profile and sign in. Create a draft from a public HDFC Bank source, restart the service and confirm the draft is still in the review history.

PostgreSQL stores workflow data, preferences and approved wording. The disk-backed Memento MCP integration is disabled on this host because the free web service's local disk is temporary. The default setup uses template drafting and direct source retrieval. Gemini and Firecrawl usage is billed or quota-limited separately by each provider.

## Prepare a communication

To load the HDFC communication drafts to the configured database, run `python -m backend.load_drafts` from the repository root with the backend environment active. The loader checks each banking passage against HDFC Bank's page before saving the set. Rerunning it preserves existing drafts and review decisions. The drafts appear in **My Drafts** and **Review Queue**. They do not create customer profiles or preapproved wording.

1. Open **Source library**. Select an existing notice or register a new one by entering its official URL, product, category and an exact customer-facing passage. Include the conditions and relevant dates. Registration checks the current document and stores the notice in the application database.
2. Choose **Use in draft**. Select a tone, or save and select a customer reference with its preferred channel and tone. The agent retrieves the source again, checks the passage, recalls approved wording and asks Gemini for the surrounding language. It inserts the source facts into the message. When a passage changes, the workspace flags the draft for source review.
3. Compare the result with the source snapshot. Edit the draft, enter a reviewer name and approve or reject it. An approval must preserve the verified statement. A reviewer may also save general wording for future communications about the same institution and product.
4. Reopen a decision in **Review history**. Approved messages have a text download for use in the institution's delivery system. The local workspace records the reviewer name and decision. Access control for a shared deployment and delivery to customers belong in the institution's systems.

## Configure live sources and providers

Settings are read from the project-root `.env` on startup. Create it from `.env.example` on a fresh installation and keep credentials local.

| Setting | Use |
| --- | --- |
| `GEMINI_API_KEY` | Enables Gemini drafting. Without a key, the studio labels the template generator. |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash-lite`. Select a model supporting structured JSON output. |
| `SOURCE_RETRIEVER` | Use `direct` for HTTPS HTML and text-based PDFs up to 10 MB. Use `firecrawl` with a working `FIRECRAWL_API_KEY` for fresh Markdown retrieval. Configure the final URL after any redirect. |
| `LIVE_NOTICES_FILE` | Defaults to `notices.json`. Only HDFC Bank entries with allowed official URLs are loaded. |
| `DATABASE_URL` | Defaults to local SQLite in `hdfc-finserve.db`. To use PostgreSQL, provision a database and supply its `postgresql+psycopg://` URL. Tables are created on startup. Switching the URL selects a separate data store. |

Register new notices using a final HTTPS document URL on hdfc.bank.in or hdfcbank.com (including www) and an exact customer-facing statement. The server checks the source again at drafting time. Approvals and preferences start empty and accumulate through the workflow.

The HDFC workspace uses dedicated database tables. Earlier multi-bank records are preserved outside this workspace. Role logins configured with the existing password settings use application-local identifiers. They do not identify HDFC Bank employees.

## Local memory

The application database stores preferences and reviewer-approved wording. Enable Memento to write these records to a dedicated local memory database and recall approved language by institution and product. A failed Memento write is reported in the workspace and the local decision persists.

Use Node 24 for Memento's native database dependency. Run the following in the project directory with Node 24 active.

```powershell
npx -y @psraghuveer/memento@0.9.2 init --no-prompt --db hdfc-memory.db
```

Set `MEMENTO_ENABLED=1` and `MEMENTO_DB=hdfc-memory.db`. The default command uses npx. To use an isolated installation, set `MEMENTO_COMMAND` to its Node executable and `MEMENTO_ARGS` to a JSON array containing the installed CLI path and `serve`.

## Project layout

- `backend/main.py` provides the workflow, database operations, review and export endpoints.
- `backend/sources.py` retrieves configured official documents and extracts readable text.
- `backend/providers.py` integrates Gemini, Firecrawl and the Memento MCP server.
- `frontend/src/` contains the draft studio, source library and review history.
- FastAPI serves the built frontend and exposes the [API documentation](http://127.0.0.1:8000/docs).
