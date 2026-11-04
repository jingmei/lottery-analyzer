@echo off
echo.
echo   ==================================================
echo    Push lottery-analyzer to GitHub
echo   ==================================================
echo.
echo   One-time prerequisites:
echo     1. Create an EMPTY public repo: https://github.com/new
echo        Name: lottery-analyzer
echo        Do NOT tick README / .gitignore / license
echo     2. Create a PAT: https://github.com/settings/tokens
echo        Tokens (classic) - Generate new token (classic)
echo        Tick "repo", then copy the token (shown once)
echo.
echo   Your PAT is hidden on screen and NEVER saved to a file.
echo.
echo   If the window shows ACTION REQUIRED or FAILED, screenshot it.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-github.ps1"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo   SUCCESS - repository published.
) else (
  echo   Exit code %RC% - see the message above.
)
echo.
pause
