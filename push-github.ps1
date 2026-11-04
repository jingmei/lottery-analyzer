# One-shot GitHub push for lottery-analyzer.
# The PAT is read with a hidden prompt, handed to git through GIT_ASKPASS + an
# environment variable, and NEVER written to a file, printed, or stored in .git/config.
# Windows PowerShell 5.1 compatible.

$ErrorActionPreference = 'Stop'
$repoUrl = 'https://github.com/jingmei/lottery-analyzer.git'
$apiUrl  = 'https://api.github.com/repos/jingmei/lottery-analyzer'
$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ''
Write-Host '=== Push lottery-analyzer to GitHub ===' -ForegroundColor Cyan
Write-Host ''

# [1/5] Has the remote repository been created?
Write-Host '[1/5] Checking that the remote repository exists ...'
$repoMissing = $false
try {
    $resp = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 20 -Headers @{ 'User-Agent' = 'lottery-analyzer-push-check' }
    Write-Host ('      OK - repository found (HTTP ' + [int]$resp.StatusCode + ')')
} catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 404) { $repoMissing = $true }
    else { Write-Host ('      check skipped (HTTP ' + $code + ') - continuing anyway') -ForegroundColor Yellow }
}
if ($repoMissing) {
    Write-Host ''
    Write-Host '      Remote repository does NOT exist yet.' -ForegroundColor Yellow
    Write-Host '      1) Open https://github.com/new'
    Write-Host '      2) Name: lottery-analyzer    Visibility: Public'
    Write-Host '      3) DO NOT tick README / .gitignore / license (they already exist locally)'
    Write-Host '      4) Create repository, then run this script again.'
    Write-Host ''
    exit 2
}

# [2/5] Hidden token input
$sec  = Read-Host 'Paste GitHub PAT (hidden, not saved)' -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host 'No token entered - cancelled.' -ForegroundColor Yellow
    exit 1
}
$token = $token.Trim()

# [3/5] Identity, remote, branch
Write-Host '[2/5] Configuring git ...'
& git config user.name  'jingmei'
& git config user.email 'j44905@163.com'
$remotes = & git remote
if ($remotes -contains 'origin') { & git remote set-url origin $repoUrl }
else { & git remote add origin $repoUrl }
& git branch -M main
Write-Host ('      remote = ' + $repoUrl)
Write-Host '      branch = main'

# [4/5] Temporary credential pipe. The .cmd contains only "%GH_PAT%" - the token
# itself lives in the process environment and is cleared at the end.
Write-Host '[3/5] Preparing a temporary credential pipe ...'
$askpass = Join-Path $env:TEMP ('gh_askpass_' + $PID + '.cmd')
Set-Content -Path $askpass -Value "@echo off`r`necho %GH_PAT%`r`n" -Encoding ASCII
$env:GIT_ASKPASS         = ($askpass -replace '\\', '/')
$env:GH_PAT              = $token
$env:GIT_TERMINAL_PROMPT = '0'

# [5/5] Push
Write-Host '[4/5] Pushing ...'
$rc = 1
try {
    & git -c credential.helper= -c credential.username=jingmei push -u origin main
    $rc = $LASTEXITCODE
} catch {
    Write-Host ('      git error: ' + $_.Exception.Message) -ForegroundColor Red
}

# Always clean up
Write-Host '[5/5] Cleaning up credentials ...'
$env:GH_PAT              = ''
$env:GIT_ASKPASS         = ''
$env:GIT_TERMINAL_PROMPT = ''
Remove-Item -Path $askpass -Force -ErrorAction SilentlyContinue
$token = ''

Write-Host ''
if ($rc -eq 0) {
    Write-Host 'SUCCESS - published at https://github.com/jingmei/lottery-analyzer' -ForegroundColor Green
    Write-Host 'Next: set Description / Website / Topics (docs/GITHUB_SETUP.md section 5).'
    Write-Host 'Also: run deploy-worker.bat once so the live page shows the repo link.'
    exit 0
}
Write-Host ('Push FAILED (git exit ' + $rc + ').') -ForegroundColor Red
Write-Host 'Check: PAT has the "repo" scope / repository exists / 2FA / network proxy.'
exit $rc
