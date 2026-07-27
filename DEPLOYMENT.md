# ParentCare — Deployment Runbook

From-scratch guide to deploy ParentCare to the web. Reproduce it, hand it off,
or recover from scratch.

**Architecture:** Next.js frontend on **Vercel** + FastAPI/ChromaDB backend on
**Render**. User data lives in the browser (Dexie/IndexedDB) — no database to host.

- Frontend repo: `ronronnie/AI-Health-tracking-for-the-elderly` (this repo)
- Backend repo: `ronronnie/Backend-for-AI-Health-Lab` (`~/Desktop/AI_Health_Lab`)
- Live frontend: https://ai-health-tracking-for-the-elderly.vercel.app
- Live backend: https://backend-for-ai-health-lab.onrender.com (health: `/api/health`)

---

## Phase 0 — Prerequisites
- [ ] Anthropic API key (console.anthropic.com)
- [ ] GitHub account (`ronronnie`)
- [ ] Vercel account + Render account (both sign in with GitHub)
- [ ] Set a **spend cap** on the Anthropic key (public demo = anyone can burn credits)

## Phase 1 — Backend → GitHub (`~/Desktop/AI_Health_Lab`)
- [ ] Ensure deploy files exist: `Dockerfile`, `requirements.txt` (pinned —
      `chromadb==1.5.9`, `pdfplumber`), `render.yaml`, `.gitignore`, `.dockerignore`
- [ ] `git init` → commit → push to `git@github.com:ronronnie/Backend-for-AI-Health-Lab.git`
- [ ] ⚠️ Use the **SSH** remote, not HTTPS (HTTPS 403s due to cached `ronniesubmittable` creds)

## Phase 2 — Deploy Backend on Render
- [ ] New → **Web Service** → connect the backend repo → Runtime = **Docker**, Instance = **Free**
- [ ] Env vars: `ANTHROPIC_API_KEY`, and `CORS_ORIGINS` (leave blank for now)
- [ ] Deploy → verify:
      `curl https://backend-for-ai-health-lab.onrender.com/api/health`
      returns `{"status":"ok","corpus_chunks":79,...}`

## Phase 3 — Deploy Frontend on Vercel
- [ ] Add New → Project → import `AI-Health-tracking-for-the-elderly` (auto-detects Next.js)
- [ ] Env vars:
  - `NEXT_PUBLIC_BACKEND_URL` = `https://backend-for-ai-health-lab.onrender.com`
  - `ANTHROPIC_API_KEY` = your key (used only by the fallback route `src/app/api/parse`)
- [ ] Deploy → note the live URL

## Phase 4 — Close the CORS loop ⚠️ (uploads fail without this)
- [ ] Render → Environment → set `CORS_ORIGINS` = `https://ai-health-tracking-for-the-elderly.vercel.app`
- [ ] **No trailing slash** — CORS origin matching is exact
- [ ] Save → wait for auto-redeploy (~1 min)

## Phase 5 — Verify end-to-end
- [ ] Open the Vercel URL → add a parent → upload a lab report (PDF + image)
- [ ] Confirm it parses with RAG citations
- [ ] (Optional) Vercel → Settings → turn off the **Vercel Toolbar** for Production

---

## Environment variables

### Backend (Render)
| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ANTHROPIC_API_KEY` | yes | — | Claude API access |
| `CORS_ORIGINS` | prod | — | Comma-separated allowed frontend origins (exact, no trailing slash) |
| `RATE_LIMIT_MAX` | no | `10` | Max uploads per IP per window |
| `RATE_LIMIT_WINDOW_SECONDS` | no | `3600` | Rate-limit window |
| `PORT` | no | `8000` | Injected by Render automatically |

### Frontend (Vercel)
| Var | Required | Purpose |
|-----|----------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | yes | Base URL of the Render backend |
| `ANTHROPIC_API_KEY` | yes | Fallback Next.js parse route only |

---

## Known gotchas (all fixed — kept for reference)

| Symptom | Cause | Fix |
|---|---|---|
| Docker build fails, `__call__() missing 'input'` | Extra `()` in embedder warmup | `ef = DefaultEmbeddingFunction(); ef([...])` |
| "pdfplumber not installed" | Lazy import missing from requirements | Added `pdfplumber==0.11.8` |
| "Unterminated string" on large reports | Parser `max_tokens=8192` truncated JSON | Raised to 16000 + `stop_reason` guard |
| Upload CORS-blocked (400, no allow-origin) | `CORS_ORIGINS` unset or had trailing slash | Exact Vercel URL, no slash |
| First request slow (~30–60s) | Render free tier sleeps when idle | Expected; upgrade plan to avoid |

## Notes
- `chromadb` must stay pinned to `1.5.9` — it must match the on-disk corpus
  format in `rag/chroma_db/` (committed to the backend repo, ~2 MB, 79 chunks).
- The frontend's active parse flow calls the Python backend
  (`src/lib/services/api.ts`). The built-in `src/app/api/parse` route is a
  self-contained fallback (Anthropic direct, no RAG citations).
