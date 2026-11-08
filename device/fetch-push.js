#!/usr/bin/env node
/**
 * 彩票数据抓取推送器（常开设备版）
 * ------------------------------------------------------------
 * 用途：在「国内 IP 的常开设备」上定时运行，抓官方开奖数据并推送到 Cloudflare KV。
 *       电脑关机时由它兜底，保证每天至少 3 次同步。
 *
 * 特点：
 *   - 零依赖，只用 Node 内置模块（Node 16+ 即可，树莓派/NAS/旧手机 Termux 都能跑）
 *   - 单个彩种失败不会覆盖线上好数据：先读云端现有数据，按彩种合并
 *   - 全部失败时退出码 1，方便 cron / systemd 记录异常
 *
 * 用法：
 *   PUSH_URL="https://maicaipiao.top/api/push?token=xxx" node fetch-push.js
 *   或先创建 config.json（见 config.example.json），然后直接 node fetch-push.js
 *
 * 可选环境变量：
 *   PUSH_URL      完整推送地址（优先）
 *   EDGE_ORIGIN   站点地址，如 https://maicaipiao.top
 *   PUSH_TOKEN    推送密钥（与 Cloudflare 的 EDGE_PUSH_TOKEN 一致）
 *   FETCH_COUNT   每彩种抓取期数，默认 300
 *   LOG_FILE      追加日志到文件（可选）
 *   DRY_RUN=1     只抓取不推送，用于验证
 */
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const COUNT = Number(process.env.FETCH_COUNT || 300);
const TIMEOUT = 25000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const NAMES = { ssq: '双色球', dlt: '大乐透', kl8: '快乐8', fc3d: '福彩3D', qlc: '七乐彩', pl3: '排列3' };
const TYPES = ['ssq', 'dlt', 'kl8', 'fc3d', 'qlc', 'pl3'];

