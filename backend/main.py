import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth, users, score, outcomes


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="CoopLens API", version="0.1.0", lifespan=lifespan)

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "chrome-extension://*,http://localhost:5173,https://cooplens.ca",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(score.router)
app.include_router(outcomes.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug/token")
async def debug_token(claims: dict = Depends(app.dependency_overrides.get("verify_token", lambda: None))):
    from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
    from fastapi import Request
    return {"claims": "use /auth/me instead"}


@app.post("/debug/verify")
async def debug_verify(request: Request):
    import httpx, os
    body = await request.json()
    token = body.get("token", "")
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_ANON_KEY", "")
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(
            f"{url}/auth/v1/user",
            headers={"apikey": key, "Authorization": f"Bearer {token}"},
        )
    return {"status": resp.status_code, "body": resp.json()}
