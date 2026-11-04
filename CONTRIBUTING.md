# 贡献指南

欢迎提 Issue 和 PR。这个项目有几个刻意的约束，贡献前请先了解。

## 项目原则

1. **前端保持单文件**。`lottery-analyzer.html` 自包含 CSS / JS / 内嵌数据快照，不引入构建工具、不拆模块、不加框架。复制一个文件就能跑是核心特性。
2. **零运行时依赖**。`server.js` 只用 Node 内置模块；图表与 OCR 是前端 CDN 上的可选增强，不参与构建。
3. **保留 300 期内嵌快照**。它是离线兜底与边缘不可用时的保底，不要裁减或改成异步加载。
4. **边缘不抓官网**。海外 IP 抓 `cwl.gov.cn` 必被网宿 WAF 403，抓体彩接口返回 567。数据只能由国内本机抓后推送。
5. **合规优先**。见下方红线。

## 开发流程

```bash
# 1) 改主页面
#    编辑 lottery-analyzer.html

# 2) 同步部署副本（必须，两者需逐字节一致）
cp lottery-analyzer.html cf-worker/public/index.html

# 3) 合规检查（BLOCK 类敏感词必须为 0）
node scripts/compliance-check.cjs
# 如新增了高风险措辞，可用 --fix 应用内置整改规则
node scripts/compliance-check.cjs --fix

# 4) 本地验证
node server.js 8080
# 打开 http://127.0.0.1:8080 检查三个页签、切换彩种、图表、拍照识别

# 5) 部署（需要自己的 Cloudflare API Token）
cd cf-worker && wrangler deploy
```

## 合规红线（PR 会被拒绝的情况）

- 任何预测中奖、保证命中、稳赚、收益承诺类表述；
- 任何投注引导（「照着买」「可直接照打」「首推」）、代购 / 充值 / 兑奖 / 收费 / 广告；
- 上传用户数据、引入第三方统计或广告 SDK；
- 把彩票官方数据说成官方授权或官方发布；
- 把密钥、`PUSH_TOKEN`、API Token、`.env` 写进任何文件。

页面顶部与底部必须保留免责声明和 `about.html` 链接。`scripts/compliance-check.cjs` 会检查这些。

## 提交前自检

- [ ] `node scripts/compliance-check.cjs` 通过（BLOCK = 0）
- [ ] 主页面与 `cf-worker/public/index.html` 逐字节一致
- [ ] `git status` 里没有 `.env`、`*.tmp`、`_archive/`、`live-data.json`
- [ ] 没有把任何 token / 密码写进代码、文档或提交信息
- [ ] 手机窄屏下三个页签不溢出、图表不裁切

## 报告问题

请在 Issue 里附上：浏览器与版本、访问方式（本机 / 公网 / 微信）、截图、控制台报错。不要粘贴任何密钥。
