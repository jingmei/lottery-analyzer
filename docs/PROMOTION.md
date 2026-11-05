# 免费推广渠道与方法

> 全部为**免费**渠道。核心原则：**先讲清楚"解决了什么问题"，再顺带放链接**；选 3~5 个深耕，比广撒网有效得多。
>
> ⚠️ **本项目的特别红线**：彩票类目对营销文案高度敏感。推广时**不得**出现「预测中奖」「AI 荐号」「稳赚」「提高中奖率」「必中」等表述，也不得暗示能提升中奖概率。建议主打**技术亮点**：单文件零依赖、可离线、本地 OCR、300 期内嵌快照、Cloudflare Worker + KV 边缘架构、开奖后智能抓取。每篇文末附免责声明。

## 一、先把 GitHub 仓库本身做好（零成本，收益最高）

| 动作 | 说明 |
|---|---|
| Description | 一句话说清"做什么"（见 GITHUB_SETUP.md） |
| Topics | `lottery` `data-analysis` `data-visualization` `single-file` `zero-dependency` `cloudflare-workers` `ocr` `chinese` |
| README | 已有；确保首页渲染、架构图、快速开始、免责声明齐全 |
| Social preview | 上传页面截图，分享卡片更可信 |
| GitHub Pages | 把 `cf-worker/public/` 发布为免费备用站点（国内访问同样偏慢，但多一个入口） |
| Releases | 首个版本打 tag `v1.0.0`，写清功能与合规说明 |
| Discussions / Issues | 开启，作为反馈与申诉联系入口 |
| 提交到 Awesome 列表 | 搜索 `awesome-cn`、`HelloGitHub` 等收录开源项目的仓库，按格式提 PR |
| Gitee 国内镜像 | https://gitee.com/respectfully-mei/lottery-analyzer （已就绪，维护见 [GITEE_SETUP.md](GITEE_SETUP.md)） |

## 二、渠道清单（按优先级）

### A. 国内开发者社区（反馈最快，第 1~2 天）

| 渠道 | 版块 / 方式 | 特点 |
|---|---|---|
| **V2EX** | 「分享创造」节点 | 国内程序员最集中，技术类产品转化最好；标题用「分享+讨论」口吻 |
| **W2solo** | 独立开发者社区 | 氛围好，适合首发 |
| **Solo 社区** / **即刻** | 产品安利社等圈子 | 轻量曝光 |
| **掘金 / 稀土掘金** | 写技术文章 | 写「为什么这样做 + 架构设计」，不要只贴链接 |
| **SegmentFault 思否** | 问答 / 文章 | 技术向 |
| **小众软件** | 「软件议题 / 讨论分享」 | 工具类站点，用户精准 |
| **少数派** | 投稿（需高质量文章） | 日 IP 高，可获首页推荐 |
| **开源中国 / Gitee** | 发布项目 + 代码镜像 | 国内访问快；镜像地址与步骤见 [GITEE_SETUP.md](GITEE_SETUP.md)（Pages 已下线，只发仓库、不发网页） |

### B. 内容平台（SEO 长期生效，第 2~4 天）

| 可带链接 | 不可带链接（留搜索线索 / 私域钩子） |
|---|---|
| 知乎、CSDN、博客园、简书、微信公众号、掘金 | 小红书、B站、抖音、百家号、搜狐号、头条号 |

### C. 产品发现平台（提交即曝光，第 3~5 天）

`Product Hunt`、`新趣集`、`创造者日报`、`Mergeek`、`Indie Hackers`、`IT之家（投稿）`、`36氪企服点评`

### D. 周刊投稿（被收录一次抵十篇）

`HelloGitHub`（开源项目分享，最契合）、`开发者头条`、`奇舞周刊`、`前端早早聊`、各类独立开发周刊。

### E. 出海（可选，第 5~7 天）

`Hacker News` 的 **Show HN**（美西早上发）、`Reddit` 的 r/programming / r/opensource（用英文，标题突出"解决了什么问题"）、`X/Twitter`、`Product Hunt`。

### F. 目录与导航站（门槛低，顺手提交）

`AlternativeTo`、`SaaSHub`、各类 AI / 工具导航站。注意说明是**数据分析工具**，不要被归类到博彩导航。

## 三、7 天执行计划

| 时间 | 动作 |
|---|---|
| 第 1 天 | 完善 README / 截图 / Topics；写好**一篇**通用介绍文章 |
| 第 1~2 天 | 发 V2EX「分享创造」、W2solo、即刻、Solo 社区，及时回复评论 |
| 第 2~3 天 | 改写成长文发掘金、知乎、CSDN、博客园（可带链接，SEO 慢慢生效） |
| 第 3~4 天 | 同步到小红书 / B站 / 公众号（不可带链接的留搜索线索） |
| 第 4~5 天 | 给 HelloGitHub 等 3 个周刊投稿 |
| 第 5~7 天 | 提交 Product Hunt / 新趣集 / Show HN（如做出海） |
| 之后 | 看数据，挑效果最好的 2~3 个渠道持续深耕、持续迭代 |

