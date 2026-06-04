from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)  # Cognito sub
    email = Column(String, unique=True, nullable=False)
    faculty = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resumes = relationship("Resume", back_populates="user")
    outcomes = relationship("Outcome", back_populates="user")


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    raw_text = Column(Text, nullable=False)
    skills = Column(JSON, nullable=False, default=list)
    embedding = Column(JSON, nullable=True)  # stored as list[float]
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="resumes")


class Outcome(Base):
    __tablename__ = "outcomes"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    posting_id = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    posting_title = Column(String, nullable=True)
    score_total = Column(Float, nullable=True)
    score_stack = Column(Float, nullable=True)
    score_company = Column(Float, nullable=True)
    score_clarity = Column(Float, nullable=True)
    got_interview = Column(Boolean, nullable=True)
    got_offer = Column(Boolean, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="outcomes")
