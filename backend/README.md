# Backend (FastAPI)

## Run

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
uvicorn app.main:app --reload --port 8787
```

API: http://localhost:8787

## Endpoints (v0)
- `GET /health`
- `GET/POST /api/agents`
- `GET/POST /api/tasks`
- `POST /api/conversations`
- `GET /api/conversations/{id}`
- `POST /api/conversations/{id}/turns`
- `POST /api/war-room/run` (stub)
