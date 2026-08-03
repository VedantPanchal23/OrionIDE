# Orion IDE — Backup helpers (Windows PowerShell)
param(
  [string]$OutDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "backups")
)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")

$pgContainer = if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else { "orion-postgres-dev" }
$pgUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "orion" }
$pgDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "orion" }
$pgFile = Join-Path $OutDir "postgres-$stamp.sql"
Write-Host "Dumping Postgres from $pgContainer → $pgFile"
docker exec $pgContainer pg_dump -U $pgUser -d $pgDb --no-owner --no-acl | Set-Content -Path $pgFile -Encoding utf8

$redisContainer = if ($env:REDIS_CONTAINER) { $env:REDIS_CONTAINER } else { "orion-redis-dev" }
$redisPass = if ($env:REDIS_PASSWORD) { $env:REDIS_PASSWORD } else { "orion-dev-redis" }
$rdbFile = Join-Path $OutDir "redis-$stamp.rdb"
Write-Host "BGSAVE Redis on $redisContainer"
docker exec $redisContainer redis-cli -a $redisPass --no-auth-warning BGSAVE | Out-Null
Start-Sleep -Seconds 2
docker cp "${redisContainer}:/data/dump.rdb" $rdbFile
Write-Host "OK backups in $OutDir"
