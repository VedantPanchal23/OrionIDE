# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Start the all-in-one stack (frontend + every service)
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path .env)) {
  Write-Error "Missing .env — copy .env.example and fill secrets first.`n  Copy-Item .env.example .env"
}

Write-Host "Building and starting Orion IDE (all-in-one)..."
docker compose up --build @args

Write-Host ""
Write-Host "Orion IDE:"
Write-Host "  App:       http://localhost"
Write-Host "  Frontend:  http://localhost:3010"
Write-Host "  API:       http://localhost:3000"
Write-Host ""
Write-Host "Logs:  docker compose logs -f"
Write-Host "Stop:  docker compose down"
