"""
Scoring pipeline: combines three independent signals into a 0–100 composite.

    score_stack   — how well the posting's tech stack matches the resume
    score_company — company quality via Clearbit enrichment
    score_clarity — posting quality (salary, specificity, length, vague-lang penalty)

Weights: stack 40 %, company 30 %, clarity 30 %
"""

import re
from dataclasses import dataclass

from .embedder import cosine_similarity, embed
from .company_enricher import enrich_company

# ── clarity heuristics ──────────────────────────────────────────────────────

_SALARY_RE = re.compile(
    r"(\$[\d,]+|\d[\d,]+\s*(k|K|usd|cad|per\s+hour|/hr|/year))",
    re.IGNORECASE,
)

_VAGUE_PHRASES = [
    r"\bfast[\s-]?paced\b",
    r"\bpassionate\b",
    r"\brock\s*star\b",
    r"\bninja\b",
    r"\bguru\b",
    r"\bwizard\b",
    r"\bexcited\b",
    r"\bteam\s+player\b",
    r"\bself[\s-]?starter\b",
    r"\bgo[\s-]getter\b",
    r"\bsynergy\b",
    r"\bthought\s+leader\b",
    r"\bvarious\s+duties\b",
    r"\bother\s+duties\s+as\s+assigned\b",
]
_VAGUE_RE = re.compile("|".join(_VAGUE_PHRASES), re.IGNORECASE)

_BULLET_RE = re.compile(r"^[\s]*[-•*]\s+.+", re.MULTILINE)

_MIN_WORDS = 80
_GOOD_WORDS = 250
_GOOD_BULLETS = 4


def _clarity_score(posting_text: str) -> float:
    score = 0.0

    # Salary presence: +25
    if _SALARY_RE.search(posting_text):
        score += 25

    # Word count: up to +30
    word_count = len(posting_text.split())
    if word_count >= _GOOD_WORDS:
        score += 30
    elif word_count >= _MIN_WORDS:
        score += 30 * (word_count - _MIN_WORDS) / (_GOOD_WORDS - _MIN_WORDS)

    # Bullet-point specificity: up to +25
    bullets = len(_BULLET_RE.findall(posting_text))
    score += min(25, bullets / _GOOD_BULLETS * 25)

    # Requirements section present: +10
    if re.search(r"\b(requirements?|qualifications?|you (will|should|must))\b",
                 posting_text, re.IGNORECASE):
        score += 10

    # Vague language penalty: –5 per hit, max –20
    vague_hits = len(_VAGUE_RE.findall(posting_text))
    score -= min(20, vague_hits * 5)

    # Duties-only penalty (no tech stack mentioned): –10
    tech_terms = re.findall(
        r"\b(python|java|javascript|sql|react|aws|docker|kubernetes|git|"
        r"typescript|go|rust|c\+\+)\b",
        posting_text, re.IGNORECASE,
    )
    if not tech_terms:
        score -= 10

    return max(0.0, min(100.0, score))


# ── stack match ──────────────────────────────────────────────────────────────

def _stack_score(resume_embedding: list[float], posting_text: str) -> float:
    posting_embedding = embed(posting_text)
    sim = cosine_similarity(resume_embedding, posting_embedding)
    # cosine similarity in [-1, 1] → map to [0, 100]
    # In practice embeddings are non-negative after normalize; scale [0.2, 0.8] → [0, 100]
    normalized = (sim - 0.2) / 0.6
    return max(0.0, min(100.0, normalized * 100))


# ── public API ───────────────────────────────────────────────────────────────

@dataclass
class ScoreResult:
    score_stack: float
    score_company: float
    score_clarity: float
    score_total: float
    company_meta: dict


WEIGHT_STACK = 0.40
WEIGHT_COMPANY = 0.30
WEIGHT_CLARITY = 0.30


async def score_posting(
    *,
    posting_text: str,
    company_name: str,
    resume_embedding: list[float],
) -> ScoreResult:
    s_stack = _stack_score(resume_embedding, posting_text)
    s_clarity = _clarity_score(posting_text)

    company_meta = await enrich_company(company_name)
    s_company = company_meta["company_score"]

    total = round(
        WEIGHT_STACK * s_stack
        + WEIGHT_COMPANY * s_company
        + WEIGHT_CLARITY * s_clarity,
        1,
    )

    return ScoreResult(
        score_stack=round(s_stack, 1),
        score_company=round(s_company, 1),
        score_clarity=round(s_clarity, 1),
        score_total=min(100.0, total),
        company_meta=company_meta,
    )
