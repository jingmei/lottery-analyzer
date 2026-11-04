# 推送到 GitHub

> **重要**：GitHub 自 2021-08-13 起已**禁用账号密码推送 Git**，必须用 **Personal Access Token (PAT)** 或 **SSH Key**。
> 请勿把账号密码或 Token 发在聊天里、写进文件或提交进仓库。

## 0. 待确认的一项

你提供的 `j44905@163.com` 是**登录邮箱**，不是 GitHub 用户名；实测 `api.github.com/users/j44905` 返回 **404**，所以页面里暂未放具体仓库链接（避免死链影响申诉审核）。

👉 请确认你的 GitHub 用户名（登录 GitHub 后看个人主页地址 `github.com/xxxxx` 中的 `xxxxx`），下文用 `<USER>` 代替。确认后需全局替换：

```
lottery-analyzer.html          # 页脚「开源代码」链接（当前已临时移除）
cf-worker/public/about.html    # 开源仓库与 Issues 链接
README.md / docs/*.md          # 仓库地址
```

## 1. 创建仓库（网页，最省事）

1. 登录 GitHub → 右上角 `+` → **New repository**
2. Repository name：`lottery-analyzer`
3. Description：`单文件零依赖的彩票历史开奖数据统计分析工具（仅供数据研究，不构成投注建议）`
4. 选 **Public**，**不要**勾选 "Add a README file" / "Add .gitignore" / "Choose a license"（本地已有，勾选会产生冲突）
5. 点 Create repository

## 2. 生成 PAT

**Fine-grained token（推荐）**：
Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
- Resource owner：你的账号
- Repository access：Only select repositories → `lottery-analyzer`
- Permissions：Contents `Read and write`、Metadata `Read`（必填）
- 设置有效期，生成后**只显示一次**，立刻保存好

**或 Classic token**：`Generate new token (classic)` → 勾选 `repo` → 生成。

## 3. 本地推送

仓库已在本地初始化并完成首次提交。只需：

```bash
cd C:\Users\jingmei\WorkBuddy\2026-10-29-16-28-04

# 配置提交身份（如尚未配置）
git config user.name  "<你的名字或用户名>"
git config user.email "j44905@163.com"

# 绑定远程（把 <USER> 换成真实用户名）
git remote add origin https://github.com/<USER>/lottery-analyzer.git
git branch -M main
git push -u origin main
```

推送时若弹出登录：
- 用户名：GitHub **用户名**（不是邮箱）
- 密码：**粘贴 PAT**（不是账号密码）

Windows 建议启用凭据管理，避免每次输入：

```bash
git config --global credential.helper manager
```

> 不要使用 `https://<TOKEN>@github.com/...` 这种把 Token 写进 remote URL 的方式——它会明文留在 `.git/config` 里。

## 4. SSH 备选（国内网络更稳时可用）

```bash
ssh-keygen -t ed25519 -C "j44905@163.com"
# 把 ~/.ssh/id_ed25519.pub 的内容加到 GitHub → Settings → SSH and GPG keys
git remote set-url origin git@github.com:<USER>/lottery-analyzer.git
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
# 确认没有敏感文件被跟踪
git status --short
git ls-files | grep -Ei '\.env$|token|secret|\.tmp$|archive|live-data'

# 扫描暂存区是否含密钥/密码
git grep -nEi 'PUSH_TOKEN=[^$<]|api[_-]?token|password|cfut_|[A-Fa-f0-9]{40,}' -- . || echo "未发现明文凭据"
```

预期：`git ls-files` 不出现 `.env`、`_archive/`、`live-data.json`、`*.tmp`；`git grep` 无命中（`.env.example` 中的占位说明除外）。

## 7. 免费推广

见 [PROMOTION.md](PROMOTION.md)。
