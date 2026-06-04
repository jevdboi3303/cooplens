import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import Outcome
from ..auth_utils import verify_token

router = APIRouter(prefix="/outcomes", tags=["outcomes"])


class OutcomeRequest(BaseModel):
    posting_id: str
    company_name: str | None = None
    posting_title: str | None = None
    score_total: float | None = None
    score_stack: float | None = None
    score_company: float | None = None
    score_clarity: float | None = None
    got_interview: bool


class OutcomeUpdate(BaseModel):
    got_offer: bool


@router.post("/", status_code=201)
async def record_outcome(
    body: OutcomeRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    outcome = Outcome(
        id=str(uuid.uuid4()),
        user_id=claims["sub"],
        **body.model_dump(),
    )
    db.add(outcome)
    db.commit()
    return {"id": outcome.id}


@router.patch("/{outcome_id}")
async def update_outcome(
    outcome_id: str,
    body: OutcomeUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    outcome = db.get(Outcome, outcome_id)
    if not outcome or outcome.user_id != claims["sub"]:
        raise HTTPException(status_code=404, detail="Outcome not found")
    outcome.got_offer = body.got_offer
    db.commit()
    return {"id": outcome.id, "got_offer": outcome.got_offer}


@router.get("/")
async def list_outcomes(
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    rows = (
        db.query(Outcome)
        .filter(Outcome.user_id == claims["sub"])
        .order_by(Outcome.recorded_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "posting_id": r.posting_id,
            "company_name": r.company_name,
            "posting_title": r.posting_title,
            "score_total": r.score_total,
            "score_stack": r.score_stack,
            "score_company": r.score_company,
            "score_clarity": r.score_clarity,
            "got_interview": r.got_interview,
            "got_offer": r.got_offer,
            "recorded_at": r.recorded_at,
        }
        for r in rows
    ]
