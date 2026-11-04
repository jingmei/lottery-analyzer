# 推送到 GitHub

> **重要**：GitHub 自 2021-08-13 起已**禁用账号密码推送 Git**，必须用 **Personal Access Token (PAT)** 或 **SSH Key**。
> 请勿把账号密码或 Token 发在聊天里、写进文件或提交进仓库。

## 0. 已确认的信息

| 项 | 值 |
|---|---|
| GitHub 用户名 | **`jingmei`**（截图中 `jingmei (jingmei)`，个人主页 https://github.com/jingmei ） |
| 登录邮箱 | `j44905@163.com`（账号已验证邮箱，用作 git 提交邮箱） |
| 仓库名 | `lottery-analyzer` |
| 仓库地址 | https://github.com/jingmei/lottery-analyzer |
| 当前状态 | 账号 `public_repos = 0`，`api.github.com/repos/jingmei/lottery-analyzer` 返回 **404 → 仓库尚未创建** |

> 之前 `api.github.com/users/j44905` 返回 404，是因为那是**登录邮箱不是用户名**；现已按真实用户名 `jingmei` 更新全部文档、页面与 about 页链接。本地 `git user.name` 也已由 `j44905` 改为 `jingmei`。

## 1. 创建仓库（网页，最省事）

1. 打开 **https://github.com/new**
2. Repository name：`lottery-analyzer`
3. Description：`单文件零依赖的彩票历史开奖数据统计分析工具（仅供数据研究，不构成投注建议）`
4. 选 **Public**，**不要**勾选 "Add a README file" / "Add .gitignore" / "Choose a license"（本地已有，勾选会产生冲突）
5. 点 **Create repository**

## 2. 生成 PAT

**PAT 不在「Password and authentication」页里**，它在 Settings 左侧栏**最底部**：

```
右上角头像 → Settings → 左侧栏拉到最底 → Developer settings
  → Personal access tokens → Tokens (classic)
  → 「Generate new token ▾」→ 「Generate new token (classic)」
```

直达链接：**https://github.com/settings/tokens**

填写：

| 字段 | 填什么 |
|---|---|
| Note | `lottery-analyzer-push`（仅备注，随便起名） |
| Expiration | 建议 `90 days`（到期换新，比 No expiration 安全） |
| Select scopes | 勾选 **`repo`**（勾顶层那个即可，会自动带上子项） |

点 **Generate token** → 页面显示 `ghp_...` → **立刻复制**（只显示一次，刷新后不再出现）。

> ⚠️ 不要把 PAT 贴进聊天、写进 `.env`、写进 remote URL 或提交进仓库。
> 本仓库的 `push-github.bat` 会**隐藏输入** PAT，不回显、不落盘、跑完清空。

Fine-grained token 也能用，但要手动指定仓库并开 `Contents: Read and write` + `Metadata: Read`，比 classic 容易配错，建议直接用 classic。

## 3. 一键推送（推荐）

双击 **`push-github.bat`**：

1. 先检查远端仓库是否已创建（没建会提示去 https://github.com/new 并退出）；
2. 隐藏输入 PAT（`Read-Host -AsSecureString`，不回显）；
3. 自动设置 `user.name=jingmei` / `user.email`、`origin`、把分支改名为 `main`；
4. 通过 `GIT_ASKPASS` + 进程环境变量把 PAT 传给 git，**不写入 `.git/config`、不写任何文件**，结束立即清空；
5. 执行 `git push -u origin main`；
6. 成功后提示下一步。

之后日常更新直接 `git push` 即可（首次已用 `-u` 绑定）。

> **环境注意（2026-11-05 实测）**：这台机器上 `git` 装在 WorkBuddy 自带的
> `PortableGit\mingw64\bin\` 里，**只注入 Git Bash 会话**，双击 `.bat` 启动的普通
> PowerShell 里 `git` 不在 PATH。旧版脚本因此会在第一个 `git` 命令处直接终止，
> 表现为 `git remote -v` 为空、分支仍叫 `master`、PAT 白输一次。
> 现版 `push-github.ps1` 会自动搜索并定位 `git.exe`（WorkBuddy PortableGit +
> 标准 `C:\Program Files\Git` 等路径），用绝对路径调用，并把该目录临时加入 PATH；
> 仓库存在性检查也改用 Windows 自带的 `curl.exe`，不受 PowerShell 代理设置影响。
> 两个脚本内文字刻意保持**纯 ASCII 英文**：PowerShell 5.1 会把无 BOM 的 UTF-8 脚本按
> ANSI 解析，中文会乱码；**`.bat` 更严重** —— cmd 默认按 GBK 读取批处理文件，
> UTF-8 中文字节会把 `echo` 行拆成 `'cho'` / `'rerequisites'` 等碎片并报
> 「不是内部或外部命令」，`chcp 65001` 救不回已经读乱的行。中文说明一律放在对话里，
> 不要写进 `.bat` / `.ps1`。

## 3b. 手动推送（备选）

```bash
cd C:\Users\jingmei\WorkBuddy\2026-10-29-16-28-04

git config user.name  "jingmei"
git config user.email "j44905@163.com"

