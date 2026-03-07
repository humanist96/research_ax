from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from auth import get_client

router = APIRouter(tags=["download"])

# Content type mapping for artifact types
_CONTENT_TYPES: dict[str, str] = {
    "audio": "audio/mpeg",
    "video": "video/mp4",
    "slide-deck": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "quiz": "application/pdf",
    "flashcards": "application/pdf",
    "infographic": "image/png",
    "data-table": "text/csv",
    "mind-map": "application/json",
}

_FILE_EXTENSIONS: dict[str, str] = {
    "audio": "mp3",
    "video": "mp4",
    "slide-deck": "pptx",
    "quiz": "pdf",
    "flashcards": "pdf",
    "infographic": "png",
    "data-table": "csv",
    "mind-map": "json",
}


@router.get("/notebooks/{notebook_id}/artifacts/{artifact_type}/download")
async def download_artifact(
    notebook_id: str, artifact_type: str
) -> StreamingResponse:
    """Download a generated artifact as a file stream."""
    content_type = _CONTENT_TYPES.get(artifact_type)
    if not content_type:
        raise HTTPException(
            status_code=400, detail=f"Unknown artifact type: {artifact_type}"
        )

    try:
        async with await get_client() as client:
            # Map artifact type to notebooklm-py type
            nlm_type = artifact_type.replace("-", "_")
            data = await client.get_artifact(
                notebook_id=notebook_id,
                artifact_type=nlm_type,
            )

            ext = _FILE_EXTENSIONS.get(artifact_type, "bin")
            filename = f"{notebook_id}_{artifact_type}.{ext}"

            async def stream_bytes():
                if isinstance(data, bytes):
                    yield data
                elif hasattr(data, "read"):
                    while chunk := await data.read(8192):
                        yield chunk
                else:
                    yield bytes(str(data), "utf-8")

            return StreamingResponse(
                stream_bytes(),
                media_type=content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"'
                },
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/notebooks/{notebook_id}/mind-map")
async def get_mind_map(notebook_id: str) -> JSONResponse:
    """Return the mind map as JSON data."""
    try:
        async with await get_client() as client:
            data = await client.get_artifact(
                notebook_id=notebook_id,
                artifact_type="mind_map",
            )

            if isinstance(data, bytes):
                import json
                return JSONResponse(content=json.loads(data.decode("utf-8")))
            if isinstance(data, dict):
                return JSONResponse(content=data)
            return JSONResponse(content={"raw": str(data)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
