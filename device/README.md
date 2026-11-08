# 常开设备抓取器（电脑关机时的兜底）

电脑关机/离线时，由家里一台常开设备负责抓官方开奖数据并推送到 Cloudflare。
脚本零依赖，只要有 **Node.js 16+** 就能跑。

## 为什么必须用国内设备

中彩网 `cwl.gov.cn`、体彩 `webapi.sporttery.cn` 对**海外 IP 一律 403**（网宿云 WAF）。
Cloudflare Worker 的出口全在海外，所以边缘节点抓不了；只能靠国内 IP 的设备来抓。

## 定时策略

要求是「每天至少 3 次」，推荐这三个时间点：

| 时间 | 目的 |
|---|---|
| 09:00 | 早上补昨夜数据 |
| 15:00 | 白天巡检 |
| 21:40 | **开奖后**（3D 21:15、按列3 21:25、快乐8 21:30、双色球 21:15、大乐透 20:30 都已开完） |

21:40 这一次最关键，保证当天所有彩种的开奖结果都能进来。

## 通用配置

把 `config.example.json` 复制成 `config.json`，填两处：

```json
{
  "edgeOrigin": "https://maicaipiao.top",
  "pushToken": "和本机 .env 里的 PUSH_TOKEN 完全一致",
  "fetchCount": 300,
  "logFile": "fetch.log"
}
```

也可以完全用环境变量（适合 Docker）：

```bash
EDGE_ORIGIN=https://maicaipiao.top PUSH_TOKEN=xxx node fetch-push.js
```

先验证一次（只抓不推）：

```bash
DRY_RUN=1 EDGE_ORIGIN=https://maicaipiao.top node fetch-push.js
```

正常会看到 6 个彩种各 300 期。确认无误后去掉 `DRY_RUN` 再跑一次，看到「推送成功」即可。

---

## 方案 A：旧安卓手机（Termux，最省事）

1. 应用商店或 [F-Droid](https://f-droid.org/packages/com.termux/) 装 Termux
2. 打开 Termux，执行：

```bash
pkg update && pkg install -y nodejs cronie
mkdir -p ~/lottery && cd ~/lottery
# 把 fetch-push.js 和 config.json 传进来（可用微信/QQ 传文件后 cp，或 U 盘）
node fetch-push.js          # 先手动跑一次验证
```

3. 设置定时（每天 9:00 / 15:00 / 21:40）：

```bash
crontab -e
```

粘贴：

```
0 9,15 * * * cd ~/lottery && /data/data/com.termux/files/usr/bin/node fetch-push.js >> fetch.log 2>&1
40 21 * * * cd ~/lottery && /data/data/com.termux/files/usr/bin/node fetch-push.js >> fetch.log 2>&1
```

4. 启动 cron 并保持后台运行：

```bash
crond
termux-wake-lock
```

5. **必须做的两件事**（否则安卓会杀后台）：
   - 手机设置 → 应用 → Termux → 电池 → 选「不限制 / 允许后台活动」
   - 手机一直插着电，关掉省电模式

验证：`tail -f ~/lottery/fetch.log`，等到点看有没有「推送成功」。

---

## 方案 B：树莓派 / NAS / 任意 Linux

脚本放好后（例如 `/opt/lottery/fetch-push.js`），用 systemd 定时：

```bash
sudo mkdir -p /opt/lottery && sudo cp fetch-push.js config.json /opt/lottery/
sudo cp lottery-fetch.service lottery-fetch.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lottery-fetch.timer
systemctl list-timers lottery-fetch.timer   # 确认下次触发时间
```

立刻手动触发一次：

```bash
sudo systemctl start lottery-fetch.service
journalctl -u lottery-fetch.service -n 30 --no-pager
```

> 群晖/威联通如果不想折腾 systemd，直接在「任务计划」里加一个每日定时任务，
> 命令填 `cd /volume1/lottery && /usr/local/bin/node fetch-push.js`，
> 分别建 9:00、15:00、21:40 三条（或用 crontab）。

---

## 方案 C：Docker（NAS 常见）

```bash
docker run -d --name lottery-fetch --restart unless-stopped \
  -e EDGE_ORIGIN=https://maicaipiao.top \
  -e PUSH_TOKEN=你的token \
  -v /path/to/fetch-push.js:/app/fetch-push.js:ro \
  node:20-alpine \
  sh -c 'while true; do node /app/fetch-push.js; sleep 21600; done'
```

`21600` 秒 = 6 小时，等于每天 4 次；要严格 3 次可改成 `28800`（8 小时），
但建议保留 21:40 那次的思路，用宿主机 cron 更可控。

---

## 和本机的关系

- 两边**不冲突**：本机 `server.js` 和常开设备都往同一个 `/api/push` 推，谁更新用谁的。
- 脚本推送前会先读云端现有数据，某个彩种抓失败时**沿用云端旧数据**，不会把好数据覆盖成空的。
- 推送密钥一致即可，不要写进仓库（`config.json` 已在 `.gitignore` 里）。

## 常见问题

| 现象 | 原因 |
|---|---|
| `HTTP 403` + 「网宿云安全」 | 出口不是国内 IP，或请求过于频繁 |
| `HTTP 403 bad token` | `pushToken` 和 Cloudflare 的 `EDGE_PUSH_TOKEN` 不一致 |
| `全部彩种抓取失败` | 设备没网 / DNS 异常 / 出口在海外 |
| 定时不执行（安卓） | 未关闭电池优化，或 Termux 被系统清理 |
