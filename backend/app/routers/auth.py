import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from ..database import get_db
from ..models import User
from ..auth_utils import verify_token

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    faculty: str | None = None


@router.post("/register", status_code=201)
async def register(
    body: RegisterRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    sub = claims["sub"]
    email = claims.get("email", "")

    existing = db.get(User, sub)
    if existing:
        raise HTTPException(status_code=409, detail="User already registered")

    user = User(id=sub, email=email, faculty=body.faculty)
    db.add(user)
    db.commit()
    return {"id": sub, "email": email}


@router.get("/me")
async def me(
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    user = db.get(User, claims["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found — call /auth/register first")
    return {"id": user.id, "email": user.email, "faculty": user.faculty}