## 四、一篇文章的通用结构（可直接套用）

1. **背景/痛点**：官方只给开奖列表，想看频次、遗漏、走势得自己导数据算
2. **做了什么**：一个单文件 HTML，打开就能用，没网也有 300 期快照
3. **技术亮点**（重点）：零依赖、本地 OCR 识别投注行、Cloudflare Worker + KV 边缘缓存、开奖后智能抓取
4. **架构取舍**：为什么边缘不抓官网（海外 IP 被 WAF 403）、为什么保留内嵌快照
5. **怎么跑**：`node server.js 8080`，或双击 HTML 离线用
6. **开源链接 + 许可证**
7. **免责声明**（必带）：独立随机事件、不存在可预测规律、不构成投注建议、不销售彩票

### 标题示例（合规、不踩红线）

- V2EX：`用单个 HTML 文件做了个彩票历史数据统计工具，零依赖、可离线`
- 掘金：`为什么我用单文件 HTML 而不是 React：一个零依赖数据可视化工具的实践`
- 少数派：`把开奖数据做成能离线看的图表：一个本地优先的小工具`
- Show HN：`Show HN: A single-file, offline-first lottery data analyzer (no backend)`

❌ 不要写：`AI 预测中奖` `荐号神器` `提高中奖率` `稳赚` `内部数据`

## 五、避坑清单

- **不要只发一次**：内容衰减很快，把推广当长期工作。
- **不要硬广**：社区讨厌直接丢链接；先分享经验、参与讨论，再顺带提项目。
- **不要贪多**：35 个渠道不可能都覆盖，选 3~5 个做透。
- **一定要回评论**：早期用户的 issue / 评论是最有价值的反馈，不回复会显得项目没人维护。
- **不要"求 Star"**：展示"解决了什么问题"比求 Star 有效得多。
- **合规一致性**：所有渠道文案口径与 `about.html` 保持一致，避免出现互相矛盾的"预测"表述，否则容易被人截图质疑。

## 六、本项目的现实预期

彩票数据分析属于**小众 + 类目敏感**方向，不建议追求大流量。合理目标是：拿到第一批 50~200 个 Star、几个真实 issue 反馈、以及一个可被审核员查证的公开仓库（对 [申诉](APPEAL.md) 也有帮助）。**ICP 备案与平台风险标记**是推广之外更要优先解决的访问门槛。

---

## 七、补充渠道（初版未点名，按性价比排序）

### 1. 阮一峰《科技爱好者周刊》—— 中文圈性价比最高

每周五发布，偏好「小巧、有趣、打开就能用」的开源工具，与本项目「单文件零依赖」高度契合。投稿走 `ruanyf/weekly` 仓库的 issue / 推荐区，格式固定为：**项目名 + 一句话 + 链接 + 为什么值得看**。被收录一次带来的长尾曝光，远超自己发十篇。模板见第八节 B。

### 2. Gitee / 开源中国生态（刚建好镜像，正好用上）

- 开源中国「资讯 / 项目推荐」投稿；
- Gitee 仓库页开启 Issues、写项目动态，把国内访问者沉淀下来；
- GVP（Gitee 最有价值开源项目）评选门槛较高，先了解即可，不必强求；
- 国内访问快，适合作为中文文案里的备用链接。

### 3. 把技术点拆成独立文章（比「介绍整个项目」更容易被收录）

| 选题 | 建议投放 |
|---|---|
| 为什么我把 300 期数据内嵌进单个 HTML | 掘金 / 知乎 |
| 海外 Worker 抓国内官网被 WAF 拦截：边缘缓存 + 本机推送的架构取舍 | 掘金 / InfoQ / SegmentFault |
| 用 Tesseract.js 在浏览器做行级文字识别：干扰行排除与本地化处理 | 掘金 / SegmentFault |

每篇讲清「问题 → 做法 → 踩坑 → 取舍」，文末放仓库链接 + 免责声明，**不要写成项目广告**。

### 4. 回答式 SEO（长尾最稳、几乎零成本）

在知乎 / SegmentFault 搜索「开奖数据 统计」「数据可视化 单文件」等已有问题，写正经技术回答再带链接；CSDN / 博客园发带完整思路的文章，不要只贴裸链接。这类内容半年后还在带来访问。

### 5. GitHub 自身再挖一层

