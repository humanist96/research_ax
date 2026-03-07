import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from services.notebook import router as notebook_router
from services.generate import router as generate_router
from services.download import router as download_router
from services.chat import router as chat_router

load_dotenv()

app = FastAPI(title="NotebookLM Bridge", version="1.0.0")

# CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API key auth dependency
BRIDGE_API_KEY = os.getenv("BRIDGE_API_KEY")


async def verify_api_key(request: Request) -> None:
    if not BRIDGE_API_KEY:
        return
    api_key = request.headers.get("X-API-Key")
    if api_key != BRIDGE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# Health check
@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# Mount routers - all require API key
app.include_router(
    notebook_router, prefix="/api", dependencies=[Depends(verify_api_key)]
)
app.include_router(
    generate_router, prefix="/api", dependencies=[Depends(verify_api_key)]
)
app.include_router(
    download_router, prefix="/api", dependencies=[Depends(verify_api_key)]
)
app.include_router(
    chat_router, prefix="/api", dependencies=[Depends(verify_api_key)]
)
