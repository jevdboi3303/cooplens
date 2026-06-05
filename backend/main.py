import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth, users, score, outcomes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run DB migrations in a thread so startup doesn't block the healthcheck
    import asyncio
    loop = asyncio.get_event_loop()
    try:
        await asyncio.wait_for(
            loop.run_in_executor(None, lambda: Base.metadata.create_all(bind=engine)),
            timeout=20,
        )
    except asyncio.TimeoutError:
        print("Warning: DB init timed out — tables may already exist")
    yield


app = FastAPI(title="CoopLens API", version="0.1.0", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://cooplens.vercel.app",
    "https://cooplens.ca",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"chrome-extension://.*",  # all installed extensions
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


