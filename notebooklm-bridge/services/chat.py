from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth import get_client

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict[str, Any]]


@router.post("/notebooks/{notebook_id}/chat", response_model=ChatResponse)
async def chat_with_notebook(
    notebook_id: str, body: ChatRequest
) -> ChatResponse:
    """Ask a question against the notebook sources."""
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    try:
        async with await get_client() as client:
            result = await client.chat(
                notebook_id=notebook_id,
                message=body.question,
            )

            answer = getattr(result, "text", str(result))
            sources = []
            if hasattr(result, "sources") and result.sources:
                sources = [
                    {
                        "title": getattr(s, "title", ""),
                        "snippet": getattr(s, "snippet", ""),
                    }
                    for s in result.sources
                ]

            return ChatResponse(answer=answer, sources=sources)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
