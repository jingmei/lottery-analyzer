@echo off
REM ============================================================
REM  Lottery Analyzer - one-click start (local data fetcher)
REM  The public site is served by a Cloudflare Worker; this script
REM  only runs the local fetcher that reads official draw data from
REM  a CN IP and pushes it to the edge KV.
REM
REM  Secrets come from .env (NEVER commit it). Copy .env.example to
REM  .env and set PUSH_TOKEN to the SAME value used for:
REM      wrangler secret put EDGE_PUSH_TOKEN
REM
REM  Strategy: every 60 min; after each draw every 10 min until a
REM  new issue number is fetched (max +80 min).
REM
REM  Pure ASCII file. Do NOT put Chinese chars in this file.
REM ============================================================
setlocal
cd /d "%~dp0"

set "NODE=C:\Users\jingmei\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"
set "EDGE_ORIGIN=https://maicaipiao.top"
set "REFRESH_MIN=60"
set "PUSH_TOKEN="

if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if "%%A"=="PUSH_TOKEN" set "PUSH_TOKEN=%%B"
    if "%%A"=="EDGE_ORIGIN" set "EDGE_ORIGIN=%%B"
    if "%%A"=="REFRESH_MIN" set "REFRESH_MIN=%%B"
  )
)

if "%PUSH_TOKEN%"=="" (
  echo WARNING: PUSH_TOKEN missing in .env - edge sync is DISABLED.
  echo          The local page at http://127.0.0.1:8080 still works.
  set "PUSH_URL="
) else (
  set "PUSH_URL=%EDGE_ORIGIN%/api/push?token=%PUSH_TOKEN%"
)

echo ============================================================
echo   Lottery Analyzer - local data fetcher
echo   Public URL : %EDGE_ORIGIN%
echo   Strategy   : every 60 min; after each draw every 10 min
echo   Keep this window open. PC must stay on for auto updates.
echo ============================================================
echo.
echo Starting backend on port 8080 ...
"%NODE%" server.js 8080

echo.
echo Backend exited. Press any key to close.
pause >nul
