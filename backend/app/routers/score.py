from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import Resume
from ..auth_utils import verify_token
from ..services.scorer import score_posting

router = APIRouter(prefix="/score", tags=["score"])


class PostingInput(BaseModel):
    posting_id: str
    title: str
    company_name: str
    description: str


class SingleScoreRequest(BaseModel):
    posting: PostingInput


def _get_resume(db: Session, user_id: str) -> Resume:
    resume = (
        db.query(Resume)
        .filter(Resume.user_id == user_id)
        .order_by(Resume.uploaded_at.desc())
        .first()
    )
    if not resume or not resume.embedding:
        raise HTTPException(
            status_code=400,
            detail="No resume on file — upload one via /users/resume",
        )
    return resume


@router.post("/single")
async def score_single(
    body: SingleScoreRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    from ..models import User
    resume = _get_resume(db, claims["sub"])
    user   = db.get(User, claims["sub"])
    result = await score_posting(
        posting_text=body.posting.description,
        title=body.posting.title,
        company_name=body.posting.company_name,
        resume_text=resume.raw_text or "",
        resume_embedding=resume.embedding,
        faculty=user.faculty or "" if user else "",
    )
    return {
        "posting_id":    body.posting.posting_id,
        "score_total":   result.score_total,
        "score_cv":      result.score_cv,
        "score_clarity": result.score_clarity,
        "score_company": result.score_company,
        "red_flags":     result.red_flags,
        "role_archetype":result.role_archetype,
        "recommendation":result.recommendation,
        "company_meta":  result.company_meta,
    }
