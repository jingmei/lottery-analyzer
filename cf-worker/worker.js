/**
 * 彩票历史数据统计分析 —— Cloudflare Worker 边缘版
 * ------------------------------------------------------------
 * 架构：国内本机抓取官方公开开奖数据 -> POST /api/push -> Worker KV -> 手机读边缘缓存
 *   1. 静态页面由边缘 assets 直出（HTML 允许短时缓存，弱网下二次打开可秒开）
 *   2. /api/data、/api/status 只读 KV；边缘绝不抓官网（海外 IP 会被网宿 WAF 403 拦截）
 *   3. /api/push 接收本机推送，密钥通过 `wrangler secret put PUSH_TOKEN` 配置
 *   4. 页面内嵌 300 期快照，边缘数据不可用时自动回退，不会白屏
 * 注：scheduled() 已禁用，不再有边缘 Cron 抓取任务。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const COUNT = 110;            // 每彩种保留期数（前端分析窗口最大 100 期）
const KV_TTL = 60 * 60 * 24;  // KV 保留 24h（数据陈旧也好过没有）
const STALE_SEC = 900;        // 超过 15 分钟视为过期，cron 才重建

const NAMES = { ssq: '双色球', dlt: '大乐透', kl8: '快乐8', fc3d: '福彩3D', qlc: '七乐彩', pl3: '排列3' };
const TYPES = ['ssq', 'dlt', 'kl8', 'fc3d', 'qlc', 'pl3'];

// 开奖时间表（北京时间）：weekdays 0=日..6=六，null=每日
const DRAW_SCHEDULE = {
  ssq:  { label: '双色球', time: '21:15', weekdays: [0, 2, 4] },
  dlt:  { label: '大乐透', time: '20:30', weekdays: [1, 3, 6] },
  qlc:  { label: '七乐彩', time: '21:15', weekdays: [1, 3, 5] },
  fc3d: { label: '福彩3D', time: '21:15', weekdays: null },
  pl3:  { label: '排列3',  time: '21:25', weekdays: null },
  kl8:  { label: '快乐8',  time: '21:30', weekdays: null }
};
const DRAW_OFFSET_MIN = 20;

function beijingNow() {
  const d = new Date();
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 8 * 3600000);
}
function minutesOf(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function localDateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function nextDraws() {
  const now = beijingNow();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out = {};
  for (const [type, s] of Object.entries(DRAW_SCHEDULE)) {
    for (let add = 0; add <= 7; add++) {
      const d = new Date(now); d.setDate(d.getDate() + add);
      if (s.weekdays && s.weekdays.indexOf(d.getDay()) < 0) continue;
      const dm = minutesOf(s.time);
      if (add === 0 && nowMin >= dm) continue;
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

const yi = v => {
  const n = Number(String(v == null ? '' : v).replace(/,/g, ''));
  if (!isFinite(n) || n <= 0) return '-';
  return (n / 1e8).toFixed(2) + '亿';
};
const nums = s => String(s == null ? '' : s).split(/[,\s]+/).filter(Boolean).map(Number);

async function jget(url, headers) {
  const r = await fetch(url, {
    headers: Object.assign({
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    }, headers || {}),
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  const text = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + text.slice(0, 80));
  return JSON.parse(text);
}

// 中彩网：双色球 / 福彩3D / 快乐8 / 七乐彩
async function fetchCwl(name) {
  const j = await jget(
    'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=' + name + '&issueCount=' + COUNT,
    { Referer: 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/' }
  );
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
async function fetchSport(gameNo) {
  const out = [];
  for (let page = 1; page <= 3 && out.length < COUNT; page++) {
    const j = await jget(
      'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=' + gameNo +
      '&provinceId=0&pageSize=100&isVerify=1&pageNo=' + page,
      { Referer: 'https://www.lottery.gov.cn/' }
    );
    const list = (j && j.value && j.value.list) || [];
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
  }
  return out.slice(0, COUNT);
}

function fmt(d, type) {
  const pm = d.prizeMoney ? (Math.round(Number(String(d.prizeMoney).replace(/,/g, '')) / 1e4) + '万') : '-';
  const base = { period: d.period, date: d.date, sales: d.sales, pool: d.pool, firstPrize: d.firstPrize || '-', prizeAmount: pm };
  if (type === 'ssq') return Object.assign(base, { numbers: { red: d.red, blue: d.blue } });
  if (type === 'dlt') return Object.assign(base, { numbers: { front: d.red.slice(0, 5), back: d.red.slice(5, 7) } });
  if (type === 'kl8') return Object.assign(base, { numbers: { selected: d.red } });
  if (type === 'fc3d') return Object.assign(base, { numbers: { digits: d.red } });
  if (type === 'pl3') return Object.assign(base, { numbers: { digits: d.red } });
  if (type === 'qlc') return Object.assign(base, { numbers: d.red, blue: (d.blue && d.blue.length) ? d.blue[0] : null });
  return base;
}

const JOBS = [
  ['ssq', () => fetchCwl('ssq')],
  ['fc3d', () => fetchCwl('3d')],
  ['kl8', () => fetchCwl('kl8')],
  ['qlc', () => fetchCwl('qlc')],
  ['dlt', () => fetchSport('85')],
  ['pl3', () => fetchSport('35')]
];

function snapshot(data) {
  return TYPES.map(t => {
    const list = data[t] || [];
    return {
      type: t, name: NAMES[t], count: list.length,
      latest: list[0] ? list[0].period : null,
      latestDate: list[0] ? list[0].date : null,
      oldest: list.length ? list[list.length - 1].period : null,
      oldestDate: list.length ? list[list.length - 1].date : null
    };
  });
}

const cnText = ts => new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

async function build(prev) {
  const t0 = Date.now();
  const settled = await Promise.allSettled(JOBS.map(j => j[1]()));
  const data = {};
  const errors = [];
  settled.forEach((r, i) => {
    const [type] = JOBS[i];
    if (r.status === 'fulfilled' && r.value && r.value.length) {
      data[type] = r.value.map(d => fmt(d, type));
    } else {
      const msg = r.status === 'rejected' ? String(r.reason && r.reason.message || r.reason) : '空数据';
      errors.push(NAMES[type] + ': ' + msg);
      if (prev && prev[type] && prev[type].length) data[type] = prev[type];
    }
  });
  if (!Object.keys(data).length) throw new Error('全部数据源失败: ' + errors.join(' | '));
  const updatedAt = Date.now();
  return {
    payload: {
      ok: true,
      updatedAt,
      updatedAtText: cnText(updatedAt),
      nextAt: updatedAt + 300000,
      intervalMs: 300000,
      intervalMin: 5,
      drawRefreshOffsetMin: DRAW_OFFSET_MIN,
      schedule: DRAW_SCHEDULE,
      nextDraws: nextDraws(),
      refreshing: false,
      rounds: 0,
      errors,
      types: snapshot(data),
      data
    },
    meta: { updatedAt, updatedAtText: cnText(updatedAt), errors, types: snapshot(data), ms: Date.now() - t0 }
  };
}

function json(obj, extraHeaders, status) {
  return new Response(typeof obj === 'string' ? obj : JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-store'
    }, extraHeaders || {})
  });
}

// 统一清洗对外 payload：
//  1) 补齐开奖时间表，供页面顶部提示使用
//  2) 把「403 / 567 / 网宿 WAF / DNS / 连接重置」这类技术性抓取失败
//     转成人话提示，不再让用户看到「6 项抓取失败」（海外节点抓国内官网必被拦，属预期内）
function sanitize(payload) {
  const p = Object.assign({}, payload || {});
  if (!p.schedule) p.schedule = DRAW_SCHEDULE;
  // nextDraws 是时间相关的动态值，每次对外都重算，避免用推送那一刻的过期快照
  p.nextDraws = nextDraws();
  p.drawRefreshOffsetMin = DRAW_OFFSET_MIN;
  const errs = Array.isArray(p.errors) ? p.errors : [];
  const blocked = errs.filter(e => /403|567|网宿|安全平台|ENOTFOUND|ECONNRESET|ETIMEDOUT|timeout|socket hang up|拒绝|限流/i.test(String(e)));
  if (blocked.length) {
    p.errors = [];
    p.blockedCount = blocked.length;
    p.notice = '官方数据源暂时限流或拒绝访问，已保留上次成功抓取的数据。系统会在每次开奖后自动重试，无需手动操作。';
  }
  return p;
}

async function saveKV(env, payload, meta) {
  if (!env.LOTTERY_KV) return;
  await Promise.all([
    env.LOTTERY_KV.put('data', JSON.stringify(payload), { expirationTtl: KV_TTL }),
    env.LOTTERY_KV.put('meta', JSON.stringify(meta), { expirationTtl: KV_TTL })
  ]);
}

async function getMeta(env) {
  if (!env.LOTTERY_KV) return null;
  const s = await env.LOTTERY_KV.get('meta');
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

// ---- 上游连通性自检 ----
async function probe() {
  const tests = [
    ['cwl_ssq', 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=3',
      { Referer: 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/' }],
    ['sporttery_dlt', 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=3&isVerify=1&pageNo=1',
      { Referer: 'https://www.lottery.gov.cn/' }]
  ];
  const out = [];
  for (const [name, url, h] of tests) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: Object.assign({ 'User-Agent': UA, Accept: 'application/json, text/plain, */*' }, h) });
      const t = await r.text();
      out.push({ name, status: r.status, ms: Date.now() - t0, len: t.length, sample: t.slice(0, 200) });
    } catch (e) {
      out.push({ name, error: String(e && e.message || e), ms: Date.now() - t0 });
    }
  }
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const u = new URL(request.url);
    const p = u.pathname;

    // 兜底强制 HTTPS：面板开启 Always Use HTTPS 后通常不会走到这里，
    // 但开源部署到别的环境时仍需保证不以明文 HTTP 提供页面。
    const proto = (request.headers.get('X-Forwarded-Proto') || u.protocol.replace(':', '')).toLowerCase();
    if (proto === 'http' && p !== '/api/health') {
      u.protocol = 'https:';
      return Response.redirect(u.toString(), 301);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }

    if (p === '/api/probe') return json(await probe());

    if (p === '/api/ping') return json({ ok: true, ts: Date.now(), kv: !!env.LOTTERY_KV });

    if (p === '/api/data' || p === '/live-data.json') {
      if (env.LOTTERY_KV) {
        const s = await env.LOTTERY_KV.get('data');
        if (s) return json(sanitize(JSON.parse(s)), { 'Cache-Control': 'public, max-age=30' });
      }
      // KV 尚无数据：绝不在边缘现场抓（海外 IP 抓 cwl.gov.cn 必被网宿 403），
      // 返回空 data 让页面使用内嵌快照，并给出人话提示
      return json(sanitize({
        ok: true, data: {}, updatedAt: null, updatedAtText: null, errors: [],
        nextAt: null, intervalMs: 3600000, intervalMin: 60, refreshing: false, rounds: 0, types: snapshot({}),
        notice: '数据尚未同步，页面先展示内嵌快照；本机上线后会在每次开奖后自动更新。'
      }));
    }

    if (p === '/api/status') {
      const meta = await getMeta(env);
      if (meta) return json(Object.assign({ ok: true, serverTime: Date.now(), intervalMs: 3600000, intervalMin: 60, refreshing: false, rounds: 0 }, sanitize(meta)));
      return json({ ok: true, serverTime: Date.now(), updatedAt: null, errors: [], types: snapshot({}), notice: '等待本机同步数据' });
    }

    // 边缘节点不直接抓官方源（必被 403），「立即刷新」只回报状态，不覆盖 KV
    if (p === '/api/refresh') {
      const meta = await getMeta(env);
      return json({
        ok: true, skipped: true, updatedAt: meta ? meta.updatedAt : null,
        notice: '官方数据由本机在每次开奖后自动抓取并同步到边缘；边缘节点不直接抓取（海外 IP 会被官网拦截）。'
      });
    }

    // 本机 server.js 推送：POST /api/push?token=xxx
    // 绑定名用 EDGE_PUSH_TOKEN，避开历史遗留的同名变量占用
    if (p === '/api/push' && request.method === 'POST') {
      // 未配置密钥时一律拒绝，避免「空 token === 空配置」被绕过
      const configured = env.EDGE_PUSH_TOKEN || '';
      const provided = u.searchParams.get('token') || '';
      if (!configured || provided !== configured) return json({ ok: false, error: 'bad token' }, null, 403);
      const body = await request.json();
      if (!body || !body.data) return json({ ok: false, error: 'bad body' }, null, 400);
      const clean = sanitize(body);
      const meta = {
        updatedAt: clean.updatedAt || Date.now(),
        updatedAtText: clean.updatedAtText || cnText(clean.updatedAt || Date.now()),
        errors: clean.errors || [], types: clean.types || snapshot(clean.data),
        notice: clean.notice || null
      };
      await saveKV(env, clean, meta);
      return json({ ok: true, saved: true });
    }

    if (p === '/api/health') return json({ ok: true, ts: Date.now() });

    // 其余交给静态资源（含 /、about.html 和微信验证 txt）
    const assetRes = await env.ASSETS.fetch(request);
    const ct = assetRes.headers.get('Content-Type') || '';
    const isHtml = assetRes.status === 200 && (ct.indexOf('text/html') >= 0 || p === '/' || /\.html?$/.test(p));
    if (!isHtml) return assetRes;

    // HTML 允许浏览器短时缓存：弱网/跨洋链路下二次打开可直接用本地副本，
    // 避免每次刷新都重新下载整页导致白屏。API 仍保持 no-store。
    const h = new Headers(assetRes.headers);
    h.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=86400');
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    h.set('X-Frame-Options', 'SAMEORIGIN');
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return new Response(assetRes.body, {
      status: assetRes.status,
      statusText: assetRes.statusText,
      headers: h
    });
  },

  // 不在边缘抓取官方数据：海外 IP 会被网宿 WAF 403 拦截，抓到的只会是
  // 一堆错误并覆盖本机推送的好数据。数据一律由本机 server.js 在开奖后推送。
  async scheduled(event, env, ctx) {
    return;
  }
};
