# 发布到 Gitee（国内对外主链接）

> 2026-11-05 起，Gitee 是本项目**面向国内读者 / 比赛投稿 / 审核员的对外开源主链接**：GitHub 国内经常连不上，仅保留为本地推送源与海外渠道（Show HN / Product Hunt）备用。所有国内文案、站点页脚、比赛「开源代码」栏统一填 Gitee。
> 两处仓库内容保持同步；Gitee 只承载源码，**在线站点仍然是 https://maicaipiao.top**（Cloudflare Worker + KV），Gitee Pages 已下线、不承载网页访问。

## 0. 已确认的信息（2026-11-05 实测）

| 项 | 值 |
|---|---|
| Gitee 用户名 | **`respectfully-mei`** |
| 昵称 | 敬美 |
| 个人主页 | https://gitee.com/respectfully-mei （实链，已验证 200） |
| 对外主链接 | `https://gitee.com/respectfully-mei/lottery-analyzer` |
| 比赛投稿可用（带 README 锚点） | `https://gitee.com/respectfully-mei/lottery-analyzer#彩票历史数据统计分析工具` |
| 当前状态 | **公开仓库、已同步最新**（2026-11-05 17:09 复测：仓库页 200、默认分支 `main`、`pushed_at` 当日、README 与本地一致） |
| GitHub 主仓库 | https://github.com/jingmei/lottery-analyzer （本地推送源 / 海外渠道备用，`main` 分支） |
| 站点 | https://maicaipiao.top |

> 账号已由 Gitee OpenAPI 核实：`login=respectfully-mei`、`name=敬美`。
> 注意不要把「敬美」当成用户名、也不要沿用 GitHub 的 `jingmei` —— 两个平台用户名不同。
> 2026-11-05 复测两处仓库均返回 200，上面的地址可直接写进推广文案与申诉材料。
> 若需要重建仓库或换账号，再按第 1 节重新导入。

## 1. 重要结论：Gitee Pages 已下线，别用它发网页

如果「发布」指的是把 `cf-worker/public/` 挂成 `xxx.gitee.io` 静态网站 —— **这条路已经走不通**：

- Gitee 官方反馈区 2024-05 明确回复：「Pages 服务已经下线，暂无具体计划再次上线」「因服务维护调整，Gitee Pages 暂停提供服务」；
- 后台「服务 → Gitee Pages」入口已下架，旧站点直链 `*.gitee.io` 已失效；
- 网上标着「2026 最新版、实名认证后已恢复」的教程多为洗稿复制，不要照做。

想让国内访问更快，国内节点静态托管通常**绕不开 ICP 备案**，这与本项目当前「境外边缘接入、免备案」的定位冲突。可选替代（均非本项目主站）：腾讯云 EdgeOne Pages、Cloudflare Pages、GitHub Pages、Vercel / Netlify、对象存储静态网站。

**所以：Gitee 只发代码仓库，不发网页。**

## 2. 推荐路线 A：Gitee 仓库镜像管理，自动从 GitHub 同步（最省事）

保持 GitHub 为主仓库不变（继续用 `push-github.bat`），Gitee 自动跟着同步，本地不用加第二套配置、也不用记 Gitee 令牌。

1. 登录 Gitee → 新建仓库 `lottery-analyzer`，选**公开**；
   **不要**勾选初始化 README / `.gitignore` / License（本地已有，勾选会产生冲突）。
2. 进入仓库 →「管理」→「仓库镜像管理」→「添加镜像」。
3. 按弹窗提示绑定 GitHub 账号。
4. 「镜像方向」选 **Pull**（GitHub → Gitee）；「镜像仓库」选 `jingmei/lottery-analyzer`。
5. 「个人令牌」填 **GitHub PAT**（注意是 GitHub 的，不是 Gitee 的），需包含 `repo` 权限。
6. 勾选「自动从 GitHub 同步仓库」→ 保存。

之后每次推 GitHub，Gitee 会自动同步分支 / 标签 / 提交记录（触发最短间隔 5 分钟）。

官方说明：https://help.gitee.com/repository/settings/sync-between-gitee-github

两个坑：

- 自动同步需要在 GitHub 侧生成 webhook，PAT 需额外带 **`admin:repo_hook`**；若只勾了 `repo`，保存会失败。此时**去掉「自动」勾选**、改为手动更新镜像即可。
- GitHub PAT 只在生成那一屏显示一次。若没保存，按 [GITHUB_SETUP.md 第 2 节](GITHUB_SETUP.md) 重新生成并**存进密码管理器**。

> 双向镜像官方标注「存在代码丢失风险，请谨慎使用」。本项目以 GitHub 为唯一主仓库，**只用 Pull 单向**。

## 3. 路线 B：新建仓库时直接「从 GitHub 导入」

适合不想配置镜像、只要一份静态快照的场景。

1. Gitee → 右上角 `+` →「新建仓库」→ 页面底部选「导入已有仓库」/「从 GitHub 导入」；
   也可直接用右上角 `+` →「从 GitHub 导入仓库」。
