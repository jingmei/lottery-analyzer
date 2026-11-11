#!/usr/bin/env bash
# 部署 Cloudflare Worker。
# 关键：CLOUDFLARE_API_TOKEN 从仓库根目录的 .env 读取，绝不出现在命令行参数或对话里。
# 用法： bash scripts/deploy_worker.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/cf-worker"

# 载入根目录 .env（含 CLOUDFLARE_API_TOKEN 等），仅本次进程可见
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ROOT/.env"
  set +a
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "ERROR: .env 中缺少 CLOUDFLARE_API_TOKEN。" >&2
  echo "       请去 Cloudflare 后台（Profile → API Tokens）吊销旧 token、新建一个，" >&2
  echo "       然后把新值填入根目录 .env 的最后一行 CLOUDFLARE_API_TOKEN=..." >&2
  exit 1
fi

echo "==> 使用 .env 中的 CLOUDFLARE_API_TOKEN 部署 Worker（token 不回显）"
exec node node_modules/wrangler/bin/wrangler.js deploy "$@"
