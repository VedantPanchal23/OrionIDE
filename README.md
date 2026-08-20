# Orion IDE

A cloud-based IDE with AI-powered code generation, Google Drive integration, and support for 18 programming languages.

## Architecture

```
                    ┌───────────┐
                    │   Nginx   │ :80/:443
                    └─────┬─────┘
                          │
              ┌───────────┴───────────┐
              │                       │
        ┌─────┴─────┐         ┌──────┴──────┐
        │ Frontend   │         │ API Gateway │ :3000
        │ (React)    │         └──────┬──────┘
        └────────────┘                │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
              ┌─────┴─────┐   ┌──────┴──────┐   ┌──────┴──────┐
              │Auth :3001  │   │Drive :3002  │   │Editor :3003 │
              └────────────┘   └─────────────┘   └─────────────┘
                    │                 │                  │
              ┌─────┴─────┐   ┌──────┴──────┐   ┌──────┴──────┐
              │Exec :3004  │   │Agent :3005  │   │Notif :3006  │
              └─────┬──────┘   └─────────────┘   └──────┬──────┘
                    │                                   │
              ┌─────┴─────┐                      ┌─────┴─────┐
              │  Piston   │                      │Term :3007 │
              └───────────┘                      └───────────┘
                    │
              ┌─────┴─────┐
              │   Redis   │ (Cache + Pub/Sub)
              └───────────┘
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| **API Gateway** | 3000 | Auth middleware, rate limiting, request routing |
| **Auth Service** | 3001 | Google OAuth 2.0, JWT tokens, session management |
| **Drive Service** | 3002 | Google Drive CRUD, write buffer, project management |
| **Editor Service** | 3003 | Problems/diagnostics, debugger DAP sessions (Yjs collab behind feature flag) |
| **Execution Service** | 3004 | Code execution via Piston, SSE streaming, 18 languages |
| **Agent Service** | 3005 | AI pipeline (Planner → Designer → Implement/Review/Write → Run → Execute) |
| **Notification Service** | 3006 | Real-time SSE events, Redis Pub/Sub |
| **Terminal Service** | 3007 | PTY shell, Drive workspace sync, Git, HTTP port proxy |

## Supported Languages (18)

Python, JavaScript, TypeScript, Java, C, C++, C#, Go, Rust, PHP, Ruby, Kotlin, Swift, Bash, R, Dart, Lua, Perl

## Quick Start

### Prerequisites

- Docker Desktop (with Docker Compose)
- Google Cloud project with OAuth 2.0 credentials
- Optional: Groq / OpenRouter API keys (or use BYOK in Settings)

### One command (everything)

```bash
cp .env.example .env   # fill Google OAuth, JWT, Redis, Postgres secrets
docker compose up --build
```

That starts **frontend**, nginx, API gateway, all microservices, Redis, Postgres, and Piston.

| URL | What |
|-----|------|
| http://localhost | App (nginx → frontend + `/api`) |
| http://localhost:3010 | Frontend container directly |
| http://localhost:3000 | API gateway |

Google OAuth callback for this mode: `http://localhost/api/auth/google/callback`

Stop: `docker compose down`

### Hot-reload development (optional)

```bash
bash scripts/dev.sh
# or: docker compose -f docker-compose.dev.yml up --build
# Frontend http://localhost:3010 · Gateway :3000
```

### Production HTTPS

```bash
# Place certs in infrastructure/nginx/certs/ then:
bash scripts/prod-ssl.sh
```

### Run Tests

```bash
bash scripts/test.sh
```

