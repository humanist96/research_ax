import asyncio
import uuid
from enum import Enum
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth import get_client

router = APIRouter(tags=["generate"])

# In-memory task store: task_id -> { status, result, error }
_tasks: dict[str, dict[str, Any]] = {}


class GenerationType(str, Enum):
    AUDIO = "audio"
    VIDEO = "video"
    SLIDE_DECK = "slide-deck"
    QUIZ = "quiz"
    FLASHCARDS = "flashcards"
    MIND_MAP = "mind-map"
    INFOGRAPHIC = "infographic"
    DATA_TABLE = "data-table"


class GenerateRequest(BaseModel):
    type: GenerationType
    options: dict[str, Any] = {}


class GenerateResponse(BaseModel):
    task_id: str
    status: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: dict[str, Any] | None = None
    error: str | None = None


# Map our types to notebooklm-py generation types
_TYPE_MAP: dict[GenerationType, str] = {
    GenerationType.AUDIO: "audio_overview",
    GenerationType.VIDEO: "video",
    GenerationType.SLIDE_DECK: "slide_deck",
    GenerationType.QUIZ: "quiz",
    GenerationType.FLASHCARDS: "flashcards",
    GenerationType.MIND_MAP: "mind_map",
    GenerationType.INFOGRAPHIC: "infographic",
    GenerationType.DATA_TABLE: "data_table",
}


async def _run_generation(
    task_id: str, notebook_id: str, gen_type: str, options: dict[str, Any]
) -> None:
    """Background task that runs generation and updates task store."""
    try:
        _tasks[task_id]["status"] = "processing"
        async with await get_client() as client:
            result = await client.generate(
                notebook_id=notebook_id,
                output_type=gen_type,
                **options,
            )
            _tasks[task_id]["status"] = "complete"
            _tasks[task_id]["result"] = {
                "artifact_id": getattr(result, "id", None),
                "type": gen_type,
            }
    except Exception as e:
        _tasks[task_id]["status"] = "error"
        _tasks[task_id]["error"] = str(e)


@router.post(
    "/notebooks/{notebook_id}/generate", response_model=GenerateResponse
)
async def trigger_generation(
    notebook_id: str, body: GenerateRequest
) -> GenerateResponse:
    """Start an async generation task."""
    gen_type = _TYPE_MAP.get(body.type)
    if not gen_type:
        raise HTTPException(
            status_code=400, detail=f"Unsupported generation type: {body.type}"
        )

    task_id = str(uuid.uuid4())
    _tasks[task_id] = {"status": "pending", "result": None, "error": None}

    asyncio.create_task(
        _run_generation(task_id, notebook_id, gen_type, body.options)
    )

    return GenerateResponse(task_id=task_id, status="pending")


@router.get(
    "/notebooks/{notebook_id}/tasks/{task_id}",
    response_model=TaskStatusResponse,
)
async def get_task_status(notebook_id: str, task_id: str) -> TaskStatusResponse:
    """Poll the status of a generation task."""
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return TaskStatusResponse(
        task_id=task_id,
        status=task["status"],
        result=task.get("result"),
        error=task.get("error"),
    )
