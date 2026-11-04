# 安全与隐私

## 隐私承诺

- **不收集**：姓名、手机号、身份证、位置、设备标识等任何可识别个人身份的信息。
- **不上传**：拍照识别在浏览器本地用 Tesseract.js 完成，图片与识别文字不出本机；中奖录入与提醒只存 `localStorage`。
- **不追踪**：无账号体系、无登录、无第三方统计或广告 SDK、无追踪 Cookie。
- **服务端只存公开数据**：边缘 KV 中仅有公开的历史开奖数据，不含任何用户数据。
- 详见 [about.html](cf-worker/public/about.html)。

## 密钥管理

| 密钥 | 存放位置 | 绝不放在 |
|---|---|---|
| 推送密钥 | 本机 `.env` 的 `PUSH_TOKEN` + Worker secret `EDGE_PUSH_TOKEN` | 代码、`wrangler.toml`、Git、聊天记录 |
| Cloudflare API Token | 临时环境变量 `CLOUDFLARE_API_TOKEN` | 任何文件、仓库、日志 |
| GitHub 凭据 | 本机 credential helper / SSH key | 仓库、聊天记录 |

- `.env`、`.dev.vars`、`*.tmp`、`_archive/` 已被 `.gitignore` 排除。
- `wrangler.toml` 里**没有**任何密钥，只有 KV id（公开标识符）和域名。
- `/api/push` 在未配置密钥或密钥错误时一律返回 403；空 token 不能绕过。
- 如果密钥疑似泄露：重新生成随机值 → `wrangler secret put EDGE_PUSH_TOKEN` → 更新本机 `.env` → 重启 `server.js` → 在 Cloudflare 后台撤销旧 API Token。

## 已启用 / 待生效的安全设置

- [x] Cloudflare *Always Use HTTPS*：HTTP 请求 301 跳 HTTPS；Minimum TLS 1.2（已在线验证）。
- [x] `/api/push` 鉴权：未配置密钥或密钥错误一律 403（已在线验证）。
- [x] `/.well-known/security.txt` 提供联系与隐私策略入口（已在线验证 200）。
- [ ] Worker 响应头：HSTS (`max-age=31536000`)、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`X-Frame-Options: SAMEORIGIN`；HTML 短时缓存（`max-age=600, stale-while-revalidate`），API 保持 `no-store`。

> **重要**：Workers Assets 的 `run_worker_first` 默认 `false`，此时 Cloudflare 会直接返回静态资源、**根本不执行 Worker**，上面那些写在 `worker.js` 里的响应头就会全部失效。`wrangler.toml` 已设为 `run_worker_first = true`，但**需要重新执行一次 `wrangler deploy` 才会在线生效**。
> 验证方法：`curl -I https://<域名>/` 应能看到 `Strict-Transport-Security` 与 `Cache-Control: public, max-age=600...`；若只看到 `max-age=0, must-revalidate`，说明 Worker 没被执行。

## 报告安全问题

请通过仓库 Issues 反馈，或按 `/.well-known/security.txt` 中的 Contact 联系。**不要在公开 Issue 里粘贴密钥、token 或可利用的详情**；涉及凭据请私下说明。

## 已知的平台侧注意

- 海外边缘接入在法律上不需要 ICP 备案，但微信与部分国产手机浏览器会对未备案域名弹软提示，或被安全厂商的网址信誉库标记。这是平台策略，不是站点被入侵；处理方式见 [申诉指南](docs/APPEAL.md)。
- 直连 Cloudflare 海外节点在国内链路上存在波动，属网络质量问题，与安全性无关。
