# AWAD2

Personal finance monorepo with a React frontend, Bun/Elysia backend services, a Python FastAPI RAG pipeline, and MySQL running through Docker Compose.

## Stack

- **Frontend:** React + Vite + Tailwind CSS in `apps/web`
- **Runtime/package manager:** Bun
- **Backend APIs:** Elysia services in `services/auth`, `services/finance`, and `services/insights`
- **AI/RAG service:** FastAPI app in `services/insights/rag_pipeline`
- **Database:** MySQL, managed by Docker Compose
- **ORM:** Drizzle ORM

## Repository Layout

```txt
apps/web                         React/Vite frontend
services/auth                    Auth API, JWT login/register/profile
services/finance                 Finance API for accounts, categories, budgets, transactions
services/insights                TypeScript insights service and Drizzle schema
services/insights/rag_pipeline   Python FastAPI RAG/chat pipeline
packages/*                       Shared workspace packages/config
docker-compose.yaml              MySQL and phpMyAdmin only
```

## Requirements

- Node.js `>=18`
- Bun `>=1.1.0` (`packageManager` is `bun@1.1.34`)
- Docker Desktop or Docker Engine
- Python `3.12+` recommended for the RAG pipeline

## Setup

Install JavaScript dependencies from the repo root:

```sh
bun install
```

Create your local environment file:

```sh
cp .env.example .env
```

Update `.env` with real local values. Important variables:

```txt
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=appuser
MYSQL_PASSWORD=...
FINANCE_DATABASE=finance
AUTH_DATABASE=auth
INSIGHTS_DATABASE=insights
JWT_SECRET=change-me-to-at-least-24-chars
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=...
RAG_PORT=4004
FINANCE_API_URL=http://localhost:4001
FRONTEND_ORIGIN=http://localhost:5173
```

## Start Infrastructure

Docker Compose currently starts only MySQL and phpMyAdmin. It does not start the frontend or API services.

```sh
docker compose up -d
```

Default ports:

| Service | URL |
| --- | --- |
| MySQL | `localhost:3306` |
| phpMyAdmin | `http://localhost:8080` |

Stop infrastructure:

```sh
docker compose down
```

## Database Migrations

Run migrations after MySQL is healthy and `.env` is configured:

```sh
cd services/auth
bun run db:migrate
```

```sh
cd services/finance
bun run db:migrate
```

```sh
cd services/insights
bun run db:migrate
```

## Run The App

Run each service in its own terminal.

### Auth API

```sh
cd services/auth
bun run dev
```

Runs on `http://localhost:4002`.

Health check:

```sh
curl http://localhost:4002/health
```

### Finance API

```sh
cd services/finance
bun run dev
```

Runs on `http://localhost:4001`.

Health check:

```sh
curl http://localhost:4001/health
```

### Python RAG Pipeline

Create and activate a Python virtual environment:

```sh
cd services/insights
python -m venv rag_pipeline/.venv
source rag_pipeline/.venv/bin/activate
pip install -r rag_pipeline/requirements.txt
```

Start the RAG service:

```sh
python -m rag_pipeline.main
```

Runs on `http://localhost:4004`.

Health check:

```sh
curl http://localhost:4004/health
```

### TypeScript Insights Service

This service runs separately from the Python RAG pipeline. Start it only if you are working on the TypeScript insights API path.

```sh
cd services/insights
bun run dev
```

Runs on `http://localhost:4003`.

### Frontend

```sh
cd apps/web
bun run dev
```

Runs on `http://localhost:5173`.

The frontend calls these default APIs:

| API | Default URL |
| --- | --- |
| Auth | `http://localhost:4002` |
| Finance | `http://localhost:4001` |
| Insights/RAG | `http://localhost:4004` |

## Common Commands

From the repo root:

```sh
bun run build
bun run lint
bun run check-types
bun run format
```

Run all workspace dev scripts through Turborepo:

```sh
bun run dev
```

For day-to-day debugging, starting services individually is usually clearer because each terminal shows one service's logs.

## Troubleshooting

### `localhost:5173` refused to connect

The frontend is not running. Start it again:

```sh
cd apps/web
bun run dev
```

Check whether anything is listening on the port:

```sh
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

### `Port 5173 is already in use`

Another Vite process is already bound to the frontend port. Find it:

```sh
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Stop the existing process or use the already-running `http://localhost:5173` tab.

### `POST http://localhost:4002/auth/login net::ERR_CONNECTION_REFUSED`

The auth service is not running:

```sh
cd services/auth
bun run dev
```

### `401 Unauthorized` from `/insights/logs`

The browser token is missing, expired, or was created before an auth environment change. Log out and log in again. Local development uses `JWT_EXPIRES_IN=7d` when configured in `.env`.

### Python RAG `Address already in use`

The RAG service is already running on `4004`. Check the process:

```sh
lsof -nP -iTCP:4004 -sTCP:LISTEN
```

Use the existing service or stop it before starting a new one.

### Chat says an action succeeded but no budget or transaction appears

Make sure all required services are running:

```sh
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4004/health
```

The Python RAG service creates budgets and transactions by calling the Finance API on `http://localhost:4001`.

## Notes

- `docker compose up -d` starts database infrastructure only.
- Vite is configured with `strictPort: true`, so port `5173` must be free before starting the frontend.
- The Python RAG pipeline reads the root `.env` file.
- Auth, Finance, and Insights services all need the same `JWT_SECRET` so tokens verify across services.