## Environment Variables

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `REDIS_URL` | All | Yes | Redis connection string (embed password) |
| `INTERNAL_SECRET` | All | Yes | Shared service-to-service secret (≥32 chars) |
| `DRIVE_SERVICE_SECRET` | Drive/Gateway | Yes | Must match `INTERNAL_SECRET` |
| `GOOGLE_CLIENT_ID` | Auth | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Auth | Yes | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Auth | Yes | OAuth callback URL |
| `JWT_SECRET` | Auth | Yes | JWT signing secret (64+ chars) |
| `JWT_REFRESH_SECRET` | Auth | Yes | Refresh token secret (64+ chars) |
| `DATABASE_URL` / `POSTGRES_PASSWORD` | Auth | Yes | Postgres for users/billing |
| `GROQ_API_KEY` | Agent | No* | Server fallback LLM; users can BYOK in Settings |
| `OPENROUTER_API_KEY` | Agent | No* | Server fallback LLM; users can BYOK in Settings |
| `PISTON_API_URL` | Execution | No | Piston API URL (default: http://piston:2000) |
| `ENABLE_YJS_COLLAB` | Editor | No | CRDT collab (default `false`) |
| `ENABLE_DEBUGGER_API` | Gateway/Editor | No | DAP debugger (default `true`) |
| `ENABLE_AGENTS` | Gateway/Agent | No | Agent pipeline master switch (default `true`) |

\* Required only if you want server-side LLM without per-user BYOK. See `docs/ops/SECRETS.md`.

## AI Agent Pipeline

Five approval stages (server keys or user BYOK from Settings):

1. **Planner** — Analyzes goal, creates project plan
2. **Designer** — Designs file structure and implementation order
3. **Implement · Review · Write** — Generates code per file, reviews with auto-retry, writes to Drive
4. **Run config** — Chooses language / main file / run command
5. **Execute** — Runs via Piston and returns stdout/stderr

Default models (overridable via BYOK): Groq for plan/design/review/run; OpenRouter for implement.
## Test Suite

| Area | How to run |
|------|------------|
| Frontend unit | `cd frontend && npm test` (Vitest) |
| Frontend e2e | `cd frontend && npm run test:e2e` (Playwright) |
| Backend services | `cd services/<name> && npm test` |
| Live API smokes | `node scripts/live-smoke-no-google.mjs` (+ token scripts in `scripts/`) |

## Docker

| File | Purpose |
|------|---------|
| `docker-compose.yml` | **All-in-one** — frontend + nginx + all services + Redis/Postgres/Piston (HTTP :80 / :3010) |
| `docker-compose.dev.yml` | Hot reload (nodemon + Vite), same stack with source mounts |
| `infrastructure/docker-compose.prod.yml` | HTTPS edge + resource limits |

Service images build from **repo root** so `shared/` is copied into each image. Frontend builds from `frontend/Dockerfile` (Vite → nginx).

## Project Structure

```
orion-ide/
├── frontend/              # React + Vite IDE (Monaco, xterm) on :3010
├── services/
│   ├── api-gateway/       # Request routing + auth middleware (:3000)
│   ├── auth-service/      # Google OAuth + JWT + billing entitlements
│   ├── drive-service/     # Google Drive integration + search
│   ├── editor-service/    # Problems + debugger (collab optional)
│   ├── execution-service/ # Code execution (Piston)
│   ├── agent-service/     # AI pipeline (plan → design → implement/review/write → run)
│   ├── notification-service/ # SSE + Redis Pub/Sub
│   └── terminal-service/  # PTY, Drive sync, Git, HTTP port proxy (:3007)
├── shared/
│   ├── constants/         # Languages, plans, events
│   └── utils/             # Logger, feature flags, retry, notify
├── infrastructure/
│   ├── docker-compose.prod.yml
│   ├── docker-compose.staging.yml
│   ├── nginx/             # nginx.conf (HTTPS) + nginx.http.conf
│   ├── postgres/init.sql
│   └── redis/redis.conf
├── scripts/               # setup, smoke, backup, prod
├── docker-compose.yml     # full stack HTTP
├── docker-compose.dev.yml
├── .env.example
└── README.md
```

## License

MIT — see [LICENSE](LICENSE).
