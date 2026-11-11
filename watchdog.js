#!/usr/bin/env node
/**
 * 常驻看门狗（计划任务 LotteryAnalyzerAutoUpdate 的动作）。
 *
 * 为什么常驻而不是「探测一次就退出」：
 *   Windows 任务计划程序在任务结束时会清理整个进程树，detached 拉起的
 *   server.js 会被一起杀掉，于是出现「刚恢复又断」的循环。
 *   这里由本进程直接持有 server.js 子进程，任务实例一直处于 Running，
 *   父子同生命周期，不会被清理。
 *
 * 职责：
 *   1. 启动时若 8080 已有服务在响应（例如手动双击 bat 起的），只监督不抢端口
 *   2. 每 30 秒真正请求 /api/status；无响应就结束子进程并重新拉起
 *      —— 能识别「进程还在但端口不响应」的僵尸状态
 *   3. 子进程自己退出（崩溃 / EADDRINUSE）时 3 秒后自动重启
 *   4. 若本看门狗进程意外被杀，计划任务的「每 10 分钟」触发器会重新拉起
 *
 * 手动运行：node watchdog.js（前台常驻，Ctrl+C 结束）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const BASE = __dirname;
const PORT = Number(process.env.PORT || 8080);
const LOG = path.join(BASE, 'logs', 'watchdog.log');
const OUT = path.join(BASE, 'logs', 'server.out.log');
const CHECK_MS = 30000;

function log(msg) {
  const line = '[' + new Date().toLocaleString('zh-CN', { hour12: false }) + '] ' + msg + '\n';
  try {
    if (!fs.existsSync(path.dirname(LOG))) fs.mkdirSync(path.dirname(LOG), { recursive: true });
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 1024 * 1024) fs.writeFileSync(LOG, '');
    fs.appendFileSync(LOG, line);
  } catch (e) { /* 日志失败不影响职责 */ }
  process.stdout.write(line);
}

function probe() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/status', timeout: 5000 }, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

// 只杀命令行含 server.js 的 node 进程，绝不误伤 WorkBuddy 或其它 node 程序
function killStale() {
  const ps = "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
    "Where-Object { $_.CommandLine -like '*server.js*' } | " +
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
  try {
    spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps],
      { stdio: 'ignore', windowsHide: true, timeout: 20000 });
  } catch (e) { /* 清理失败也继续 */ }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

let child = null;
let busy = false;
let outFd = 'ignore';
try {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  outFd = fs.openSync(OUT, 'a');
} catch (e) { /* 打不开就退回 ignore */ }

function startChild() {
  if (child) return;
  child = spawn(process.execPath, ['server.js', String(PORT)], {
    cwd: BASE,
    stdio: ['ignore', outFd, outFd],
    windowsHide: true
  });
  log('START server.js (pid=' + child.pid + ')');
  child.on('exit', code => {
    log('EXIT server.js code=' + code + '，3 秒后重启');
    child = null;
    if (!busy) setTimeout(() => { if (!child) startChild(); }, 3000);
  });
  child.on('error', e => log('SPAWN_ERROR ' + e.message));
}

async function check() {
  if (busy) return;
  const ok = await probe();
  if (ok) return;                       // 正常，静默跳过
  busy = true;
  log('WARN /api/status 无响应，重启服务');
  if (child) {
    try { child.kill(); } catch (e) { /* ignore */ }
    child = null;                      // kill 会触发 exit，交给统一重启流程
  }
  killStale();                         // 清掉不属于本进程的僵尸 / 旧实例
  await sleep(2500);                   // 等端口释放，避免 EADDRINUSE
  if (!child) startChild();
  await sleep(10000);
  log(await probe() ? 'RECOVERED 服务已恢复响应' : 'STILL_DOWN 仍无响应，下一轮继续');
  busy = false;
}

async function main() {
  const already = await probe();
  if (already) {
    log('已有服务在响应，进入监督模式（不重复占用端口）');
  } else {
    killStale();
    await sleep(1500);
    startChild();
  }
  setInterval(check, CHECK_MS);
  log('看门狗已就绪，每 ' + (CHECK_MS / 1000) + ' 秒探测一次');
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
main().catch(e => log('ERROR ' + e.message));