2. 授权 GitHub 账号。
3. 仓库地址填：

   ```text
   https://github.com/jingmei/lottery-analyzer
   ```

   或

   ```text
   https://github.com/jingmei/lottery-analyzer.git
   ```

4. 仓库名 `lottery-analyzer`，公开，创建。

因为源仓库是自己的公开仓库，直接填即可；若导入他人公开仓库失败，需先 Fork 到自己 GitHub 账号再导入。私有源仓库则需在导入页额外填有 `repo` 权限的 GitHub PAT。

导入会保留 `main` 分支与完整提交历史。后续更新：在 Gitee 仓库页点「**强制同步**」（会覆盖 Gitee 侧改动，慎用），或改用路线 A 自动同步。

## 4. 路线 C：本地双 remote（想完全自己控制时用）

```bash
git remote add gitee https://gitee.com/respectfully-mei/lottery-analyzer.git
git push -u gitee main
```

- **不要删 `origin`**：`origin` 仍指向 GitHub，日常继续用 `push-github.bat`。
- 一次性连分支带标签全量推：`git push --mirror gitee`。
- Gitee 新建仓库默认分支是 `master`，而本项目是 `main`；推送时明确写 `main`，别推错分支。
- 若想把 Gitee 设为 SSH remote：`git@gitee.com:respectfully-mei/lottery-analyzer.git`。

不建议用 `git remote set-url --add --push origin ...` 一次推两端 —— 容易混乱，且 Gitee 侧的推送认证与 GitHub 不同。

## 5. Gitee 推送认证（和 GitHub 不一样）

| 项 | 说明 |
|---|---|
| HTTPS 用户名 | **Gitee 登录名 `respectfully-mei`**（不是昵称、不是邮箱） |
| HTTPS 密码 | **Gitee 私人令牌**，不是登录密码 |
| 令牌路径 | 头像 → 设置 → 私人令牌 → 生成新令牌 → 勾仓库相关权限（页面一般显示为 `projects`）→ 复制 |
| 生效范围 | 2026 年起主流平台已全面停用账号密码做 Git HTTPS 认证 |
| SSH 备选 | 设置 → SSH 公钥 → 添加 `id_ed25519.pub` |

私人令牌同样**只显示一次**，请存进密码管理器。Windows 凭据管理器会缓存旧凭据，刷新令牌后若推送失败，去「凭据管理器 → Windows 凭据」更新 `git:https://gitee.com` 条目。

> 路线 A / B 在网页端操作，**不需要 Gitee 私人令牌**；只有路线 C 本地推送才需要。

## 6. 合规（Gitee 是国内平台，审核更严）

发布时以下材料必须原样保留，不要因为换平台就删减：

- `README.md` 顶部醒目免责声明
- `LICENSE`（MIT）
- `SECURITY.md`
- `docs/COMPLIANCE.md`、`docs/APPEAL.md`
- `cf-worker/public/about.html`、`cf-worker/public/.well-known/security.txt`
- 页面内「不销售彩票、不代购、不充值、不兑奖、不收费、不含广告、不构成投注建议」等表述

仓库简介建议直接使用：

```text
单文件零依赖的彩票历史开奖数据统计分析工具（仅供数据研究，不构成投注建议）
```

文案口径与 [COMPLIANCE.md](COMPLIANCE.md) 保持一致，不得出现诱导购彩或承诺收益类表述；具体红线见 [PROMOTION.md 第 5 行](PROMOTION.md)。改完可复跑：

```bash
node scripts/compliance-check.cjs
```

## 7. 发布后建议做的设置

| 设置 | 建议值 |
|---|---|
| 仓库简介 | 见第 6 节 |
| 许可证 | MIT |
| 项目标签 | `lottery` `data-analysis` `data-visualization` `single-file` `zero-dependency` `ocr` |
| Website | `https://maicaipiao.top` |
| Issues | 开启，作为国内反馈与误报申诉入口 |
| README 顶部 | 补上 Gitee 镜像地址，并与 GitHub 主仓库并列 |

## 8. 验证

```bash
# 账号存在
curl -s -o /dev/null -w "%{http_code}\n" https://gitee.com/api/v5/users/respectfully-mei        # 200

# 仓库是否已创建 / 导入完成
curl -s -o /dev/null -w "%{http_code}\n" https://gitee.com/api/v5/repos/respectfully-mei/lottery-analyzer   # 200 = 已就绪

# 本地 remote 检查
git remote -v    # 应同时有 origin(GitHub) 与 gitee
```

## 9. 相关文档

- [GITHUB_SETUP.md](GITHUB_SETUP.md) — GitHub 主仓库推送（PAT / SSH）
- [PROMOTION.md](PROMOTION.md) — 免费推广渠道
- [COMPLIANCE.md](COMPLIANCE.md) — 合规检查报告
- [APPEAL.md](APPEAL.md) — 浏览器风险提示申诉
