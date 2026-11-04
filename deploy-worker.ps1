# One-shot Cloudflare Worker deploy helper.
# All strings are ASCII on purpose (PowerShell 5.1 reads BOM-less UTF-8 as ANSI).
# The API token is read interactively as a SecureString:
#   - it is NOT echoed on screen
#   - it is NOT written to any file
#   - it lives only in the CLOUDFLARE_API_TOKEN env var of this process
#
# Usage: double-click deploy-worker.bat (or run this script in PowerShell).

$ErrorActionPreference = 'Stop'

$here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerDir  = Join-Path $here 'cf-worker'
$wranglerJs = Join-Path $workerDir 'node_modules\wrangler\bin\wrangler.js'

# Change this if you deploy to your own domain after forking the repo.
$verifyUrl = 'https://maicaipiao.top/'

# --- [0/4] Locate node.exe ---------------------------------------------------
# Double-clicking the .bat starts a plain PowerShell where node is NOT in PATH
# (it lives in WorkBuddy's managed node install and is only injected into Git Bash
#  / tool sessions). wrangler.cmd falls back to calling "node" and would fail with
#  "'node' is not recognized", which older versions misreported as a bad token.
function Resolve-NodeExe {
    $c = Get-Command node -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $cands = @()
    $versions = Join-Path $env:USERPROFILE '.workbuddy\binaries\node\versions'
    if (Test-Path $versions) {
        Get-ChildItem -Path $versions -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $cands += (Join-Path $_.FullName 'node.exe')
        }
    }
    foreach ($d in (Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)) {
        $cands += (Join-Path $d 'Program Files\nodejs\node.exe')
        $cands += (Join-Path $d "Users\$env:USERNAME\.workbuddy\binaries\node\versions\node.exe")
    }
    $cands += (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
    $cands += (Join-Path $env:APPDATA 'nvm\node.exe')
    foreach ($p in $cands) { if (Test-Path $p) { return $p } }
    return $null
}

Write-Host '[0/4] Locating node.exe ...'
$nodeExe = Resolve-NodeExe
if (-not $nodeExe) {
    Write-Host ''
    Write-Host '  *** ERROR: node.exe NOT FOUND ***' -ForegroundColor Red
    Write-Host '  Install Node.js, or run deploy-worker.bat from a Git Bash prompt.'
    Write-Host ''
    exit 1
}
# Add it to PATH too, in case wrangler spawns child "node" processes.
$env:PATH = (Split-Path -Parent $nodeExe) + ';' + $env:PATH
Write-Host ('      node = ' + $nodeExe)
& $nodeExe --version

if (-not (Test-Path $wranglerJs)) {
    Write-Host '[ERROR] wrangler not found. Run "npm install" inside cf-worker first.' -ForegroundColor Red
    exit 1
}
Set-Location $workerDir

Write-Host ''
$sec = Read-Host 'Paste NEW Cloudflare API Token (input hidden)' -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host 'No token entered - cancelled.' -ForegroundColor Yellow
    exit 1
}
$env:CLOUDFLARE_API_TOKEN = $token.Trim()

Write-Host ''
Write-Host '[1/4] Verifying token ...' -ForegroundColor Cyan
& $nodeExe $wranglerJs whoami
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '  *** FAILED: token invalid / missing permissions / network problem ***' -ForegroundColor Red
    Write-Host '  Required: Workers Scripts Edit / Workers KV Storage Edit'
    Write-Host '            Workers Routes Edit / Account Settings Read'
    Write-Host '  If you see "node is not recognized", node.exe was not found (see [0/4]).'
    Write-Host ''
    $env:CLOUDFLARE_API_TOKEN = ''
    exit 1
}

Write-Host ''
Write-Host '[2/4] Confirming the push secret is still bound (names only) ...' -ForegroundColor Cyan
& $nodeExe $wranglerJs secret list
Write-Host '      (EDGE_PUSH_TOKEN must appear above; deploy does NOT delete secrets)'

Write-Host ''
Write-Host '[3/4] Deploying Worker ...' -ForegroundColor Cyan
& $nodeExe $wranglerJs deploy
$rc = $LASTEXITCODE
if ($rc -ne 0) {
    Write-Host ('[ERROR] Deploy failed (exit ' + $rc + ').') -ForegroundColor Red
    $env:CLOUDFLARE_API_TOKEN = ''
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
