@echo off
chcp 65001 >nul
echo.
echo   ==================================================
echo    Push lottery-analyzer to GitHub
echo   ==================================================
echo.
echo   One-time prerequisites / 一次性准备:
echo     1. Create EMPTY public repo / 建空仓库: https://github.com/new
echo        Name: lottery-analyzer
echo        不要勾 README / .gitignore / license
echo     2. Create PAT / 生成令牌: https://github.com/settings/tokens
echo        Tokens (classic) ^> Generate new token (classic)
echo        Tick "repo", copy the token (shown once)
echo.
echo   Your PAT is hidden on screen and NEVER saved to a file.
echo   PAT 不会显示在屏幕上，也不会写入任何文件。
echo.
echo   若窗口出现 ACTION REQUIRED / FAILED，请截图发我。
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-github.ps1"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo   SUCCESS - repository published.
) else (
  echo   Exit code %RC% - see the message above / 请看上方提示.
)
echo.
pause
