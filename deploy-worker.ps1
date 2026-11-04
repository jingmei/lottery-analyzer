# One-shot Cloudflare Worker deploy helper.
#
# The API token is read interactively as a SecureString:
#   - it is NOT echoed on screen
#   - it is NOT written to any file
#   - it lives only in the CLOUDFLARE_API_TOKEN env var of this process
#
# Usage: double-click deploy-worker.bat (or run this script in PowerShell).

$ErrorActionPreference = 'Stop'

$here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerDir = Join-Path $here 'cf-worker'
$wrangler  = Join-Path $workerDir 'node_modules\.bin\wrangler.cmd'

# Change this if you deploy to your own domain after forking the repo.
$verifyUrl = 'https://maicaipiao.top/'

if (-not (Test-Path $wrangler)) {
    Write-Host '[ERROR] wrangler not found. Run "npm install" inside cf-worker first.' -ForegroundColor Red
    exit 1
}
Set-Location $workerDir

Write-Host ''
$sec = Read-Host 'Paste NEW Cloudflare API Token (input hidden)' -AsSecureString
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host 'No token entered - cancelled.' -ForegroundColor Yellow
    exit 1
}
$env:CLOUDFLARE_API_TOKEN = $token

Write-Host ''
Write-Host '[1/3] Verifying token ...' -ForegroundColor Cyan
& $wrangler whoami
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERROR] Token invalid or missing permissions.' -ForegroundColor Red
    Write-Host '        Required: Workers Scripts Edit / Workers KV Storage Edit'
    Write-Host '                  Workers Routes Edit / Account Settings Read'
    exit 1
}

Write-Host ''
Write-Host '[2/3] Confirming the push secret is still bound (names only) ...' -ForegroundColor Cyan
& $wrangler secret list
Write-Host '      (EDGE_PUSH_TOKEN must appear above; deploy does NOT delete secrets)'

Write-Host ''
Write-Host '[3/3] Deploying Worker ...' -ForegroundColor Cyan
& $wrangler deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERROR] Deploy failed.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Checking response headers ...' -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri $verifyUrl -Method Head -UseBasicParsing -TimeoutSec 25
    Write-Host ('  Cache-Control : ' + $r.Headers['Cache-Control'])
    Write-Host ('  HSTS          : ' + $r.Headers['Strict-Transport-Security'])
    Write-Host ('  nosniff       : ' + $r.Headers['X-Content-Type-Options'])
} catch {
    Write-Host '  Online check skipped (network). Run manually:' -ForegroundColor Yellow
    Write-Host '      curl -I https://maicaipiao.top/'
}

$env:CLOUDFLARE_API_TOKEN = ''
Write-Host ''
Write-Host 'DONE.' -ForegroundColor Green
exit 0
