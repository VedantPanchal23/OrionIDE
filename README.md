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
              └─────┬──────┘   └─────────────┘   └─────────────┘
                    │
              ┌─────┴─────┐
              │  Piston   │ (Sandbox)
              └───────────┘
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
| **Editor Service** | 3003 | File sessions, WebSocket collaboration, dirty state |
| **Execution Service** | 3004 | Code execution via Piston, SSE streaming, 18 languages |
| **Agent Service** | 3005 | AI pipeline (Planner, Designer, Implementer, Reviewer, File, Run) |
| **Notification Service** | 3006 | Real-time SSE events, Redis Pub/Sub |

## Supported Languages (18)

Python, JavaScript, TypeScript, Java, C, C++, C#, Go, Rust, PHP, Ruby, Kotlin, Swift, Bash, R, Dart, Lua, Perl

## Quick Start

### Prerequisites

- Docker Desktop (with Docker Compose)
- Node.js 18+ (for local development)
- Google Cloud project with OAuth 2.0 credentials
- Groq API key (free tier)
- OpenRouter API key (free tier)

### Setup

```bash
# Clone and setup
git clone <repo-url> orion-ide
cd orion-ide

# Run setup script (copies .env, installs deps)
bash scripts/setup.sh

# Edit .env with your API keys
nano .env
```

### Development

```bash
bash scripts/dev.sh
# Opens at http://localhost:3000
```

### Production

```bash
bash scripts/prod.sh
# Opens at http://localhost (port 80)
```

### Run Tests

```bash
bash scripts/test.sh
```

## Environment Variables

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `REDIS_URL` | All | Yes | Redis connection string |
| `GOOGLE_CLIENT_ID` | Auth | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Auth | Yes | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Auth | Yes | OAuth callback URL |
| `JWT_SECRET` | Auth | Yes | JWT signing secret (64+ chars) |
| `JWT_REFRESH_SECRET` | Auth | Yes | Refresh token secret (64+ chars) |
| `GROQ_API_KEY` | Agent | Yes | Groq API key for LLM calls |
| `OPENROUTER_API_KEY` | Agent | Yes | OpenRouter API key for DeepSeek |
| `PISTON_API_URL` | Execution | No | Piston API URL (default: http://piston:2000) |

## AI Agent Pipeline

The 6-step autonomous development pipeline:

1. **Planner** (Groq/llama-3.3-70b) — Analyzes goal, creates project plan
2. **Designer** (Groq/llama-3.3-70b) — Designs file structure and implementation order
3. **Implementer** (OpenRouter/DeepSeek) — Generates production code per file
4. **Reviewer** (Groq/llama3-8b) — Reviews code quality, auto-retries if rejected
5. **File Agent** — Writes files to Google Drive
6. **Run Agent** (Groq/llama3-8b) — Determines and executes run command

## Test Suite

| Service | Tests |
|---------|-------|
| API Gateway | 19 |
| Auth Service | 24 |
| Drive Service | 31 |
| Editor Service | 17 |
| Execution Service | 32 |
| Agent Service | 27 |
| Notification Service | 13 |
| **Total** | **163** |

## Docker Production Build

All services use multi-stage builds with:
- `node:18-alpine` base image
- Non-root `orion` user
- Health checks on every service
- JSON file logging with 10MB rotation
- Resource limits (CPU + memory)
- Internal `orion-network` (only nginx exposed)

## Project Structure

```
orion-ide/
├── frontend/              # React SPA with Monaco Editor
├── services/
│   ├── api-gateway/       # Request routing + auth middleware
│   ├── auth-service/      # Google OAuth + JWT
│   ├── drive-service/     # Google Drive integration
│   ├── editor-service/    # File sessions + WebSocket
│   ├── execution-service/ # Code execution (Piston)
│   ├── agent-service/     # AI pipeline (6 agents)
│   └── notification-service/ # SSE + Redis Pub/Sub
├── shared/
│   ├── constants/         # Languages, errors, events
│   └── utils/             # Logger, validateEnv
├── infrastructure/
│   ├── docker-compose.prod.yml
│   ├── nginx/nginx.conf
│   └── redis/redis.conf
├── scripts/               # setup, dev, prod, test
├── docker-compose.dev.yml
├── .env.example
└── README.md
```

## License

Private — All rights reserved.
