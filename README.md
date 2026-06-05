# CoopLens

> AI-powered co-op job scorer for UVic students. Score postings in real time, see red flags, track deadlines, and apply smarter.

![CoopLens Score Panel](https://cooplens.vercel.app/og.png)

## What it does

CoopLens is a Chrome extension that sits on top of the UVic co-op portal ([learninginmotion.uvic.ca](https://learninginmotion.uvic.ca)). When you open a job posting, it injects a score panel powered by **Llama 3.3 70B** that tells you:

- **CV Match** — how well the posting aligns with *your* resume, semantically
- **Company quality** — size and funding stage
- **Posting clarity** — salary transparency, specificity, structured requirements
- **Recommendation** — Strong apply / Worth applying / Maybe / Skip
- **Red flags** — vague responsibilities, missing salary, security clearance requirements, etc.
- **Keyword gap** — which skills from the posting your resume covers, and which to add

---

## Stack

| Layer | Tech |
|---|---|
| **Extension** | Manifest V3, vanilla JS modules, Chrome storage API |
| **Backend** | FastAPI, SQLAlchemy, Supabase Postgres |
| **Scoring** | Llama 3.3 70B via Groq API |
| **Auth** | Supabase (email/password) |
| **Dashboard** | Vite + React + Tailwind + Recharts |
| **Deployment** | Railway (backend) · Vercel (dashboard) |

---

## Project structure

```
cooplens/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── routers/          # auth, users, score, outcomes, insights
│   │   ├── services/         # scorer (Groq), embedder (TF-IDF), company enricher
│   │   └── models.py         # User, Resume, Outcome
│   ├── main.py
│   └── requirements.txt
├── extension/                # Chrome extension (MV3)
│   ├── manifest.json
│   ├── background.js         # Service worker, token refresh, API relay
│   ├── content.js            # Detail page scorer, badge injection
│   ├── popup.js              # Dashboard popup
│   └── src/
│       ├── api.js            # Supabase auth + backend API calls
│       └── storage.js        # History, shortlist, watchlist, compare
└── dashboard/                # React dashboard
    └── src/
        ├── pages/            # Overview, Postings, Outcomes, Stats, Insights, Privacy
        ├── hooks/            # useAuth, useOutcomes
        └── components/       # ScoreBadge, SignalBar, Sidebar
```

---

## Scoring logic

Each posting is scored across three signals (0–100) using Llama 3.3 70B:

| Signal | Weight | How |
|---|---|---|
| **CV Match** | 45% | LLM reads your resume + full JD, scores semantic alignment |
| **Posting Clarity** | 30% | LLM evaluates specificity, salary, structure, red flags |
| **Company Quality** | 25% | Clearbit enrichment (size band + funding stage) |

Faculty calibration adjusts LLM weighting — a CS student and a Biology student get different skill emphasis on the same posting.

**Fallback:** If the Groq API is unavailable, CV Match falls back to TF-IDF cosine similarity and Clarity uses NLP heuristics.

---

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload --env-file .env
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

**Required env vars:**
```
DATABASE_URL=postgresql://...         # Supabase pooler connection string
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
GROQ_API_KEY=gsk_...                  # free at console.groq.com
CLEARBIT_API_KEY=                     # optional, improves company scores
```

### Dashboard

```bash
cd dashboard
npm install
cp .env.example .env.local   # fill in Supabase + API URL
npm run dev
# → http://localhost:5173
```

### Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Click the CoopLens icon → sign up → upload your resume PDF
5. Navigate to `learninginmotion.uvic.ca` → open any posting

---

## Features

### Extension popup
- Stats dashboard (postings scored, avg score, starred count)
- **Recent** tab — last 8 scored postings
- **★ Starred** tab — bookmarked postings
- **🔔 Watch** tab — postings with deadline countdown
- **↔ Compare** tab — side-by-side comparison (up to 3)
- **💡 Insights** tab — Llama-generated skill suggestions based on your faculty + resume

### Detail panel (injected on each posting)
- Score badge + recommendation banner
- CV Match / Company / Clarity signal cards
- Red flags section
- Keyword gap analysis (covered vs missing skills)
- Company research card (division, location, work term, deadline)
- Action buttons: Star · Watch · Mark Applied · Compare

### Dashboard (cooplens.vercel.app)
- Overview with stats and signal averages
- Postings history (sortable, searchable, expandable)
- Outcomes tracker with offer tracking
- Stats charts (radar, distribution, company bar, scatter)
- CSV export

---

## Architecture notes

**Why the background service worker does API calls instead of the content script:**
The content script runs in an `https://` page context. Chrome blocks HTTP requests from HTTPS pages (mixed content). The background service worker bypasses this restriction, so the content script sends messages to background.js which makes the actual fetch.

**Why TF-IDF instead of sentence-transformers in production:**
`all-MiniLM-L6-v2` (90MB) used ~1GB RAM and pinned Railway's free tier CPU at 180% indefinitely. TF-IDF (scikit-learn) uses ~5MB and starts instantly. The LLM call via Groq provides the semantic understanding that TF-IDF lacks.

**Token refresh:**
Supabase access tokens expire after 1 hour. The extension stores both `access_token` and `refresh_token`, tracks expiry, and silently refreshes via the background service worker every 45 minutes.

---

## Deployment

| Service | Config |
|---|---|
| **Railway** | Root dir: `backend/`, start: `uvicorn main:app --host 0.0.0.0 --port 8000` |
| **Vercel** | Root dir: `dashboard/`, framework: Vite, output: `dist/` |

---

## Roadmap

- [ ] Clearbit integration for real company quality scores
- [ ] Interview likelihood predictor (logistic regression on outcome data)
- [ ] Firefox extension (AMO)
- [ ] Company research panel (Glassdoor/LinkedIn data)
- [ ] Resume suggestions based on most common skill gaps across viewed postings

---

## License

MIT
