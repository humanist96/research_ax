import base64
import json
import os
import tempfile
from pathlib import Path

from notebooklm import NotebookLMClient


def _get_storage_state_path() -> str:
    """Resolve storage state: env var (base64) > file path."""
    env_state = os.getenv("NOTEBOOKLM_STORAGE_STATE")
    if env_state:
        decoded = base64.b64decode(env_state).decode("utf-8")
        json.loads(decoded)  # validate JSON
        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, prefix="notebooklm_state_"
        )
        tmp.write(decoded)
        tmp.flush()
        tmp.close()
        return tmp.name

    default_path = Path.home() / ".notebooklm" / "storage-state.json"
    if default_path.exists():
        return str(default_path)

    raise FileNotFoundError(
        "No storage state found. Set NOTEBOOKLM_STORAGE_STATE env var "
        "or place storage-state.json at ~/.notebooklm/storage-state.json"
    )


async def get_client() -> NotebookLMClient:
    """Create an authenticated NotebookLMClient from storage state."""
    storage_path = _get_storage_state_path()
    client = await NotebookLMClient.from_storage(storage_state_path=storage_path)
    return client
