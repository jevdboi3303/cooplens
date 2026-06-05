"""
Insights endpoints:
  GET /insights/keyword-suggestions   — skills to add to resume
  GET /insights/interview-rate        — score threshold + interview rate stats
"""

import os
import re
import json
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Resume, Outcome
from ..auth_utils import verify_token

router = APIRouter(prefix="/insights", tags=["insights"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"


# ── Keyword suggestions ───────────────────────────────────────────────────────

@router.get("/keyword-suggestions")
async def keyword_suggestions(
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    user   = db.get(User, claims["sub"])
    resume = (
        db.query(Resume)
        .filter(Resume.user_id == claims["sub"])
        .order_by(Resume.uploaded_at.desc())
        .first()
    )
    if not resume:
        return {"suggestions": [], "reason": "No resume on file"}

    current_skills = resume.skills or []
    faculty = (user.faculty or "General") if user else "General"

    if not GROQ_API_KEY:
        return {"suggestions": [], "reason": "LLM not configured"}

    prompt = f"""A university co-op student studying {faculty} has these skills on their resume:
{", ".join(current_skills) if current_skills else "No skills listed yet"}

Based on their program and current skills, suggest the 8 most impactful skills they should add to their resume to improve co-op competitiveness. Prioritise skills that are:
1. Commonly required in {faculty}-related co-op postings
2. Not already on their resume
3. Learnable within 1-2 months

Respond with ONLY valid JSON (no markdown):
{{
  "suggestions": [
    {{"skill": "skill name", "reason": "one sentence why this matters for their field", "priority": "high|medium|low"}},
    ...
  ]
}}"""

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "max_tokens": 600,
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"].strip()
            text = re.sub(r"```(?:json)?\s*|\s*```", "", text).strip()
            data = json.loads(text)
            return data
    except Exception as e:
        return {"suggestions": [], "reason": f"Error: {e}"}


# ── Interview rate predictor ──────────────────────────────────────────────────

@router.get("/interview-rate")
async def interview_rate(
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    outcomes = (
        db.query(Outcome)
        .filter(
            Outcome.user_id == claims["sub"],
            Outcome.got_interview != None,
            Outcome.score_total != None,
        )
        .all()
    )

    if len(outcomes) < 3:
        return {
            "enough_data": False,
            "data_points": len(outcomes),
            "message": f"Need at least 3 outcomes with interview results — you have {len(outcomes)}",
        }

    # Bucket by score range
    buckets = {
        "0-40":  {"interviews": 0, "total": 0},
        "40-55": {"interviews": 0, "total": 0},
        "55-70": {"interviews": 0, "total": 0},
        "70+":   {"interviews": 0, "total": 0},
    }

    def bucket(s):
        if s < 40:  return "0-40"
        if s < 55:  return "40-55"
        if s < 70:  return "55-70"
        return "70+"

    for o in outcomes:
        b = bucket(o.score_total)
        buckets[b]["total"] += 1
        if o.got_interview:
            buckets[b]["interviews"] += 1

    result = {}
    for label, data in buckets.items():
        if data["total"] > 0:
            result[label] = {
                "interview_rate": round(data["interviews"] / data["total"] * 100),
                "count": data["total"],
            }

    # Find the score threshold above which interview rate > 50%
    all_with_interview = [(o.score_total, o.got_interview) for o in outcomes]
    all_with_interview.sort(key=lambda x: x[0])
    threshold = None
    if len(all_with_interview) >= 5:
        # sliding window
        for i in range(len(all_with_interview) - 2):
            above = [x[1] for x in all_with_interview[i:]]
            if sum(above) / len(above) >= 0.5:
                threshold = round(all_with_interview[i][0], 1)
                break

    return {
        "enough_data": True,
        "data_points": len(outcomes),
        "buckets": result,
        "interview_threshold": threshold,
        "overall_rate": round(
            sum(1 for o in outcomes if o.got_interview) / len(outcomes) * 100
        ),
    }