git remote add origin https://github.com/jingmei/lottery-analyzer.git
git branch -M main
git push -u origin main
```

弹出登录时：用户名填 **`jingmei`**（不是邮箱），密码**粘贴 PAT**（不是账号密码）。
Windows 可启用凭据管理避免每次输入：

```bash
git config --global credential.helper manager
```

> 不要用 `https://<TOKEN>@github.com/...` 这种把 Token 写进 remote URL 的方式——它会明文留在 `.git/config` 里。

## 4. SSH 备选（国内网络不稳时可用）

```bash
ssh-keygen -t ed25519 -C "j44905@163.com"
# 把 ~/.ssh/id_ed25519.pub 加到 GitHub → Settings → SSH and GPG keys
git remote set-url origin git@github.com:jingmei/lottery-analyzer.git
git push -u origin main
```

若 22 端口被阻断，用 `ssh.github.com:443`（在 `~/.ssh/config` 里配置 `Host github.com / HostName ssh.github.com / Port 443 / User git`），并把主机密钥加入 `known_hosts`。

> 网络说明：前期实测 `api.github.com` 可达、但 `github.com` 的 HTTPS CONNECT 被代理拒绝（502）。
> **2026-11-05 复测已恢复**：`api.github.com` 200、`github.com` 200、`git ls-remote https://github.com/git/git.git HEAD` 成功，可直接按第 3 步推送。
> 若以后又遇到 502 / 超时，换网络或配置可用代理后再试，不要改 remote URL。

## 5. 推送后的仓库设置（提升可信度与曝光）

| 设置 | 建议值 |
|---|---|
| Description | 一句话说清"做什么"，见第 1 步 |
| Website | `https://maicaipiao.top` |
| Topics | `lottery`, `data-analysis`, `data-visualization`, `single-file`, `zero-dependency`, `cloudflare-workers`, `ocr`, `chinese` |
| README | 已就绪；确保 GitHub 首页渲染正常 |
| License | MIT（已就绪） |
| Discussions / Issues | 开启，方便反馈与申诉联系 |
| GitHub Pages | 可把 `cf-worker/public/` 发布为免费备用站点（国内访问同样偏慢） |
| Social preview | 上传一张页面截图 |

## 6. 推送前的安全自检（**必做**）

```bash
git status --short
git ls-files | grep -Ei '\.env$|token|secret|\.tmp$|archive|live-data'
git grep -nEi 'PUSH_TOKEN=[^$<]|api[_-]?token|password|cfut_|ghp_|[A-Fa-f0-9]{40,}' -- . || echo "未发现明文凭据"
```

预期：`git ls-files` 不出现 `.env`、`_archive/`、`live-data.json`、`*.tmp`；`git grep` 无命中（`.env.example` 的占位说明除外）。
`push-github.ps1` 里出现的 `GH_PAT` 只是**环境变量名**，不含任何真实 Token。

## 7. 推送后：让线上页面同步仓库链接

`lottery-analyzer.html` 页脚和 `cf-worker/public/about.html` 已加上真实仓库链接，但 **Cloudflare Worker 的静态资源需要重新部署才会在 `maicaipiao.top` 生效**：

双击 **`deploy-worker.bat`**（隐藏输入 Cloudflare API Token）→ 自动 `wrangler deploy`。

部署后线上首页页脚与 `/about.html` 会显示 `github.com/jingmei/lottery-analyzer`，这也是华为 / 腾讯申诉时「代码可审查」的佐证。

## 8. 免费推广

见 [PROMOTION.md](PROMOTION.md)。

## 9. 故障排查速查表

| 现象 | 原因 | 处理 |
|---|---|---|
| `'cho' 不是内部或外部命令` / 中文乱码 / `綍鏂函欢` | `.bat` 含 UTF-8 中文，被 cmd 按 GBK 拆断命令 | 已改为纯 ASCII；任何 `.bat` 都不要写中文 |
| 脚本显示 `ACTION REQUIRED: remote repository does NOT exist` | 仓库还没建 / API 检查时还没生效 | 去 https://github.com/new 建空 Public 仓库，等几秒后重跑 |
| `git remote -v` 为空、分支还是 `master` | 脚本在调用 git 之前就崩了（旧版 git 不在 PATH） | 用现版脚本；或手动 `git remote add origin ...` + `git branch -M main` |
| 显示 `ERROR: git.exe NOT FOUND` | 连 PortableGit 也没找到 | 安装 Git for Windows，或在 Git Bash 里手动执行第 3b 步 |
| `FAILED` + `Authentication failed` | PAT 没勾 `repo` / 已过期 / 复制时少了字符 | 重新生成 classic PAT 勾 `repo`，重新粘贴 |
| `FAILED` + `Repository not found` | 仓库名不是 `lottery-analyzer`，或 PAT 无该仓库权限 | 核对 `git remote -v` 与 GitHub 上的仓库名 |
| `FAILED` + 超时 / `Could not resolve host` | 网络或代理 | 换网络；必要时去掉代理后重试，不要改 remote URL |
| 推送成功但线上站点没变 | 只推了 GitHub，没重新部署 Worker | 跑 `deploy-worker.bat` |

自检命令（在任何 git 终端里）：

```bash
git remote -v                 # 应显示 origin -> https://github.com/jingmei/lottery-analyzer.git
git branch -vv                # 应显示 * main
git status --short            # 应为空
curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/jingmei/lottery-analyzer   # 200
```

