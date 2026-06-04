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


class BatchScoreRequest(BaseModel):
    postings: list[PostingInput]


def _get_resume_embedding(db: Session, user_id: str) -> list[float]:
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
    return resume.embedding


@router.post("/single")
async def score_single(
    body: SingleScoreRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    embedding = _get_resume_embedding(db, claims["sub"])
    posting_text = f"{body.posting.title}\n{body.posting.description}"
    result = await score_posting(
        posting_text=posting_text,
        company_name=body.posting.company_name,
        resume_embedding=embedding,
    )
    return {
        "posting_id": body.posting.posting_id,
        "score_total": result.score_total,
        "score_stack": result.score_stack,
        "score_company": result.score_company,
        "score_clarity": result.score_clarity,
        "company_meta": result.company_meta,
    }


@router.post("/batch")
async def score_batch(
    body: BatchScoreRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    if len(body.postings) > 50:
        raise HTTPException(status_code=400, detail="Max 50 postings per batch")

    embedding = _get_resume_embedding(db, claims["sub"])
    results = []
    for posting in body.postings:
        posting_text = f"{posting.title}\n{posting.description}"
        result = await score_posting(
            posting_text=posting_text,
            company_name=posting.company_name,
            resume_embedding=embedding,
        )
        results.append({
            "posting_id": posting.posting_id,
            "score_total": result.score_total,
            "score_stack": result.score_stack,
            "score_company": result.score_company,
            "score_clarity": result.score_clarity,
        })
    return {"scores": results}
