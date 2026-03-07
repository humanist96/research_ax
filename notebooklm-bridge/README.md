# NotebookLM Bridge

FastAPI microservice wrapping `notebooklm-py` for the Research AX frontend.

## Setup

```bash
cd notebooklm-bridge
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit with your values
```

## Auth

Place your NotebookLM storage state in one of:
- `~/.notebooklm/storage-state.json` (file)
- `NOTEBOOKLM_STORAGE_STATE` env var (base64-encoded JSON)

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Docker

```bash
docker build -t notebooklm-bridge .
docker run -p 8000:8000 --env-file .env notebooklm-bridge
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/notebooks` | Create notebook + source |
| DELETE | `/api/notebooks/{id}` | Delete notebook |
| POST | `/api/notebooks/{id}/generate` | Start generation task |
| GET | `/api/notebooks/{id}/tasks/{task_id}` | Poll task status |
| GET | `/api/notebooks/{id}/artifacts/{type}/download` | Download artifact |
| GET | `/api/notebooks/{id}/mind-map` | Get mind map JSON |
| POST | `/api/notebooks/{id}/chat` | Q&A against sources |

All endpoints (except `/health`) require `X-API-Key` header.
