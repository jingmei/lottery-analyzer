# Lottery History Data Analyzer

> A **single-file, zero-back-end-dependency** open-source tool for organizing and visualizing the **published draw history** of China Welfare Lottery and China Sports Lottery: frequency statistics, trend charts, omission analysis, OCR-based number entry and draw reminders.
> Optionally pairs with Cloudflare Worker + KV so it can be opened on a phone; data is fetched on a machine in mainland China and pushed to the edge.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)](README.en.md)
[![Single file](https://img.shields.io/badge/frontend-single%20html-orange.svg)](lottery-analyzer.html)

> **Repository**: https://github.com/jingmei/lottery-analyzer 　·　 **Gitee mirror**: https://gitee.com/respectfully-mei/lottery-analyzer
> **Live site** (Chinese interface): https://maicaipiao.top 　·　 **English site notice**: https://maicaipiao.top/en
> Full documentation in Chinese: [README.md](README.md).

---

## Disclaimer (please read first)

- This is a **personal, open-source, non-commercial, non-official** project for historical data organization. It has **no affiliation** with any lottery issuer, seller or regulator.
- **Lottery draws are independent random events; there is no predictable pattern.** Any number sets shown are descriptive outputs derived from historical frequencies. They **do not constitute betting advice, make no prediction claims, and guarantee no outcome**.
- This tool **does not sell tickets, does not purchase on behalf of anyone, has no top-ups or redemptions, charges nothing and carries no advertising**. There are no purchase links.
- Data is for research reference only and is not guaranteed to be complete, timely or perfectly accurate; always refer to official announcements.
- Play responsibly and within your means; **do not purchase lottery tickets if you are under 18**.
- **No personal information is collected or uploaded.** OCR and data analysis run entirely in your local browser. See [en.html](cf-worker/public/en.html) and [SECURITY.md](SECURITY.md).

---

## What it does

Official sites only publish lists of draw results. If you want 30/50/100-draw frequencies, omission values, trends, odd/even and sum charts, or historical comparisons, you normally have to export and compute the data yourself. This project puts all of that into **one HTML page you can just open**, with a 300-draw snapshot embedded so it also works offline.

| Module | Description |
|---|---|
| Six games | Shuangseqiu, Daletou, Kuaile 8, Fucai 3D, Qilecai, Pailie 3 |
| Simple view | Historical statistics, latest draw, last 100 draws at a glance |
| Advanced view | Frequency over 30/50/100 draws, omission, trends, odd/even, sum, span, charts, prize-level expected value |
| OCR entry | Browser-local Tesseract.js; recognizes number lines and highlights matched rows; also accepts pasted text |
| Result entry and reminders | Saved locally in `localStorage`, never uploaded |
| Offline | Embedded 300-draw snapshot; falls back automatically when edge data is unavailable |
| Smart refresh | Every 60 minutes normally; after each draw, retries every 10 minutes from +20 minutes until the new period arrives |

### What it is NOT

Not a prediction tool, not a number-picking service, not a betting platform, not an official website, and not commercial. No feature implies a higher chance of winning. See [docs/COMPLIANCE.md](docs/COMPLIANCE.md).

---

## Architecture

```
  Local machine (mainland China)            Official public draw results
  server.js  -- fetch ----------------->  cwl.gov.cn / sporttery API
     |  writes live-data.json
     |  POST /api/push?token=...  (HTTPS, shared secret)
     v
  Cloudflare Worker (maicaipiao.top)
     |  static assets (HTML short cache + security headers)
     |  /api/data, /api/status  read KV only
     |  /api/push  writes KV
     v
  Phone / any browser  ->  https://maicaipiao.top
```

**Why a local machine is required:** an overseas Worker fetching `cwl.gov.cn` gets a `403` from the WAF, and `webapi.sporttery.cn` returns an anti-bot page. Data therefore has to be fetched from a mainland-China IP and pushed to the edge KV; phones read the edge cache. With the computer off, the page still opens (KV cache + embedded snapshot), but the data freezes at the last sync.

---

## Quick start

### 1. Offline, zero configuration

Open `lottery-analyzer.html` in a browser. The embedded 300-draw snapshot renders everything locally. Charts and OCR need Chart.js / Tesseract.js from a CDN; the analysis features work without them.

### 2. Local server

```bash
node server.js 8080
# open http://127.0.0.1:8080
```

On Windows, double-click `start_lottery.bat`. It reads `.env` (copy from `.env.example`); `server.js` has zero dependencies.

### 3. Public deployment (Cloudflare Worker + KV)

See [README.md](README.md) for the full step-by-step. In short: create a KV namespace, edit `cf-worker/wrangler.toml`, set the shared secret with `wrangler secret put EDGE_PUSH_TOKEN`, then `wrangler deploy`. On Windows you can double-click `deploy-worker.bat`, which prompts for a Cloudflare API Token without saving it.

> Keep `run_worker_first = true` in `wrangler.toml`. With the default `false`, Cloudflare returns static assets directly and the Worker never runs, so the caching and security headers added in `worker.js` are all silently lost.

Before deploying, sync the asset copy:

```bash
cp lottery-analyzer.html cf-worker/public/index.html
```

---

## Draw schedule (Beijing time, UTC+8)

| Game | Draw time |
|---|---|
| Shuangseqiu | Tue / Thu / Sun 21:15 |
| Daletou | Mon / Wed / Sat 20:30 |
| Qilecai | Mon / Wed / Fri 21:15 |
| Fucai 3D | Daily 21:15 |
| Pailie 3 | Daily 21:25 |
| Kuaile 8 | Daily 21:30 |

---

## API

| Path | Description |
|---|---|
| `GET /api/data` | Full data from KV; empty `data` makes the page fall back to the embedded snapshot |
| `GET /api/status` | Sync state, next draw times, human-readable notices |
| `GET /api/refresh` | Status only; never triggers a fetch (the edge never fetches official sources) |
| `POST /api/push?token=...` | Push from the local machine; missing or wrong secret returns 403 |
| `GET /api/health` | Health check |
| `GET /about.html` | Chinese site notice, privacy and disclaimer |
| `GET /en` | English site notice, privacy and disclaimer |

---

## Contributing and compliance

See [CONTRIBUTING.md](CONTRIBUTING.md). Before submitting, run:

```bash
node scripts/compliance-check.cjs
```

All public-facing copy must stay consistent with the disclaimer above and with `cf-worker/public/about.html`. Never introduce wording that suggests prediction, improved odds, guaranteed results or betting advice. Free promotion channels (and their compliance red lines) are listed in [docs/PROMOTION.md](docs/PROMOTION.md).

## License

[MIT](LICENSE). Additional compliance and disclaimer notes: [en.html](cf-worker/public/en.html), [about.html](cf-worker/public/about.html).
