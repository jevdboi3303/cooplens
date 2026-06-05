"""
Gemini-powered scoring pipeline — inspired by career-ops 6-block evaluation.

Signals:
  cv_match      — How well the JD aligns with the resume (skills, experience, proof points)
  role_clarity  — Posting quality: specificity, salary, requirements, no red flags
  company       — Company quality via Clearbit (size + funding stage)

Weights: cv_match 45%, role_clarity 30%, company 25%

Gemini Flash 2.0 is used for semantic CV↔JD evaluation and red flag detection.
Falls back to TF-IDF if the API is unavailable.
"""

import os
import json
import re
import httpx

from dataclasses import dataclass, field
from .company_enricher import enrich_company
from .embedder import embed, cosine_similarity  # TF-IDF fallback

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent?key={key}"
)

WEIGHT_CV      = 0.45
WEIGHT_CLARITY = 0.30
WEIGHT_COMPANY = 0.25


@dataclass
class ScoreResult:
    score_total:    float
    score_cv:       float
    score_clarity:  float
    score_company:  float
    red_flags:      list  = field(default_factory=list)
    role_archetype: str   = ""
    recommendation: str   = ""
    company_meta:   dict  = field(default_factory=dict)


# ── Gemini evaluation ─────────────────────────────────────────────────────────

EVAL_PROMPT = """You are evaluating a co-op/internship job posting for a university student.

=== RESUME ===
{resume_text}

=== JOB POSTING ===
Title: {title}
Company: {company}
Description:
{description}

Evaluate this posting and respond with ONLY valid JSON (no markdown, no explanation):

{{
  "cv_match": <integer 0-100, how well the student's resume matches this posting>,
  "role_clarity": <integer 0-100, how clear and specific the posting is>,
  "red_flags": [<list of short strings, each a concern or warning, empty if none>],
  "role_archetype": <one of: "Software Engineering", "Data/ML", "Research", "DevOps/Cloud", "Design/UX", "Business/Ops", "Other">,
  "recommendation": <one of: "Strong apply", "Worth applying", "Maybe", "Skip">,
  "reasoning": <one sentence explaining the cv_match score>
}}

cv_match scoring guide:
- 85-100: Resume directly matches required skills and experience level
- 70-84: Good overlap, 1-2 skill gaps that are learnable
- 50-69: Partial match, significant gaps but transferable skills exist
- 30-49: Weak match, different domain but some overlap
- 0-29: Minimal relevance to the student's background

role_clarity scoring guide:
- 80-100: Specific tech stack, clear responsibilities, salary mentioned, well-structured
- 60-79: Good detail but missing some specifics (e.g. no salary)
- 40-59: Vague responsibilities or generic requirements
- 0-39: Very generic, no tech stack, boilerplate language

red_flags examples: "No salary mentioned", "Requires 5+ years (co-op role)", "Very vague responsibilities", "No specific tech stack", "Reposted multiple times"
"""


async def gemini_evaluate(resume_text: str, title: str, company: str, description: str) -> dict | None:
    if not GEMINI_API_KEY:
        return None
    prompt = EVAL_PROMPT.format(
        resume_text=resume_text[:3000],  # cap to save tokens
        title=title,
        company=company,
        description=description[:4000],
    )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                GEMINI_URL.format(key=GEMINI_API_KEY),
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 512},
                },
            )
            resp.raise_for_status()
            raw = resp.json()
            text = raw["candidates"][0]["content"]["parts"][0]["text"]
            # Strip markdown fences if present
            text = re.sub(r"```(?:json)?\s*|\s*```", "", text).strip()
            return json.loads(text)
    except Exception as e:
        print(f"[scorer] Gemini error: {e}")
        return None


# ── Clarity heuristics (fallback + supplement) ────────────────────────────────

_SALARY_RE = re.compile(
    r"(\$[\d,]+|\d[\d,]+\s*(k|K|usd|cad|per\s+hour|/hr|/year|/h\b))",
    re.IGNORECASE,
)
_VAGUE_RE = re.compile(
    r"\b(fast[\s-]?paced|passionate|rock\s*star|ninja|guru|wizard|"
    r"synergy|thought\s+leader|other\s+duties\s+as\s+assigned)\b",
    re.IGNORECASE,
)
_BULLET_RE = re.compile(r"^[\s]*[-•*]\s+.+", re.MULTILINE)


def _heuristic_clarity(text: str) -> float:
    score = 0.0
    if _SALARY_RE.search(text):          score += 25
    words = len(text.split())
    score += min(30, 30 * max(0, words - 80) / 170)
    bullets = len(_BULLET_RE.findall(text))
    score += min(25, bullets / 4 * 25)
    if re.search(r"\b(requirements?|qualifications?|you (will|should|must))\b", text, re.I):
        score += 10
    score -= min(20, len(_VAGUE_RE.findall(text)) * 5)
    if not re.search(r"\b(python|java|javascript|sql|react|aws|docker|git|typescript|go|c\+\+)\b", text, re.I):
        score -= 10
    return max(0.0, min(100.0, score))


# ── TF-IDF fallback for cv_match ──────────────────────────────────────────────

def _tfidf_cv_match(resume_embedding: list[float], posting_text: str) -> float:
    posting_emb = embed(posting_text)
    sim = cosine_similarity(resume_embedding, posting_emb)
    return max(0.0, min(100.0, (sim - 0.2) / 0.6 * 100))


# ── Public API ────────────────────────────────────────────────────────────────

async def score_posting(
    *,
    posting_text: str,
    title: str = "",
    company_name: str = "",
    resume_text: str = "",
    resume_embedding: list[float],
) -> ScoreResult:

    # Run Gemini eval + company enrichment in parallel
    import asyncio
    gemini_task = asyncio.create_task(
        gemini_evaluate(resume_text, title, company_name, posting_text)
    )
    company_task = asyncio.create_task(enrich_company(company_name))

    gemini_result, company_meta = await asyncio.gather(gemini_task, company_task)

    # CV match
    if gemini_result and "cv_match" in gemini_result:
        s_cv = float(gemini_result["cv_match"])
    else:
        s_cv = _tfidf_cv_match(resume_embedding, posting_text)

    # Role clarity
    if gemini_result and "role_clarity" in gemini_result:
        s_clarity = float(gemini_result["role_clarity"])
    else:
        s_clarity = _heuristic_clarity(posting_text)

    s_company = company_meta["company_score"]

    total = round(
        WEIGHT_CV * s_cv +
        WEIGHT_CLARITY * s_clarity +
        WEIGHT_COMPANY * s_company,
        1,
    )

    return ScoreResult(
        score_total    = min(100.0, total),
        score_cv       = round(s_cv, 1),
        score_clarity  = round(s_clarity, 1),
        score_company  = round(s_company, 1),
        red_flags      = gemini_result.get("red_flags", []) if gemini_result else [],
        role_archetype = gemini_result.get("role_archetype", "") if gemini_result else "",
        recommendation = gemini_result.get("recommendation", "") if gemini_result else "",
        company_meta   = company_meta,
    )
