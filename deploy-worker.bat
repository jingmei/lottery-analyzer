@echo off
setlocal
cd /d "%~dp0"

echo.
echo   ==================================================
echo    Cloudflare Worker deploy  (new API token)
echo   ==================================================
echo.
echo   You will be asked to paste your NEW Cloudflare API Token.
echo   This is a CLOUDFLARE token - NOT your GitHub PAT.
echo   Create one at: https://dash.cloudflare.com/profile/api-tokens
echo   Use the "Edit Cloudflare Workers" template.
echo   Tokens are shown ONLY ONCE and cannot be viewed again later.
echo   If you lost the old one, just create a new one.
echo   It is hidden on screen and is NOT saved to any file.
echo.
echo   Before running, make sure you have:
echo     1. Created the new token in Cloudflare Dashboard
echo     2. NOT revoked the old one yet (do it after deploy)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-worker.ps1"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
  echo   SUCCESS - Worker deployed.
  echo   Next: revoke the OLD token in Cloudflare Dashboard.
) else (
  echo   FAILED - please read the messages above.
)
echo.
pause
endlocal
exit /b %RC%
