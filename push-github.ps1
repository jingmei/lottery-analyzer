# One-shot GitHub push for lottery-analyzer.
# Windows PowerShell 5.1 compatible. All strings are ASCII on purpose: PowerShell 5.1
# reads UTF-8 files without a BOM as ANSI, which would garble Chinese text.
# The PAT is read with a hidden prompt, handed to git through GIT_ASKPASS + an
# environment variable, and NEVER written to a file, printed, or stored in .git/config.

$ErrorActionPreference = 'Stop'
$repoUrl = 'https://github.com/jingmei/lottery-analyzer.git'
$apiUrl  = 'https://api.github.com/repos/jingmei/lottery-analyzer'
$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ''
Write-Host '=== Push lottery-analyzer to GitHub ===' -ForegroundColor Cyan
Write-Host ''

# --- [0/5] Locate git.exe ----------------------------------------------------
# On this machine git is NOT in the normal Windows PATH: it ships inside
# WorkBuddy's PortableGit and is only injected into Git Bash sessions. A script
# launched by double-clicking a .bat would otherwise fail at the first git call.
function Resolve-GitExe {
    $c = Get-Command git -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $cands = @()
    foreach ($d in (Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)) {
        $cands += (Join-Path $d "Users\$env:USERNAME\AppData\Local\Programs\WorkBuddy\resources\vendor\PortableGit\mingw64\bin\git.exe")
        $cands += (Join-Path $d "Program Files\Git\cmd\git.exe")
        $cands += (Join-Path $d "Program Files (x86)\Git\cmd\git.exe")
    }
    $cands += (Join-Path $env:LOCALAPPDATA 'Programs\WorkBuddy\resources\vendor\PortableGit\mingw64\bin\git.exe')
    $cands += (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe')
    foreach ($p in $cands) { if (Test-Path $p) { return $p } }
    return $null
}

Write-Host '[0/5] Locating git.exe ...'
$git = Resolve-GitExe
if (-not $git) {
    Write-Host ''
    Write-Host '  *** ERROR: git.exe NOT FOUND ***' -ForegroundColor Red
    Write-Host '  Install Git for Windows, or run this from a Git Bash prompt.'
    Write-Host ''
    exit 3
}
$gitDir = Split-Path -Parent $git
$env:PATH = $gitDir + ';' + $env:PATH
Write-Host ('      git = ' + $git)
& $git --version

# --- [1/5] Has the remote repository been created? ---------------------------
# curl.exe ships with Windows 10+ and is not affected by PowerShell proxy quirks.
Write-Host '[1/5] Checking that the remote repository exists ...'
$repoMissing = $false
$code = ''
try {
    $code = ((& curl.exe --noproxy '*' -s -o NUL -w '%{http_code}' --max-time 20 $apiUrl) | Select-Object -First 1).Trim()
} catch { $code = '' }
if ($code -eq '404') { $repoMissing = $true }
elseif ($code -eq '200') { Write-Host '      OK - repository found (HTTP 200)' }
else { Write-Host ('      WARNING: repo check inconclusive ("' + $code + '") - continuing') -ForegroundColor Yellow }

if ($repoMissing) {
    Write-Host ''
    Write-Host '  *** ACTION REQUIRED: remote repository does NOT exist ***' -ForegroundColor Yellow
    Write-Host '  1) Open  https://github.com/new'
    Write-Host '  2) Name: lottery-analyzer     Visibility: Public'
    Write-Host '  3) DO NOT tick README / .gitignore / license'
    Write-Host '  4) Click "Create repository", then run this script again.'
    Write-Host ''
    Write-Host '  Nothing was pushed. Your token was NOT used.'
    Write-Host ''
    exit 2
}

# --- [2/5] Hidden token input ------------------------------------------------
$sec  = Read-Host 'Paste GitHub PAT (hidden, not saved)' -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host 'No token entered - cancelled.' -ForegroundColor Yellow
    exit 1
}
$token = $token.Trim()

# --- [3/5] Identity, remote, branch ------------------------------------------
Write-Host '[2/5] Configuring git ...'
& $git config user.name  'jingmei'
& $git config user.email 'j44905@163.com'
$remotes = & $git remote
if ($remotes -contains 'origin') { & $git remote set-url origin $repoUrl }
else { & $git remote add origin $repoUrl }
& $git branch -M main
Write-Host ('      remote = ' + $repoUrl)
Write-Host '      branch = main'

# --- [4/5] Temporary credential pipe ----------------------------------------
# The .cmd contains only "echo %GH_PAT%" - the token itself lives in the process
# environment and is cleared at the end. No token ever touches the disk.
Write-Host '[3/5] Preparing a temporary credential pipe ...'
$askpass = Join-Path $env:TEMP ('gh_askpass_' + $PID + '.cmd')
Set-Content -Path $askpass -Value "@echo off`r`necho %GH_PAT%`r`n" -Encoding ASCII
$env:GIT_ASKPASS         = ($askpass -replace '\\', '/')
$env:GH_PAT              = $token
$env:GIT_TERMINAL_PROMPT = '0'

# --- [5/5] Push ---------------------------------------------------------------
Write-Host '[4/5] Pushing ...'
$rc = 1
try {
    & $git -c credential.helper= -c credential.username=jingmei push -u origin main
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
Write-Host ('*** FAILED (git exit ' + $rc + ') - please screenshot this window ***') -ForegroundColor Red
Write-Host 'Check: PAT has the "repo" scope / repository exists / 2FA / network proxy.'
exit $rc
