import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Resume
from ..auth_utils import verify_token
from ..services.resume_parser import extract_text_from_pdf, extract_skills
from ..services.embedder import embed

router = APIRouter(prefix="/users", tags=["users"])

MAX_PDF_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/resume", status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF resumes are accepted")

    raw = await file.read()
    if len(raw) > MAX_PDF_BYTES:
        raise HTTPException(status_code=400, detail="PDF must be under 5 MB")

    text = extract_text_from_pdf(raw)
    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from PDF")

    skills = extract_skills(text)
    embedding = embed(text)

    user = db.get(User, claims["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="Register first via /auth/register")

    # Replace existing resume
    db.query(Resume).filter(Resume.user_id == user.id).delete()
    resume = Resume(
        id=str(uuid.uuid4()),
        user_id=user.id,
        raw_text=text,
        skills=skills,
        embedding=embedding,
    )
    db.add(resume)
    db.commit()

    return {"skills_detected": skills, "word_count": len(text.split())}
