/**
 * 彩票实时数据分析服务
 * ---------------------------------------------
 * 1. 每 5 分钟（可配置）自动从中彩网 / 中国体彩官方接口拉取最新开奖数据
 * 2. 以 HTTP 服务方式对外提供页面 + JSON 数据接口
 * 3. 数据同时落盘 live-data.json，重启后秒级恢复
 *
 * 用法：
 *   node server.js            # 默认 8080 端口，5 分钟刷新
 *   node server.js 9000       # 指定端口
 *   REFRESH_MIN=10 node server.js 9000   # 指定刷新间隔（分钟）
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const REFRESH_MS = Number(process.env.REFRESH_MIN || 60) * 60 * 1000;
const FETCH_COUNT = Number(process.env.FETCH_COUNT || 300);   // 默认拉 300 期（分析窗口 30/50/100 需要足够样本）

// 访问令牌：设了才开启鉴权，不设则完全开放（保持原有行为）
// 用法：ACCESS_TOKEN=mySecret123 node server.js
// 访问：http://host:8080/?t=mySecret123   （首次访问后写入 cookie，之后无需带参）
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

// 边缘推送（备用方案，默认关闭）：把数据推到 Cloudflare Worker，供不开 VPN 时访问
// 需要启用时：PUSH_URL="https://你的域名/api/push?token=<PUSH_TOKEN>" node server.js
// 推荐把 PUSH_TOKEN 放在本地 .env 中，由 start_lottery.bat 读取，避免密钥入库。
const PUSH_URL = process.env.PUSH_URL || '';

const DIR = __dirname;
const HTML_FILE = path.join(DIR, 'lottery-analyzer.html');
const CACHE_FILE = path.join(DIR, 'live-data.json');

// ==================== 官方接口抓取 ====================
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function get(url, headers, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: Object.assign({
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*'
      }, headers || {}),
      timeout
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

const yi = v => {
  const n = Number(String(v || '').replace(/,/g, ''));
  if (!isFinite(n) || n <= 0) return '-';
  return (n / 1e8).toFixed(2) + '亿';
};
const nums = s => String(s || '').split(/[,\s]+/).filter(Boolean).map(Number);

// 中彩网：双色球 / 福彩3D / 快乐8 / 七乐彩
async function fetchCwl(name, count) {
  const r = await get(
    'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=' + name + '&issueCount=' + count,
    { Referer: 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/' });
  const j = JSON.parse(r.body);
  if (!j || !Array.isArray(j.result)) throw new Error('返回格式异常');
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
    const r = await get(
      'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=' + gameNo +
      '&provinceId=0&pageSize=100&isVerify=1&pageNo=' + page,
      { Referer: 'https://www.lottery.gov.cn/' });
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

// ==================== 格式转换（与前端一致） ====================
function fmt(d, type) {
  const pm = d.prizeMoney ? (Math.round(Number(String(d.prizeMoney).replace(/,/g, '')) / 1e4) + '万') : '-';
  const base = { period: d.period, date: d.date, sales: d.sales, pool: d.pool, firstPrize: d.firstPrize || '-', prizeAmount: pm };
  if (type === 'ssq')  return Object.assign(base, { numbers: { red: d.red, blue: d.blue } });
  if (type === 'dlt')  return Object.assign(base, { numbers: { front: d.red.slice(0, 5), back: d.red.slice(5, 7) } });
  if (type === 'kl8')  return Object.assign(base, { numbers: { selected: d.red } });
  if (type === 'fc3d') return Object.assign(base, { numbers: { digits: d.red } });
  if (type === 'pl3')  return Object.assign(base, { numbers: { digits: d.red } });
  if (type === 'qlc')  return Object.assign(base, { numbers: d.red, blue: (d.blue && d.blue.length) ? d.blue[0] : null });
  return base;
}

const TYPES = ['ssq', 'dlt', 'kl8', 'fc3d', 'qlc', 'pl3'];
const NAMES = { ssq: '双色球', dlt: '大乐透', kl8: '快乐8', fc3d: '福彩3D', qlc: '七乐彩', pl3: '排列3' };

const JOBS = [
  ['ssq',  () => fetchCwl('ssq', FETCH_COUNT)],
  ['fc3d', () => fetchCwl('3d', FETCH_COUNT)],
  ['kl8',  () => fetchCwl('kl8', FETCH_COUNT)],
  ['qlc',  () => fetchCwl('qlc', FETCH_COUNT)],
  ['dlt',  () => fetchSport('85', FETCH_COUNT)],
  ['pl3',  () => fetchSport('35', FETCH_COUNT)]
];

// ==================== 开奖时间表（北京时间） ====================
// weekdays: 0=周日,1=周一,…6=周六；null 表示每日开奖
const DRAW_SCHEDULE = {
  ssq:  { label: '双色球', time: '21:15', weekdays: [0, 2, 4] },
  dlt:  { label: '大乐透', time: '20:30', weekdays: [1, 3, 6] },
  qlc:  { label: '七乐彩', time: '21:15', weekdays: [1, 3, 5] },
  fc3d: { label: '福彩3D', time: '21:15', weekdays: null },
  pl3:  { label: '排列3',  time: '21:25', weekdays: null },
  kl8:  { label: '快乐8',  time: '21:30', weekdays: null }
};
const DRAW_OFFSET_MIN = 20;   // 开奖后多少分钟开始抓（等官方发布结果，尽早拿新一期）
const DRAW_STEP_MIN  = 10;    // 开奖窗口内每 10 分钟重试一次
const DRAW_MAX_MIN   = 80;    // 最多追到开奖后 80 分钟

// 北京时间 = UTC+8，无夏令时（避免服务器所在时区与北京不一致）
function beijingNow() {
  const d = new Date();
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 8 * 3600000);
}
function minutesOf(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }
function localDateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// 各彩种下一次开奖时间与对应的自动刷新时间（北京时间）
function nextDraws() {
  const now = beijingNow();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out = {};
  for (const [type, s] of Object.entries(DRAW_SCHEDULE)) {
    for (let add = 0; add <= 7; add++) {
      const d = new Date(now); d.setDate(d.getDate() + add);
      if (s.weekdays && s.weekdays.indexOf(d.getDay()) < 0) continue;
      const dm = minutesOf(s.time);
      if (add === 0 && nowMin >= dm) continue;          // 今天已过开奖时间
      const draw = new Date(d); draw.setHours(Math.floor(dm / 60), dm % 60, 0, 0);
      const refresh = new Date(draw.getTime() + DRAW_OFFSET_MIN * 60000);
      const rt = dm + DRAW_OFFSET_MIN;
      out[type] = {
        label: s.label,
        drawAt: draw.getTime(),
        drawAtText: localDateKey(draw) + ' ' + s.time,
        refreshAt: refresh.getTime(),
        refreshAtText: localDateKey(refresh) + ' ' + String(Math.floor(rt / 60)).padStart(2, '0') + ':' + String(rt % 60).padStart(2, '0')
      };
      break;
    }
  }
  return out;
}

// ==================== 智能抓取调度 ====================
// 平时低频（60 分钟）避免触发官网 WAF；每次开奖后及时、密集地抓，
// 直到拿到该彩种的新一期期号为止（数据未发布就继续重试）。
const drawDone = {};      // type:日期 -> 本期新数据已抓到
let lastFetchAt = 0;
let failStreak = 0;

function pendingDraw() {
  const now = beijingNow();
  const hm = now.getHours() * 60 + now.getMinutes();
  const wd = now.getDay();
  const dk = localDateKey(now);
  for (const [type, s] of Object.entries(DRAW_SCHEDULE)) {
    if (s.weekdays && s.weekdays.indexOf(wd) < 0) continue;
    const elapsed = hm - minutesOf(s.time);
    if (elapsed >= DRAW_OFFSET_MIN && elapsed <= DRAW_MAX_MIN && !drawDone[type + ':' + dk]) return s.label;
  }
  return null;
}

function smartTick() {
  if (STATE.refreshing) return;
  const pending = pendingDraw();
  const duePeriodic = Date.now() - lastFetchAt >= REFRESH_MS;
  if (!pending && !duePeriodic) return;
  // 开奖窗口每 10 分钟一次；连续被拒则退避到 20 分钟，避免加重限流
  const cooldown = pending ? (failStreak >= 2 ? 20 : DRAW_STEP_MIN) * 60000 : 0;
  if (Date.now() - lastFetchAt < cooldown) return;
  lastFetchAt = Date.now();
  refreshAll(pending ? '开奖后抓取·' + pending : '定时刷新');
}

function scheduleSmartRefresh() {
  setInterval(smartTick, 60 * 1000);
}

function buildPayload() {
  return {
    ok: true,
    updatedAt: STATE.updatedAt,
    updatedAtText: STATE.updatedAt ? new Date(STATE.updatedAt).toLocaleString('zh-CN') : null,
    nextAt: STATE.nextAt,
    intervalMs: STATE.intervalMs,
    intervalMin: Math.round(STATE.intervalMs / 60000),
    drawRefreshOffsetMin: DRAW_OFFSET_MIN,
    schedule: DRAW_SCHEDULE,
    nextDraws: nextDraws(),
    refreshing: STATE.refreshing,
    rounds: STATE.rounds,
    errors: [],                    // 技术性失败不直接展示，改用 notice
    notice: STATE.notice,
    blockedCount: STATE.blockedCount,
    types: snapshot(),
    data: STATE.data
  };
}

// ---------- 推送到 Cloudflare 边缘 ----------
let pushBusy = false;
function pushToEdge(retry) {
  retry = retry || 0;
  if (!PUSH_URL || pushBusy || !Object.keys(STATE.data).length) return;
  pushBusy = true;
  const t0 = Date.now();
  let body;
  try { body = JSON.stringify(buildPayload()); } catch (e) { pushBusy = false; return; }
  const retryLater = (msg) => {
    pushBusy = false;
    if (retry < 3) {
      const delay = 8000 * (retry + 1);
      console.log(`[${new Date().toLocaleTimeString('zh-CN')}] 边缘推送失败(${msg})，${delay / 1000}s 后重试 ${retry + 1}/3`);
      setTimeout(() => pushToEdge(retry + 1), delay);
    } else {
      console.log(`[${new Date().toLocaleTimeString('zh-CN')}] 边缘推送放弃(${msg})，本地服务不受影响`);
    }
  };
  const u = new URL(PUSH_URL);
  const req = https.request({
    hostname: u.hostname,
    path: u.pathname + u.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': UA
    },
    timeout: 90000
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      pushBusy = false;
      if (res.statusCode === 200) {
        console.log(`[${new Date().toLocaleTimeString('zh-CN')}] 边缘推送 200 (${((Buffer.byteLength(body)) / 1024).toFixed(0)}KB / ${Date.now() - t0}ms)`);
      } else {
        retryLater('HTTP ' + res.statusCode + ' ' + d.slice(0, 80));
      }
    });
  });
  req.on('error', e => retryLater(e.message));
  req.on('timeout', () => { req.destroy(); retryLater('超时'); });
  req.write(body);
  req.end();
}

// ==================== 全局状态 ====================
const STATE = {
  updatedAt: null,          // 上次成功更新时间戳
  nextAt: null,             // 下次刷新时间戳
  intervalMs: REFRESH_MS,
  refreshing: false,
  lastError: null,
  errors: [],               // 内部记录（不直接展示给用户）
  notice: null,             // 对外的人话提示
  blockedCount: 0,          // 本次被官方拒绝/限流的项数
  lastPeriod: {},           // 各彩种上次见到的最新期号（用于判定开奖后是否已抓到新一期）
  data: {},                 // { ssq: [...], dlt: [...] }
  rounds: 0
};

function snapshot() {
  return TYPES.map(t => {
    const list = STATE.data[t] || [];
    return {
      type: t, name: NAMES[t], count: list.length,
      latest: list[0] ? list[0].period : null,
      latestDate: list[0] ? list[0].date : null,
      oldest: list.length ? list[list.length - 1].period : null,
      oldestDate: list.length ? list[list.length - 1].date : null
    };
  });
}

async function refreshAll(reason) {
  if (STATE.refreshing) return { skipped: true };
  STATE.refreshing = true;
  const t0 = Date.now();
  const errors = [];
  const next = {};

  for (const [type, fn] of JOBS) {
    try {
      const arr = await fn();
      if (arr && arr.length) {
        next[type] = arr.map(d => fmt(d, type));
        console.log(`[${new Date().toLocaleTimeString('zh-CN')}] ${NAMES[type].padEnd(4)} 更新 ${String(arr.length).padStart(3)} 期  最新 ${arr[0].period} (${arr[0].date})`);
      } else {
        throw new Error('空数据');
      }
    } catch (e) {
      errors.push(`${NAMES[type]}: ${e.message}`);
      if (STATE.data[type] && STATE.data[type].length) next[type] = STATE.data[type]; // 保留上一次
    }
  }

  if (Object.keys(next).length) {
    STATE.data = next;
    STATE.updatedAt = Date.now();
    STATE.rounds++;
    // 开奖后判定：只有「当天确实开奖 + 处在开奖后窗口内 + 抓到新期号」才标记本期完成。
    // 否则白天重启时的首轮抓取会误标，导致当晚开奖后不再触发及时抓取。
    const bj = beijingNow();
    const hm = bj.getHours() * 60 + bj.getMinutes();
    const wd = bj.getDay();
    const dk = localDateKey(bj);
    for (const [type, arr] of Object.entries(next)) {
      const latest = arr[0] && arr[0].period;
      if (latest && latest !== STATE.lastPeriod[type]) {
        STATE.lastPeriod[type] = latest;
        const s = DRAW_SCHEDULE[type];
        const elapsed = hm - minutesOf(s.time);
        const isDrawDay = !s.weekdays || s.weekdays.indexOf(wd) >= 0;
        if (isDrawDay && elapsed >= 0 && elapsed <= DRAW_MAX_MIN) drawDone[type + ':' + dk] = true;
      }
    }
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify({ updatedAt: STATE.updatedAt, data: STATE.data }));
    } catch (e) { /* 落盘失败不影响服务 */ }
  }
  STATE.errors = errors;
  STATE.lastError = errors.length ? errors.join(' | ') : null;
  STATE.blockedCount = errors.length;
  STATE.notice = errors.length
    ? `官方数据源暂时限流或拒绝访问（${errors.length} 项未取到），已保留上次成功抓取的数据；系统会在每次开奖后自动重试，无需手动操作。`
    : null;
  failStreak = errors.length ? failStreak + 1 : 0;
  STATE.refreshing = false;
  STATE.nextAt = Date.now() + REFRESH_MS;

  const ms = Date.now() - t0;
  console.log(`[${new Date().toLocaleTimeString('zh-CN')}] 刷新完成(${reason}) 耗时 ${ms}ms` +
    (errors.length ? `  被拒 ${errors.length} 项（保留旧数据，稍后重试）` : '  全部成功'));
  pushToEdge();   // 后台推送到边缘，失败自动重试，不影响本地服务
  return { ok: true, ms, errors };
}

