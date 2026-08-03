# Orion IDE — Secrets & ops checklist

## Required secrets (never commit)

| Variable | Used by | Notes |
|----------|---------|-------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | auth | OAuth |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | auth | ≥64 chars random |
| `INTERNAL_SECRET` / `DRIVE_SERVICE_SECRET` | all services | must match |
| `REDIS_PASSWORD` + `REDIS_URL` | all | URL must embed password |
| `POSTGRES_PASSWORD` + `DATABASE_URL` | auth | users/billing |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` | agents | Pro feature |
| `ORION_ACCESS_TOKEN` | CI smoke only | GitHub Actions secret |

Optional Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`.

## Feature kill-switches

| Flag | Default | Meaning |
|------|---------|---------|
| `ENABLE_YJS_COLLAB` | `false` | CRDT rooms off until sync is boring |
| `ENABLE_DEBUGGER_API` | `true` | DAP session API + Python/Node adapters |
| `ENABLE_AGENTS` | `true` | Master switch; still Pro-gated |

## Backups

```powershell
.\scripts\backup.ps1
# or
bash scripts/backup-postgres.sh
bash scripts/backup-redis.sh
```

Keep at least 7 daily copies off-box. Test restore quarterly.

## Staging

```powershell
docker compose -f docker-compose.dev.yml -f infrastructure/docker-compose.staging.yml up -d
```

## Happy-path smoke (real Google)

1. Log in once via the UI so Redis has `google:refresh:{userId}`.
2. Mint a short-lived Orion JWT (local only):

```powershell
$env:ORION_ACCESS_TOKEN = node scripts/mint-access-token.mjs --print
node scripts/smoke-happy-path.mjs
```

Or paste a JWT from a fresh browser login:

```powershell
$env:ORION_ACCESS_TOKEN="<jwt from login>"
node scripts/smoke-happy-path.mjs
```

Wire `ORION_ACCESS_TOKEN` (+ optional `STAGING_GATEWAY_URL`) as GitHub Actions secrets to run smoke after deploy.
