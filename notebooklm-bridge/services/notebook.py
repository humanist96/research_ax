from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth import get_client

router = APIRouter(tags=["notebooks"])


class CreateNotebookRequest(BaseModel):
    title: str
    markdown_content: str


class CreateNotebookResponse(BaseModel):
    notebook_id: str
    source_id: str


class DeleteNotebookResponse(BaseModel):
    deleted: bool


@router.post("/notebooks", response_model=CreateNotebookResponse)
async def create_notebook(body: CreateNotebookRequest) -> CreateNotebookResponse:
    """Create a notebook and add markdown content as a text source."""
    try:
        async with await get_client() as client:
            notebook = await client.create_notebook(title=body.title)
            notebook_id = notebook.id

            source = await client.add_source(
                notebook_id=notebook_id,
                content=body.markdown_content,
                content_type="text",
                title=body.title,
            )

            return CreateNotebookResponse(
                notebook_id=notebook_id,
                source_id=source.id,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/notebooks/{notebook_id}", response_model=DeleteNotebookResponse)
async def delete_notebook(notebook_id: str) -> DeleteNotebookResponse:
    """Delete a notebook by ID."""
    try:
        async with await get_client() as client:
            await client.delete_notebook(notebook_id=notebook_id)
            return DeleteNotebookResponse(deleted=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