- 打 `v1.0.0` Release，写清功能与合规说明；
- Discussions 开「Show and tell」，沉淀用户反馈；
- README 徽章 + Social preview 截图 —— **截图里不要出现任何号码组合或参考组合类字样**；
- Topics 按 [GITHUB_SETUP.md](GITHUB_SETUP.md) 补齐，更容易被站内搜索与 Trending 捞到（Trending 无法主动提交，但前 48 小时的 star 节奏与 Topics 会影响它）。

---

## 八、可直接复制的文案

以下均为技术向口径、自带免责声明，可直接用或微调。**不要加入预测、荐号、提高中奖率类表述。**

### A. V2EX「分享创造」

标题：

```text
用单个 HTML 文件做了个彩票历史数据统计工具，零依赖、可离线
```

正文：

```text
最近想看开奖号码的频次、遗漏和走势，官方只有列表，就自己写了个单文件 HTML。

- 单个文件、零依赖、零后端，双击就能用；没网也有内嵌的 300 期快照
- 六大彩种，30/50/100 期频次、遗漏、走势、奇偶和值、图表
- 拍照识别用 Tesseract.js 在浏览器本地跑，按行识别，不上传任何图片
- 想要手机随时看，可选配 Cloudflare Worker + KV：国内本机抓数推到边缘，手机读缓存

架构上踩过一个坑：海外 Worker 直接抓国内官网会被 WAF 403，所以改成
「本机抓数 → 推边缘 KV → 手机读缓存」，边缘完全不抓官网。
另外做了页面短缓存 + 请求超时重试 + 内嵌快照兜底，跨洋链路波动时也不会白屏。

代码 MIT 开源，欢迎审查：
GitHub: https://github.com/jingmei/lottery-analyzer
Gitee : https://gitee.com/respectfully-mei/lottery-analyzer
在线  : https://maicaipiao.top

说明：只是历史数据的整理与可视化，彩票开奖是独立随机事件，不存在可预测规律；
不构成投注建议，不销售彩票、不收费、不含广告，也不收集任何个人信息。
```

### B. 阮一峰周刊投稿格式

```text
项目：彩票历史数据统计分析工具
链接：https://github.com/jingmei/lottery-analyzer
一句话：一个单文件、零依赖、可离线使用的彩票开奖数据可视化工具。
推荐理由：把 300 期历史数据直接内嵌进 HTML，双击即用；拍照识别与图表都在浏览器
本地完成，不上传任何数据。实现上还处理了「海外边缘节点抓国内官网被 WAF 拦截」
这个架构问题，改成本机抓数推到 KV 的边缘缓存方案，代码很短，适合当单文件前端
与边缘计算的入门读物。
```

### C. Show HN

标题：

```text
Show HN: A single-file, offline-first lottery data analyzer (no backend)
```

正文：

```text
I wanted frequency/omission charts for public lottery draw results, so I built a single
self-contained HTML file: charts, a 300-draw embedded snapshot, and OCR-based number entry
(Tesseract.js, all local, nothing uploaded). No build step, no dependencies, works from file://.

Optional public mode uses Cloudflare Worker + KV. One thing I learned the hard way: a Worker
on overseas edge IPs gets 403 from the Chinese official data sources (WAF), so the fetch runs
on a machine inside China and pushes to KV; phones only read the edge cache.

MIT:  https://github.com/jingmei/lottery-analyzer
Demo: https://maicaipiao.top

Note: this is historical data analysis only. Draws are independent random events; no
prediction claims, no betting features, no ads, no data collection.
```

### D. Product Hunt

- Tagline：`A single HTML file for lottery draw data analysis — offline, zero dependencies`
- First comment：讲动机、架构取舍、合规边界，附 GitHub 链接与免责声明；不要写任何暗示提升中奖概率的表述。

---

## 九、现阶段节奏（2026-11-05）

- **全部链接已是实链**：GitHub、Gitee 镜像、`https://maicaipiao.top` 均返回 200，可放心写进文案。
- **申诉期间的主链接策略**：华为手机自带浏览器的风险提示仍在复审（预计 2~3 工作日）。这段时间推广**主推 GitHub / Gitee 仓库地址**，把站点放在「在线 Demo」次要位置 —— 否则部分华为用户点进去会看到拦截页，转化白白打折。申诉通过后再把站点提到主位，并补小红书 / B站 / 公众号等面向普通用户的内容。
- **本周建议只做三件**：① 阮一峰周刊投稿 ② V2EX「分享创造」 ③ 掘金发一篇技术拆解（三选二也行）。先拿到第一批真实反馈，再决定是否铺量。
- **不要碰**：彩票 / 博彩论坛与导航站、买量、用「预测」「荐号」「提高中奖率」做 SEO 关键词、短时间密集重复发帖。这类操作对类目敏感项目不仅无效，还可能反过来加重平台的风险标记。
- 每篇文末固定附免责声明，口径与 [COMPLIANCE.md](COMPLIANCE.md)、`cf-worker/public/about.html` 保持一致。
