# Generate self-signed TLS certs for Orion nginx (Windows)
$ErrorActionPreference = "Stop"
$Dir = Join-Path $PSScriptRoot "certs"
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$Cert = Join-Path $Dir "fullchain.pem"
$Key = Join-Path $Dir "privkey.pem"
if ((Test-Path $Cert) -and (Test-Path $Key)) {
  Write-Host "Certs already exist in $Dir"
  exit 0
}
openssl req -x509 -nodes -newkey rsa:2048 -days 825 `
  -keyout $Key `
  -out $Cert `
  -subj "/CN=orion.local/O=Orion IDE/C=US"
Write-Host "Wrote $Cert and $Key"
