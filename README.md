# 彩票历史数据统计分析工具

> 一个**单文件、零后端依赖**的开源工具，用于整理和可视化中国福利彩票 / 体育彩票的**历史开奖数据**：频次统计、走势图表、遗漏分析、拍照识别录入、开奖提醒。
> 可选配 Cloudflare Worker + KV，实现手机随时访问；数据由国内本机抓取后推送到边缘。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)](README.md)
[![Single file](https://img.shields.io/badge/frontend-single%20html-orange.svg)](lottery-analyzer.html)

---

## ⚠️ 免责声明（请先读）

- 本站/本工具是**个人开源、非商业、非官方**的历史数据整理与统计项目，与各级彩票发行、销售机构**没有任何关联**。
- **彩票开奖为独立随机事件，不存在可预测规律。** 页面中的号码组合仅为统计模型基于历史频次的输出，**不构成投注建议，不保证任何中奖结果**。
- 本工具**不销售彩票、不代购、不充值、不兑奖、不收费、不含广告**，不含任何购买链接。
- 数据仅供参考，不保证完整、及时或绝对准确，请以官方公布为准。
- 请理性购彩、量力而行；**未满 18 周岁请勿购彩**。
- 不收集、不上传任何个人信息；拍照识别与数据分析均在本机浏览器内完成。详见 [about.html](cf-worker/public/about.html) 与 [SECURITY.md](SECURITY.md)。

---

## 它解决什么问题

官方站点只提供开奖结果列表，想看「近 30/50/100 期频次、遗漏、走势、奇偶和值、历史对照」要自己导数据算。本项目把这些做成一个**打开就能用的单页**，并内置 300 期历史快照，**没网也能用**。

### 主要功能

| 模块 | 说明 |
|---|---|
| 六大彩种 | 双色球、大乐透、快乐8、福彩3D、七乐彩、排列3 |
| 简单版 | 历史统计参考组合、最近一期、近 100 期速览 |
| 专业版 | 三窗口频次（30/50/100 期）、遗漏、走势、奇偶 / 和值 / 跨度、图表、奖级期望值分析 |
| 拍照识别 | 浏览器本地 OCR（Tesseract.js），按行识别投注号码并自动标注命中行，支持粘贴文字 |
| 中奖录入与提醒 | 本地保存（localStorage），不上传 |
| 离线可用 | 内嵌 300 期快照，边缘数据不可用时自动回退，不会白屏 |
| 智能刷新 | 平时 60 分钟；每次开奖后 +20 分钟起每 10 分钟抓一次，直到拿到新期号 |

### 它**不是**什么

不是预测软件、不是荐号服务、不是投注平台、不是官方网站、不含任何商业推广。详见 [合规说明](docs/COMPLIANCE.md)。

---

## 架构

```
┌──────────────────────┐   国内 IP 正常访问    ┌────────────────────────┐
│  本机 server.js      │ ───────────────────▶ │ cwl.gov.cn / 体彩接口   │
│  (抓数 + 推送)        │ ◀─────────────────── │ 官方公开开奖数据        │
│  http://127.0.0.1:8080│      200 / JSON      └────────────────────────┘
└──────────┬───────────┘
           │ POST /api/push?token=xxx   （HTTPS，带密钥）
           ▼
┌──────────────────────────────────────────────────────────┐
│  Cloudflare Worker (maicaipiao.top)                      │
│   • 静态页面 assets 直出（HTML 短时缓存）                 │
│   • /api/data、/api/status 只读 KV                       │
│   • /api/push 接收本机推送并写 KV                        │
│   • 不在边缘抓官网（海外 IP 会被网宿 WAF 403 拦截）      │
└──────────────────────┬───────────────────────────────────┘
                       │  手机 / 微信 / 任意浏览器
                       ▼
              https://maicaipiao.top
```

**为什么必须有一台国内本机？** 海外 Worker 抓 `cwl.gov.cn` 会返回 `403 网宿云安全平台`，抓 `webapi.sporttery.cn` 返回 `567` 反爬页。因此数据只能在**国内 IP** 抓取后推送到边缘 KV，手机读的是边缘缓存。电脑关机后页面仍可打开（KV 缓存 + 页面内嵌快照），但数据冻结在最后一次同步。

---

## 快速开始

### 方式一：纯离线（最简单，零配置）

直接用浏览器打开 `lottery-analyzer.html`。会用内嵌的 300 期快照渲染，拍照识别、图表等前端功能都可用（`file://` 下不连接数据服务）。

> 图表与 OCR 需要加载 CDN 上的 Chart.js / Tesseract.js；完全离线时这两个功能不可用，其余分析功能正常。

### 方式二：本机运行（推荐，国内秒开）

```bash
node server.js 8080
# 打开 http://127.0.0.1:8080
```

Windows 用户可直接双击 `start_lottery.bat`。它会从 `.env` 读取配置：

```bash
cp .env.example .env
# 编辑 .env 填入 PUSH_TOKEN（详见下一节）
```

`server.js` 是零依赖 Node 脚本，职责：抓官方公开数据 → 写 `live-data.json` → 推到边缘 KV → 提供本机 `/api/*`。

**刷新策略**（北京时间，UTC+8 显式换算）：

| 彩种 | 开奖时间 |
|---|---|
| 双色球 | 周二 / 四 / 日 21:15 |
| 大乐透 | 周一 / 三 / 六 20:30 |
| 七乐彩 | 周一 / 三 / 五 21:15 |
| 福彩3D | 每日 21:15 |
| 排列3 | 每日 21:25 |
| 快乐8 | 每日 21:30 |

平时每 60 分钟刷新一次；开奖后 +20 分钟起每 10 分钟抓一次，直到抓到该彩种新一期期号（最多追到 +80 分钟）。抓取失败自动退避，并保留上次成功数据。

### 方式三：公网部署（Cloudflare Worker + KV）

1. **准备 Cloudflare**：域名接入 Cloudflare，创建 KV namespace，取得 `account_id` 与一个有 `Workers Scripts / KV / Routes / Zone Settings` 编辑权限的 API Token。
2. **改配置** `cf-worker/wrangler.toml`：
   - `[[kv_namespaces]] id` 换成你自己的 KV id
   - `[[routes]]` 换成你自己的域名
3. **设置推送密钥**（两边用**同一个值**）：

   ```bash
   # 生成一个随机密钥
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

   # 写入 Worker secret（不要写进 wrangler.toml）
   cd cf-worker
   wrangler secret put EDGE_PUSH_TOKEN

   # 把同一个值填进项目根目录 .env 的 PUSH_TOKEN
   ```
4. **部署**：

   ```bash
   cd cf-worker
   CLOUDFLARE_API_TOKEN=xxx wrangler deploy
   ```
   部署前确保 `cf-worker/public/index.html` 与根目录 `lottery-analyzer.html` 一致：
   ```bash
   cp lottery-analyzer.html cf-worker/public/index.html
   ```
5. **开启 Always Use HTTPS**：Cloudflare 控制台 → SSL/TLS → Edge Certificates → 打开 *Always Use HTTPS*，并把 Minimum TLS Version 设为 1.2。也可通过 API：
   ```
   PATCH /zones/{zone_id}/settings/always_use_https   {"value":"on"}
   PATCH /zones/{zone_id}/settings/min_tls_version    {"value":"1.2"}
   ```
6. **启动本机推送**：双击 `start_lottery.bat`，保持电脑开机。

> 微信 / 手机浏览器可能对未备案域名弹出「ICP 备案」软提示，可点「继续访问」；若被安全厂商标记为风险网站，见 [申诉指南](docs/APPEAL.md)。

---

## 目录结构

```
.
├── lottery-analyzer.html          # 主页面（单文件前端，含内嵌 300 期快照）
├── server.js                      # 本机零依赖抓数 / 推送服务
├── start_lottery.bat              # Windows 一键启动（读取 .env）
├── .env.example                   # 本地配置模板（.env 不入库）
├── .gitignore
├── LICENSE                        # MIT
├── scripts/
│   └── compliance-check.cjs       # 敏感词 / 合规检查，可复跑（--fix 自动整改）
├── docs/
│   ├── COMPLIANCE.md              # 合规检查报告与整改清单
│   ├── APPEAL.md                  # 浏览器风险提示 / 微信拦截 申诉模板
│   ├── GITHUB_SETUP.md            # 推送到 GitHub 的步骤（PAT / SSH）
│   └── PROMOTION.md               # 免费推广渠道与方法
└── cf-worker/
    ├── worker.js                  # Cloudflare Worker（静态 + KV + /api/push）
    ├── wrangler.toml              # 部署配置
    └── public/
        ├── index.html             # 部署副本
        ├── about.html             # 站点说明 / 隐私 / 免责 / 申诉入口
        └── .well-known/security.txt
```

`live-data.json`（本机运行时缓存，6 彩种 × 300 期）与 `_archive/` 不入库。

---

## 接口

| 路径 | 说明 |
|---|---|
| `GET /api/data` | 读 KV 中的全量数据；无数据时返回空 `data`，页面回退内嵌快照 |
| `GET /api/status` | 同步状态、下次开奖时间、友好提示（技术错误已转为人话） |
| `GET /api/refresh` | 只返回状态，**不触发抓取**（边缘不抓官网） |
| `POST /api/push?token=xxx` | 本机推送；未配置密钥或密钥错误一律 403 |
| `GET /api/health` | 健康检查 |
| `GET /about.html` | 站点说明 / 隐私 / 免责 |

---

## 常见问题

**页面慢 / 白屏？**
直连 Cloudflare 海外节点在国内链路上会波动，大响应可能被截断。已做三重缓解：HTML 允许 10 分钟浏览器缓存、数据请求 8 秒超时 + 2 次重试、断线后每 30 秒自动重连；始终有内嵌快照兜底。笔记本/本机建议直接访问 `http://127.0.0.1:8080`，实测 0.003 秒完整返回。

**显示「数据源限流」？**
官方源对高频请求会返回 403/567。已降低到平时 60 分钟、只在开奖后密集重试，并保留上次成功数据；页面显示友好提示而非技术错误。

**微信提示 ICP 备案 / 浏览器提示风险网站？**
海外接入在法律上不需要 ICP 备案，但微信与部分手机浏览器会对未备案域名弹软提示。可点「继续访问」；如需消除，走 [申诉流程](docs/APPEAL.md)。

**电脑关机后还能看吗？**
能。页面与最后一次同步的数据都在边缘，但**数据不再更新**——必须跑本机才能抓新数据。

---

## 参与贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。提交前请运行：

```bash
node scripts/compliance-check.cjs
```

## 许可证

[MIT](LICENSE)。附加的合规与免责说明见 [about.html](cf-worker/public/about.html)。
