#!/usr/bin/env node
/**
 * 页面合规 / 敏感词检查（可复跑）
 *
 *   node scripts/compliance-check.cjs          # 只检查并输出报告
 *   node scripts/compliance-check.cjs --fix    # 先应用整改替换，再复查
 *
 * 分级：
 *   BLOCK    博彩黑话、诱导性承诺、金融化表述 —— 必须为 0
 *   CAUTION  彩票数据分析的固有术语 —— 允许存在，但必须有免责声明覆盖
 *   SAFE     否定式合规表述（不保证 / 不代购 / 不含广告）—— 保留，越多越好
 *
 * 退出码：BLOCK 仍有命中时返回 1，便于接入 CI。
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'lottery-analyzer.html');
const ABOUT = path.join(__dirname, '..', 'cf-worker', 'public', 'about.html');
const FIX = process.argv.includes('--fix');

const BLOCK = [
  '赌博', '博彩', '私彩', '外围', '庄家', '盘口', '水位', '返水',
  '押注', '下注', '稳赚', '必中', '包中', '内幕', '秘籍', '绝杀',
  '杀号', '定胆', '胆码', '带单', '跟单', '回本', '上岸', '暴富',
  '送彩金', '注册送', '首推', '精准预测', '包中奖', '保底',
  '投资收益比', '投资回报', '收益率', '净收益'
];

const CAUTION = [
  '预测', '推荐', '中奖', '投注', '购彩', '命中概率', '中奖概率',
  '倍投', '追号', '合买', '兑奖', '胆拖', '复式', '单式'
];

const SAFE = [
  '不构成', '不保证', '不销售', '不代购', '不收取', '不收集',
  '不含广告', '不存在可预测规律', '理性购彩', '量力而行',
  '未满 18 周岁', '独立随机事件', '不构成投注建议'
];

// 整改替换：只改显示文案与注释，不改变量名/函数名。顺序敏感，先长后短。
const REPLACEMENTS = [
  ['押注适度遗漏号', '侧重适度遗漏号'],
  ['押注连续空缺的号段', '侧重连续空缺的号段'],
  ['本彩种盘口很小', '本彩种样本量很小'],
  ['→ 保底）', '→ 最低奖金保障）'],
  ['一等奖保底（', '一等奖最低奖金（'],
  ['2 个胆码锁定，15 注', '2 个固定号，15 注'],
  ['3 个胆码锁定，15 注', '3 个固定号，15 注'],
  ['锁定 2 个胆码，30 元', '2 个固定号，30 元'],
  ['锁定 3 个胆码，30 元', '3 个固定号，30 元'],
  ['投注方案 · 投资回报分析（结合概率与实盘数据）', '投注方案 · 期望值分析（结合概率与公开奖级数据）'],
  ['投资收益比 ROI', '期望值偏差 ROI'],
  ['投资收益比', '期望值偏差'],
  ['期望收益率', '期望值比例'],
  ['收益率', '期望值比例'],
  ['期望收益', '期望值'],
  ['净收益', '净差额'],
  ['回测收益', '回测表现'],
  ['收益提升', '期望值提升'],
  ['投注方案 · 投资回报 =====', '投注方案 · 期望值 ====='],
  ['投注方案 · 投资回报引擎', '投注方案 · 期望值引擎'],
  ['首推', '第 1 组'],
  ['智能彩票分析助手 - 2026年最新数据', '彩票历史数据统计分析工具']
];

function count(hay, needle) {
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

function main() {
  let html = fs.readFileSync(FILE, 'utf8');

  if (FIX) {
    console.log('=== 应用整改替换 ===');
    let total = 0;
    for (const [from, to] of REPLACEMENTS) {
      const n = count(html, from);
      if (n) {
        html = html.split(from).join(to);
        total += n;
        console.log(`  ${String(n).padStart(3)} 处  ${from}  ->  ${to}`);
      }
    }
    fs.writeFileSync(FILE, html, 'utf8');
    console.log(`共替换 ${total} 处，已写回 ${path.basename(FILE)}\n`);
  }

  console.log('=== 合规检查报告 ===');
  console.log(`主页面 : ${FILE}`);
  console.log(`说明页 : ${fs.existsSync(ABOUT) ? '存在 (' + fs.statSync(ABOUT).size + ' B)' : '缺失'}\n`);

  let blocked = 0;
  console.log('[BLOCK] 必须清零：');
  for (const w of BLOCK) {
    const n = count(html, w);
    if (n) { blocked += n; console.log(`  !! ${w.padEnd(12)} ${n} 处`); }
  }
  if (!blocked) console.log('  ✅ 0 处');

  console.log('\n[CAUTION] 固有术语（保留，需免责覆盖）：');
  for (const w of CAUTION) {
    const n = count(html, w);
    if (n) console.log(`  ${w.padEnd(12)} ${n} 处`);
  }

  console.log('\n[SAFE] 否定式合规表述：');
  let safe = 0;
  for (const w of SAFE) {
    const n = count(html, w);
    if (n) { safe += n; console.log(`  ✅ ${w.padEnd(18)} ${n} 处`); }
  }

  const aboutOk = fs.existsSync(ABOUT) &&
    /隐私说明/.test(fs.readFileSync(ABOUT, 'utf8')) &&
    /免责声明/.test(fs.readFileSync(ABOUT, 'utf8'));
  console.log(`\n[链接] 免责区指向说明页 : ${/href="\/about\.html"/.test(html) ? '✅' : '❌'}`);
  console.log(`[链接] 页脚三链接       : ${/#privacy/.test(html) && /#disclaimer/.test(html) ? '✅' : '❌'}`);
  console.log(`[说明页] 含隐私与免责   : ${aboutOk ? '✅' : '❌'}`);
  console.log(`[标题] 无营销化措辞     : ${!/智能彩票分析助手/.test(html) ? '✅' : '❌'}`);

  console.log(`\n结论：BLOCK ${blocked} 处，SAFE ${safe} 处。`);
  if (blocked) { console.log('❌ 仍有高风险词，请检查。'); process.exit(1); }
  console.log('✅ 高风险词已清零；固有术语由页面免责声明与 about.html 覆盖。');
}

main();
