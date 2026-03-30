# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

This is a Turborepo monorepo using **Bun** as the package manager.

```bash
bun install                    # Install all dependencies
bun run dev                    # Run all services/apps in parallel (turbo)
bun run build                  # Build all workspaces
bun run lint                   # Lint all workspaces
bun run check-types            # Type-check all workspaces
bun run format                 # Prettier format all TS/TSX/MD files
```

### Running individual services

```bash
cd services/finance && bun run dev      # Finance API on :4001 (hot reload)
cd services/auth && bun run dev         # Auth API on :4002 (hot reload)
cd apps/web && bun run dev              # React frontend on :5173
```

### Database

```bash
docker compose up -d                    # Start MySQL + phpMyAdmin
cd services/finance && bun run db:generate   # Generate Drizzle migrations
cd services/finance && bun run db:migrate    # Push schema to database
# Same db:generate / db:migrate commands for services/auth
```

Two separate MySQL databases: `finance` (port 4001 service) and `auth` (port 4002 service). PhpMyAdmin available at the port configured in `.env` (default 8080).

## Architecture

### Monorepo Layout

- **`apps/web`** — React + Vite + TailwindCSS frontend (JavaScript/JSX). Proxies `/api` to `localhost:8080` in dev.
- **`services/finance`** — Elysia + Drizzle ORM finance API. Accounts, categories, transactions, budgets.
- **`services/auth`** — Elysia + Drizzle ORM auth API. Phone-based registration/login, JWT tokens, rate limiting.
- **`packages/`** — Shared ESLint config, TypeScript config, and UI component library.

### Service Architecture Pattern (finance & auth)

Both backend services follow the same layered structure under `src/`:

```
controllers/  →  services/  →  repositories/  →  schemas/
(HTTP layer)    (business)     (data access)     (Drizzle table defs)
```

- **Controllers**: Define Elysia route groups, handle request/response mapping
- **Services**: Business logic, called by controllers
- **Repositories**: Drizzle ORM queries, called by services
- **Schemas**: Drizzle MySQL table definitions (UUID string PKs, no DB-level foreign keys)
- **Middleware**: `requireAuth.ts` (JWT verification), `rateLimiter.ts` (auth service only)

### Key Tech Choices

- **Runtime**: Bun (v1.1.34)
- **HTTP Framework**: Elysia (not Hono — uses Elysia-specific patterns like `.group()`, `.use()`)
- **ORM**: Drizzle with `mysql2` driver, connection pooling
- **Validation**: Zod for env vars and request validation
- **API Docs**: `@elysiajs/openapi` — Swagger UI at `/docs` on each service
- **Frontend**: React 18 + React Router DOM + Vite + TailwindCSS (plain JSX, not TypeScript)

### Environment Setup

Copy `.env.example` to `.env` at the root. Each service reads from env vars validated by Zod (`src/env.ts`). Key vars:
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD` — shared DB connection
- `FINANCE_DATABASE` / `AUTH_DATABASE` — database names
- `JWT_SECRET` — required (min 24 chars), shared across services for token verification
- Auth-specific: `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `RATE_LIMIT_*`

### Conventions

- Database IDs are UUID strings generated at the application level
- Currency defaults to VND
- All Drizzle schemas export from `schemas/index.ts`
- Drizzle config files are at service root (`drizzle.config.ts`), schemas under `src/schemas/`
- Health check endpoint: `GET /health` on each service
