#!/usr/bin/env node
/**
 * 把页面内嵌兜底快照 REAL_DATA 同步为本机 /api/data 的最新数据。
 *
 * 同时维护三处，保证时间/期号一致：
 *   1. REAL_DATA 块（6 个彩种各 300 期）
 *   2. SNAPSHOT_AT 常量（快照导出时间戳）
 *   3. 静态默认徽标 #live-badge 的初始文案（JS 执行前那一瞬间显示）
 *
 * 用法（在仓库根目录执行）：
 *   node scripts/refresh_snapshot.js                 # 从 http://127.0.0.1:8080/api/data 拉取
 *   node scripts/refresh_snapshot.js /path/data.json # 使用指定的 /api/data 响应文件
 *
 * 之后需重跑 deploy-worker.bat 才会对线上生效。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const MAIN = path.join(ROOT, 'lottery-analyzer.html');
const COPY = path.join(ROOT, 'cf-worker', 'public', 'index.html');
const ORDER = [
  ['ssq', '双色球'],
  ['dlt', '大乐透'],
  ['kl8', '快乐8'],
  ['fc3d', '福彩3D'],
  ['qlc', '七乐彩'],
  ['pl3', '排列3']
];

function fetchLocal() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:8080/api/data', res => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); res.resume(); return; }
      let s = '';
      res.setEncoding('utf8');
      res.on('data', c => { s += c; });
      res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  const arg = process.argv[2];
  const payload = arg
    ? JSON.parse(fs.readFileSync(arg, 'utf8'))
    : await fetchLocal().catch(e => {
        throw new Error('无法从 127.0.0.1:8080 拉取数据：' + e.message + '\n请先启动 start_lottery.bat，或传入 JSON 文件路径。');
      });

  const src = payload.data;
  if (!src || typeof src !== 'object') throw new Error('响应里没有 data 字段');
  for (const [k] of ORDER) {
    if (!Array.isArray(src[k]) || !src[k].length) throw new Error('缺少数据: ' + k);
    console.log(' ', k, '条数', src[k].length, '最新', src[k][0].period, src[k][0].date);
  }

  const at = Number(payload.updatedAt) || Date.now();
  const stamp = new Date(at).toLocaleString('zh-CN', { hour12: false });

  let block = '        // ==================== 官方真实历史数据（各 300 期 · 导出于 ' + stamp + '） ====================\n';
  block += '        const REAL_DATA = {\n';
  ORDER.forEach(([k, label], idx) => {
    const arr = src[k];
    const first = arr[0] || {}, last = arr[arr.length - 1] || {};
    block += '            // ' + label + ' 官方真实数据 ' + arr.length + ' 期（' + first.date + ' ~ ' + last.date + '）\n';
    block += '            ' + k + ': [\n';
    arr.forEach((row, i) => {
      block += '                ' + JSON.stringify(row) + (i < arr.length - 1 ? ',' : '') + '\n';
    });
    block += '            ]' + (idx < ORDER.length - 1 ? ',' : '') + '\n';
  });
  block += '        };';

  // 只改主文件，再整体复制到 Worker 的 public/index.html，保证两份严格一致
  let html = fs.readFileSync(MAIN, 'utf8');
  const start = html.indexOf('        // ==================== 官方真实历史数据');
  if (start < 0) throw new Error('找不到块起始');
  const decl = html.indexOf('        const REAL_DATA = {', start);
  if (decl < 0) throw new Error('找不到 REAL_DATA 声明');
  const end = html.indexOf('\n        };', decl);
  if (end < 0) throw new Error('找不到块结束');
  html = html.slice(0, start) + block + html.slice(end + '\n        };'.length);

  if (!/const SNAPSHOT_AT = \d+;/.test(html)) throw new Error('找不到 SNAPSHOT_AT 常量');
  html = html.replace(/const SNAPSHOT_AT = \d+;/, 'const SNAPSHOT_AT = ' + at + ';');

  html = html.replace(
    /(<span id="live-badge"[^>]*>\s*\n\s*)📡[^\n<]*/,
    '$1📡 数据更新于 ' + stamp
  );

  fs.writeFileSync(MAIN, html, 'utf8');
  fs.writeFileSync(COPY, html, 'utf8');
  console.log('  已更新 lottery-analyzer.html 与 cf-worker/public/index.html（严格一致），',
    Buffer.byteLength(html), '字节');
  console.log('\n完成：快照时间', stamp, '(' + at + ')');
  console.log('提示：需重跑 deploy-worker.bat 才会对线上生效。');
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