// ==================== HTTP 服务 ====================
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.ico': 'image/x-icon' };

function sendJSON(res, obj, code = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const p = u.pathname;

  // ---------- 访问令牌校验 ----------
  if (ACCESS_TOKEN) {
    // 健康检查永远放行，方便监控
    if (p === '/api/health') { sendJSON(res, { ok: true, uptime: process.uptime() }); return; }

    // 微信/第三方域名所有权验证文件（32位十六进制.txt）：即使开启令牌也放行，
    // 否则验证服务器不带令牌会被 403 挡掉，导致域名验证失败
    if (/^\/[0-9a-fA-F]{32}\.txt$/.test(p)) {
      const vf = path.join(DIR, path.normalize(p).replace(/^([/\\])+/, ''));
      if (vf.startsWith(DIR) && fs.existsSync(vf) && fs.statSync(vf).isFile()) { serveFile(res, vf); return; }
    }

    const cookie = req.headers.cookie || '';
    const hasCookie = cookie.split(';').some(c => c.trim() === 'lt=' + encodeURIComponent(ACCESS_TOKEN));
    const qToken = u.searchParams.get('t');

    if (qToken === ACCESS_TOKEN) {
      // 首次带正确令牌访问：写入 cookie，之后自动免参
      res.setHeader('Set-Cookie',
        'lt=' + encodeURIComponent(ACCESS_TOKEN) + '; Path=/; Max-Age=2592000; SameSite=Lax');
    } else if (!hasCookie) {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><meta charset="utf-8">
<div style="font-family:system-ui;max-width:520px;margin:120px auto;padding:32px;text-align:center;
border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,.06)">
  <div style="font-size:44px;margin-bottom:12px">🔒</div>
  <h2 style="margin:0 0 10px;color:#111">需要访问权限</h2>
  <p style="color:#6b7280;line-height:1.7;margin:0">
    该页面受访问令牌保护。<br>请使用管理员发给你的完整链接（含 <code>?t=</code> 参数）。
  </p>
</div>`);
      return;
    }
  }

  if (p === '/' || p === '/index.html' || p === '/app') { serveFile(res, HTML_FILE); return; }

  if (p === '/api/data' || p === '/live-data.json') {
    sendJSON(res, buildPayload());
    return;
  }

  if (p === '/api/status') {
    sendJSON(res, {
      ok: true,
      updatedAt: STATE.updatedAt,
      updatedAtText: STATE.updatedAt ? new Date(STATE.updatedAt).toLocaleString('zh-CN') : null,
      nextAt: STATE.nextAt,
      intervalMs: STATE.intervalMs,
      intervalMin: Math.round(STATE.intervalMs / 60000),
      drawRefreshOffsetMin: DRAW_OFFSET_MIN,
      schedule: DRAW_SCHEDULE,
      nextDraws: nextDraws(),
      refreshing: STATE.refreshing,
      rounds: STATE.rounds,
      errors: [],
      notice: STATE.notice,
      blockedCount: STATE.blockedCount,
      serverTime: Date.now(),
      types: snapshot()
    });
    return;
  }

  if (p === '/api/refresh') {
    refreshAll('手动触发').then(r => sendJSON(res, { ok: true, result: r, updatedAt: STATE.updatedAt, notice: STATE.notice }));
    return;
  }

  if (p === '/api/health') { sendJSON(res, { ok: true, uptime: process.uptime() }); return; }

  // 静态文件
  const f = path.join(DIR, path.normalize(p).replace(/^([/\\])+/, ''));
  if (f.startsWith(DIR) && fs.existsSync(f) && fs.statSync(f).isFile()) { serveFile(res, f); return; }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

// ==================== 启动 ====================
function localIPs() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) out.push({ iface: name, address: n.address });
    }
  }
  return out;
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const j = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (j && j.data && Object.keys(j.data).length) {
        STATE.data = j.data;
        STATE.updatedAt = j.updatedAt || null;
        const total = Object.values(j.data).reduce((a, b) => a + b.length, 0);
        console.log(`已加载本地缓存 ${CACHE_FILE}（${total} 期，更新于 ${STATE.updatedAt ? new Date(STATE.updatedAt).toLocaleString('zh-CN') : '未知'}）`);
      }
    }
  } catch (e) {
    console.log('缓存加载失败：' + e.message);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('  彩票实时数据分析服务已启动');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  平时刷新 : 每 ${Math.round(REFRESH_MS / 60000)} 分钟一次（低频，避免触发官网 WAF）`);
  console.log(`  开奖后   : +${DRAW_OFFSET_MIN} 分钟起每 ${DRAW_STEP_MIN} 分钟抓一次，直到拿到新一期（最多 +${DRAW_MAX_MIN} 分钟）`);
  console.log(`  数据源   : 中彩网 cwl.gov.cn / 中国体彩 webapi.sporttery.cn`);
  console.log(`  抓取期数 : 每彩种 ${FETCH_COUNT} 期`);
  console.log('  开奖时间表（北京时间）：');
  for (const [t, s] of Object.entries(DRAW_SCHEDULE)) {
    const wd = s.weekdays ? s.weekdays.map(w => ['日', '一', '二', '三', '四', '五', '六'][w]).join('/') : '每日';
    console.log(`    ${s.label.padEnd(4)} 每周 ${wd} ${s.time}`);
  }
  console.log('');
  console.log('  访问地址：');
  console.log(`    本机     http://localhost:${PORT}`);
  console.log(`    本机     http://127.0.0.1:${PORT}`);
  const tokenQs = ACCESS_TOKEN ? `?t=${encodeURIComponent(ACCESS_TOKEN)}` : '';
  for (const ip of localIPs()) {
    const isVpn = /^10\.8\.|^10\.32\./.test(ip.address);
    const tag = isVpn ? 'VPN  ' : '局域网';
    console.log(`    ${tag}   http://${ip.address}:${PORT}${tokenQs}   (${ip.iface})`);
  }
  if (ACCESS_TOKEN) {
    console.log('');
    console.log(`  访问令牌 : 已开启（分享链接必须带 ?t=${ACCESS_TOKEN}）`);
  } else {
    console.log('');
    console.log('  访问令牌 : 未开启（任何人可访问）');
    console.log('             如需限制，启动时加：ACCESS_TOKEN=你的密码 node server.js');
  }
  console.log('');
  console.log('  数据接口：');
  console.log(`    http://localhost:${PORT}/api/data     全部数据`);
  console.log(`    http://localhost:${PORT}/api/status   刷新状态`);
  console.log(`    http://localhost:${PORT}/api/refresh  手动刷新`);
  console.log('════════════════════════════════════════════════════════');
  console.log('');

  loadCache();
  refreshAll('启动首次拉取');
  lastFetchAt = Date.now();
  scheduleSmartRefresh();  // 平时 60 分钟；开奖后 20 分钟起每 10 分钟抓到新一期为止
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请换一个端口：node server.js ${PORT + 1}`);
    process.exit(1);
  }
  throw e;
});

process.on('SIGINT', () => { console.log('\n服务已停止'); process.exit(0); });
