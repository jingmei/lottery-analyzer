#!/bin/bash
# 彩票分析器站点网速监测脚本
# 由 Windows 任务计划程序每 10 分钟调用；测量 maicaipiao.top 三端点响应耗时，
# 作为手机端访问网速的代理指标（手机版与网页版共用同一边缘节点与数据接口）。

# 调度器直接拉起 bash 时是非登录环境，/usr/bin 可能不在 PATH；这里自给自足补上，
# 保证 awk/date/tee/mkdir/curl 等命令都能找到（不影响交互式运行）。
export PATH="/usr/bin:/bin:/c/Windows/System32:$PATH"

PROJ="/c/Users/jingmei/WorkBuddy/2026-10-29-16-28-04"
LOG="$PROJ/_archive/logs/netcheck.log"
URL_BASE="https://maicaipiao.top"
CURL="$(command -v curl 2>/dev/null || echo /c/Windows/System32/curl.exe)"

mkdir -p "$PROJ/_archive/logs"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

{
  echo "===== $TS ====="
  for ep in "/api/status" "/api/data" "/"; do
    out="$("$CURL" -s -o /dev/null -w '%{http_code} %{time_total} %{time_starttransfer}' --max-time 15 "${URL_BASE}${ep}")"
    code="$(echo "$out" | awk '{print $1}')"
    total="$(echo "$out" | awk '{print $2}')"
    ttfb="$(echo "$out" | awk '{print $3}')"
    flag=""
    if awk -v t="$total" 'BEGIN{exit !(t+0>5)}'; then flag=" [SLOW]"; fi
    if [ "$code" != "200" ]; then flag="${flag} [FAIL]"; fi
    printf '%-14s HTTP=%s total=%ss ttfb=%ss%s\n' "$ep" "$code" "$total" "$ttfb" "$flag"
  done
} | tee -a "$LOG"
