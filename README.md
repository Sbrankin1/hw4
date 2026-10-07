# Campus Customs — Yale Bulldog Gear

A customer website for Campus Customs: a React + Vite + TypeScript frontend and a FastAPI backend that reads `campus_customs.db`. The chat widget is answered by a Pydantic AI agent (`backend/agent.py`) that looks up live price and stock in the database.

## Run it

**1. Backend** (port 8000)

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd backend
../.venv/bin/uvicorn main:app --reload --port 8000
```

Copy `.env.example` to `.env` and fill in `PORTKEY_API_KEY` (the chatbot's model key) and `SECRET_KEY`.

**Data:** the course database is not part of the required layout, so it isn't in this repo. Put `campus_customs.db` and its `products/` image folder side by side in one folder, and set `CAMPUS_DB_PATH` in `.env` to the `.db` file (relative paths are resolved from `backend/`). Without `CAMPUS_DB_PATH`, the backend looks for `Data 3/campus_customs.db` three folders above `backend/`, which is where it lived during development.

**2. Frontend** (port 5173, in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. Vite forwards `/api` and `/media` requests to the backend.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/products?category=&subcategory=&theme=&q=` | Product list with derived category, sub-category and theme, plus stock per size |
| `GET /api/products/{product_id}` | One product |
| `GET /api/categories` | Category tree and theme counts |
| `GET /media/products/{file}.jpg` | Product photo. Black backgrounds are turned white when the image is served; the original files are never changed |
| `POST /api/register`, `POST /api/login`, `GET /api/me` | Accounts (Bearer token) |
| `POST /api/chat` | `{message, history}` → `{reply, products}` from the agent |
| `GET /api/health` | Database path check |

Product and stock reads use a read-only connection; the only writes are new rows in `users` from sign-up. Categories and themes are worked out when the data is read (rules in `output/harness.md`).