// ---------- 配置 ----------
function loadConfig() {
  const cfg = {};
  try {
    Object.assign(cfg, JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8')));
  } catch (e) { /* 没有配置文件就用环境变量 */ }
  const pushUrl = process.env.PUSH_URL || cfg.pushUrl ||
    (process.env.EDGE_ORIGIN && process.env.PUSH_TOKEN
      ? String(process.env.EDGE_ORIGIN).replace(/\/+$/, '') + '/api/push?token=' + process.env.PUSH_TOKEN
      : '');
  const edge = process.env.EDGE_ORIGIN || cfg.edgeOrigin ||
    (pushUrl ? pushUrl.split('/api/push')[0] : '');
  return { pushUrl, edge, logFile: process.env.LOG_FILE || cfg.logFile || '' };
}

const CFG = loadConfig();

// ---------- 日志 ----------
function log(msg) {
  const line = '[' + new Date().toLocaleString('zh-CN') + '] ' + msg;
  console.log(line);
  if (CFG.logFile) {
    try { fs.appendFileSync(CFG.logFile, line + '\n'); } catch (e) { /* 忽略 */ }
  }
}

// ---------- HTTP ----------
function request(url, options) {
  options = options || {};
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(new Error('bad url: ' + url)); }
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: Object.assign({ 'User-Agent': UA }, options.headers || {}),
      timeout: options.timeout || TIMEOUT
    }, res => {
      let d = '';
      res.setEncoding('utf8');
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

const yi = v => {
  const n = Number(String(v || '').replace(/,/g, ''));
  if (!isFinite(n) || n <= 0) return '-';
  return (n / 1e8).toFixed(2) + '亿';
};
const nums = s => String(s || '').split(/[,\s]+/).filter(Boolean).map(Number);

// ---------- 官方数据源 ----------
// 中彩网：双色球 / 福彩3D / 快乐8 / 七乐彩
async function fetchCwl(name, count) {
  const r = await request(
    'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=' + name + '&issueCount=' + count,
    { headers: { Referer: 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/', Accept: 'application/json, text/plain, */*' } });
  if (r.status !== 200) throw new Error('cwl ' + name + ' HTTP ' + r.status);
  const j = JSON.parse(r.body);
  if (!j || !Array.isArray(j.result)) throw new Error('cwl ' + name + ' 返回格式异常');
  return j.result.map(d => ({
    period: d.code,
    date: String(d.date).slice(0, 10),
    red: nums(d.red),
    blue: d.blue === '' || d.blue == null ? [] : nums(d.blue),
    sales: yi(d.sales),
    pool: yi(d.poolmoney),
    firstPrize: (d.prizegrades && d.prizegrades[0] && d.prizegrades[0].typenum) || '-',
    prizeMoney: (d.prizegrades && d.prizegrades[0] && d.prizegrades[0].typemoney) || ''
  }));
}

// 中国体彩：大乐透 gameNo=85 / 排列3 gameNo=35
async function fetchSport(gameNo, count) {
  const out = [];
  let page = 1;
  while (out.length < count) {
    const r = await request(
      'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=' + gameNo +
      '&provinceId=0&pageSize=100&isVerify=1&pageNo=' + page,
      { headers: { Referer: 'https://www.lottery.gov.cn/', Accept: 'application/json, text/plain, */*' } });
    if (r.status !== 200) throw new Error('sporttery ' + gameNo + ' HTTP ' + r.status);
    const j = JSON.parse(r.body);
    const list = (j.value && j.value.list) || [];
    if (!list.length) break;
    for (const d of list) {
      const p0 = (d.prizeLevelList && d.prizeLevelList[0]) || {};
      out.push({
        period: d.lotteryDrawNum,
        date: d.lotteryDrawTime,
        red: nums(d.lotteryDrawResult),
        sales: yi(d.salesAmount),
        pool: (d.poolBalanceAfterdraw && d.poolBalanceAfterdraw !== '0')
          ? (Number(String(d.poolBalanceAfterdraw).replace(/,/g, '')) / 1e8).toFixed(2) + '亿' : '-',
        firstPrize: p0.stakeCount || '-',
        prizeMoney: p0.stakeAmount || ''
      });
    }
    page++;
    if (page > 12) break;
  }
  return out.slice(0, count);
}

// ---------- 格式化（与前端契约一致） ----------
function fmt(d, type) {
  const pm = d.prizeMoney ? (Math.round(Number(String(d.prizeMoney).replace(/,/g, '')) / 1e4) + '万') : '-';
  const base = { period: d.period, date: d.date, sales: d.sales, pool: d.pool, firstPrize: d.firstPrize || '-', prizeAmount: pm };
  if (type === 'ssq') return Object.assign(base, { numbers: { red: d.red, blue: d.blue } });
  if (type === 'dlt') return Object.assign(base, { numbers: { front: d.red.slice(0, 5), back: d.red.slice(5, 7) } });
  if (type === 'kl8') return Object.assign(base, { numbers: { selected: d.red } });
  if (type === 'fc3d' || type === 'pl3') return Object.assign(base, { numbers: { digits: d.red } });
  if (type === 'qlc') return Object.assign(base, { numbers: d.red, blue: (d.blue && d.blue.length) ? d.blue[0] : null });
  return base;
}

const JOBS = [
  ['ssq', () => fetchCwl('ssq', COUNT)],
  ['fc3d', () => fetchCwl('3d', COUNT)],
  ['kl8', () => fetchCwl('kl8', COUNT)],
  ['qlc', () => fetchCwl('qlc', COUNT)],
  ['dlt', () => fetchSport('85', COUNT)],
  ['pl3', () => fetchSport('35', COUNT)]
];

function snapshot(data) {
  return TYPES.map(t => {
    const arr = data[t] || [];
    return {
      type: t,
      name: NAMES[t],
      count: arr.length,
      latest: arr[0] ? arr[0].period : null,
      latestDate: arr[0] ? arr[0].date : null,
      oldest: arr[arr.length - 1] ? arr[arr.length - 1].period : null,
      oldestDate: arr[arr.length - 1] ? arr[arr.length - 1].date : null
    };
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 主流程 ----------
async function main() {
  if (!CFG.pushUrl && process.env.DRY_RUN !== '1') {
    log('缺少推送地址：请设置 PUSH_URL，或在 config.json 里配置 edgeOrigin + pushToken');
    process.exit(2);
  }

  // 1) 先取云端现有数据，作为单个彩种失败时的兜底（避免用残缺数据覆盖好数据）
  let remote = null;
  if (CFG.edge) {
    try {
      const r = await request(CFG.edge + '/api/data', { timeout: 15000 });
      if (r.status === 200) {
        const j = JSON.parse(r.body);
        if (j && j.data && Object.keys(j.data).length) remote = j.data;
      }
    } catch (e) {
      log('读取云端现有数据失败（不影响抓取）：' + e.message);
    }
  }

  // 2) 逐彩种抓取，间隔 300ms，避免给官网压力
  const data = {};
  const errors = [];
  let okCount = 0;
  for (const [type, job] of JOBS) {
    try {
      const rows = await job();
      if (!rows.length) throw new Error('返回 0 条');
      data[type] = rows.map(d => fmt(d, type));
      okCount++;
      log(NAMES[type] + '  更新 ' + rows.length + ' 期  最新 ' + rows[0].period + ' (' + rows[0].date + ')');
    } catch (e) {
      errors.push(type + ': ' + e.message);
      log(NAMES[type] + '  抓取失败：' + e.message);
    }
    await sleep(300);
  }

  // 3) 失败彩种沿用云端旧数据
  for (const t of TYPES) {
    if (!data[t] && remote && remote[t] && remote[t].length) {
      data[t] = remote[t];
      log(NAMES[t] + '  沿用云端已有数据（' + remote[t].length + ' 期）');
    }
  }

  if (!okCount) {
    log('全部彩种抓取失败，本次不推送');
    process.exit(1);
  }

  const payload = {
    ok: true,
    updatedAt: Date.now(),
    updatedAtText: new Date().toLocaleString('zh-CN'),
    intervalMs: 8 * 3600 * 1000,
    intervalMin: 480,
    refreshing: false,
    rounds: 1,
    errors: [],          // 技术性失败不上前端展示
    notice: null,
    blockedCount: errors.length,
    types: snapshot(data),
    data: data
  };

  if (process.env.DRY_RUN === '1') {
    log('DRY_RUN：抓取成功 ' + okCount + ' 个彩种，未推送');
    return;
  }

  const body = JSON.stringify(payload);
  const r = await request(CFG.pushUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), Accept: 'application/json' },
    body: body,
    timeout: 30000
  });
  if (r.status === 200) {
    log('推送成功 ' + Math.round(body.length / 1024) + 'KB（' + okCount + '/6 个彩种新抓）');
  } else {
    log('推送失败 HTTP ' + r.status + '：' + String(r.body).slice(0, 200));
    process.exit(1);
  }
}

main().catch(e => {
  log('运行异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
