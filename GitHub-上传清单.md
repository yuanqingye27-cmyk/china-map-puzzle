# GitHub 上传清单（私有仓库）

> 目标：把完整的项目资产传到 GitHub **私有仓库** —— 别人看不到代码，
> 但你自己保留完整历史和全部构建脚本。
>
> 本文只提供**清单和命令**。`git push` 需要你自己执行（我不代你推送）。

---

## 一、`.gitignore` 现状（我核对过，并补了两条）

当前内容：

```gitignore
.DS_Store
*.zip
docs/*.jpg
node_modules/

# 天地图开发者 Key（本地私密配置，绝不入库）
tools/tianditu.config.json

# 抓取缓存与中间产物（不入库：缓存是本地加速，out/ 是可重建的素材）
.cache/
out/

# 部署产物：由根目录的源文件复制而来，可随时重建，不入库
# （重建方式见 docs/部署到Cloudflare.md）
deploy/
deploy-sichuan/

# 临时下载的二进制（例如隧道工具），不入库
tools/bin/
```

**这次我补了三条**：`deploy/`、`deploy-sichuan/`、`tools/bin/`。原因写在注释里了。

### 顺手修掉一个"规则不生效"的坑

`.DS_Store` 早就在 `.gitignore` 里，但它**在规则加进来之前就已经被提交过** ——
而 `.gitignore` 对**已跟踪**的文件不生效，所以它一直挂在仓库里。
已执行 `git rm --cached .DS_Store`（**只从仓库里移除，本地文件还在**），规则这次才真正生效。

---

## 二、必须上传的（缺了项目就跑不起来）

| 路径 | 文件数 | 体积 | 为什么必须 |
| --- | --- | --- | --- |
| `index.html` | 1 | 28 KB | 页面入口 |
| `css/` | 1 | 68 KB | 全部样式 |
| `js/` | 1098 | 20 MB | **运行时代码 + 全部 363 张地图数据**。少了它网站直接打不开 |
| `tools/` | 55 | 900 KB | 31 个构建脚本。**这是项目最值钱的部分之一** —— 没有它，20MB 地图数据无法重建 |
| `docs/*.md` | 6 | 约 60 KB | 架构评估、进度记录、玩法设计、可持续性、资料缺口清单、项目现状简报 |
| `地图拼图项目_开发SOP与交接文档_v1.0.0.md` | 1 | 约 200 KB | 开发 SOP 与全部踩过的坑（41 条） |
| `HANDOVER.md` | 1 | 约 20 KB | 交接文档 |
| `README.md` | 1 | 约 30 KB | 项目门面 |
| `README-如何发给同学.md` | 1 | 约 10 KB | 传播实操 |
| `data/tianditu-official/` | 25 | 2.7 MB | 天地图官方数据快照（**合规凭据**：审图号对应的原始数据） |
| `batch-report.json`、`geo-source-report.json` | 2 | 小 | 批量接入的报告，可追溯 |
| `.gitignore` | 1 | 小 | 上面那份 |

**合计约 1213 个文件、约 24 MB。**

---

## 三、建议排除的（已在 `.gitignore` 里，无需操作）

| 路径 | 体积 | 为什么排除 |
| --- | --- | --- |
| `out/` | 约 40 MB | 打包产物（单文件离线包等）。**可由 `tools/bundle.js` 一键重建**，不必占仓库 |
| `deploy/` | 20 MB | 部署产物（完整版 1100 个文件），由源文件复制而来，一条命令就能重建 |
| `deploy-sichuan/` | 1.3 MB | 部署产物（单文件精简版），由 `tools/bundle.js` 一键重建 |
| `.cache/` | 视情况 | 抓取缓存、npm 缓存。本地加速用，重建成本低 |
| `tools/tianditu.config.json` | 小 | **天地图开发者 Key，绝不入库** |
| `归档.zip` | 大 | 已被 `*.zip` 覆盖 |
| `node_modules/` | — | 本项目运行时零依赖，只有临时用 `npx` 时才会出现 |
| `tools/bin/` | — | 临时下载的二进制（如隧道工具） |

### ⚠ 一个需要你决定的冲突：`docs/*.jpg`

你的要求里写了"建议排除 `docs/*.jpg`"。但有一个问题：

**这些图片早就被提交过了，所以 `.gitignore` 里的规则对它们不生效。**
而且 **`README.md` 引用了其中 7 张**：

```
README.md:22   ![地图导航](docs/ui-chengdu.png)
README.md:24   ![窄屏下的导航](docs/ui-mobile.png)
README.md:26   ![第一关：中心城区](docs/level1.jpg)
README.md:32   ![开场动画](docs/intro.jpg)
README.md:36   ![结算画面](docs/settle.jpg)
README.md:40   ![手绘图案](docs/patterns.jpg)
README.md:554  ![南海诸岛及九段线](docs/ui-china-nanhai.png)
```

`docs/` 里 15 张图加起来 **5.8 MB**。

| 方案 | 结果 | 代价 |
| --- | --- | --- |
| **A. 保留（我的建议）** | README 在 GitHub 上能正常显示截图 | 仓库多 5.8 MB。**私有仓库上限 1 GB，这点体积可以忽略** |
| B. 排除 | 仓库小 5.8 MB | **README 里 7 张图全部裂掉**，项目门面变差 |

我**没有替你执行 B**，因为它会破坏 README 的显示效果。你要选 B 的话，命令是：

```bash
# 只在你想选 B 的时候执行：只从仓库移除，本地文件保留
git rm --cached docs/*.jpg docs/*.png
git commit -m "chore: 截图不入库（README 里的图片会失效）"
```

> 顺带一提：`README.md` 引用的是 `.png`，而 `.gitignore` 只写了 `docs/*.jpg` ——
> 就算规则生效，`.png` 那几张也照样会在仓库里。所以"排除"要同时写 `docs/*.jpg` 和 `docs/*.png`。

---

## 四、上传命令（你自己执行）

### 第 0 步：先在 GitHub 上建一个**空的私有仓库**

1. 打开 <https://github.com/new>
2. **Repository name**：例如 `map-puzzle`
3. **Visibility** 选 **Private** ← 关键。私有仓库只有你自己（和被邀请的人）能看到
4. **不要**勾选 "Add a README file" / ".gitignore" / "license"
   （勾了会在远端产生一个提交，push 时会冲突，要多一步合并）
5. 点 **Create repository**，然后**先别关页面** —— 它会显示仓库地址，形如
   `https://github.com/<你的用户名>/map-puzzle.git`

### 第 1 步：确认本地干净

```bash
cd /Users/apple/Desktop/deepseekharness
git status                    # 应当没有未提交的改动
git log --oneline -1          # 看一眼最新提交
```

### 第 2 步：关联远端并推送

```bash
cd /Users/apple/Desktop/deepseekharness

git remote add origin https://github.com/<你的用户名>/map-puzzle.git
git branch -M main
git push -u origin main
```

第一次推送会让你认证。**GitHub 从 2021 年起不接受账号密码**，要用
**Personal Access Token** 当密码：

1. 打开 <https://github.com/settings/tokens> → **Generate new token (classic)**
2. 勾选 **`repo`** 权限，设置有效期
3. 复制生成的 token（只显示一次）
4. `git push` 提示输入密码时，**粘贴 token**

> 更省事的替代：装 GitHub CLI（`brew install gh`），然后 `gh auth login`，
> 之后 `git push` 就不用反复输 token 了。

### 第 3 步：确认上传成功

```bash
git remote -v                          # 应当显示 origin 指向你的仓库
git ls-remote --heads origin           # 应当能看到 main
```

浏览器打开 `https://github.com/<你的用户名>/map-puzzle` 核对文件数（应当约 1213 个）。

### 之后的日常提交

```bash
git add -A
git commit -m "说明这次改了什么"
git push
```

---

## 五、为什么建议 Private

| | Private（推荐） | Public |
| --- | --- | --- |
| 代码可见性 | 只有你（和被邀请的人） | 所有人 |
| 作品集价值 | 需要主动邀请别人看，或日后转公开 | 可以直接贴链接当简历项目 |
| 被抄的风险 | 低 | 任何人可以 fork |
| GitHub Pages | **免费套餐下私有仓库不能开 Pages** | 可以开 |
| 本项目的影响 | 部署走 Cloudflare Pages（**不看仓库公开性**），所以私有完全够用 | — |

**结论**：你现在的部署路线是 Cloudflare Pages（直接上传 `deploy/`），
**不依赖 GitHub Pages**，所以私有仓库不会影响部署。

如果之后想拿它当简历项目，随时可以在
仓库 **Settings → General → 最下方 Danger Zone → Change visibility** 改成 Public。

---

## 六、上传之后你会得到什么

- **一份完整备份**：363 张地图数据 + 31 个构建脚本 + 全部文档，都在 GitHub 上
- **可追溯的历史**：62+ 次提交记录，能看出"每一步为什么这么改"
- **换电脑/重装系统不会丢**
- **日后可以只挑一部分转公开**（比如把 `tools/` 和 SOP 留着，把内容开出去）

---

## 附：本次核对结果（实测，不是估计）

```
已跟踪文件数      1213
.git 体积         21 MB
js/               1098 个文件  20 MB    ← 运行时代码 + 全部地图数据
tools/              55 个文件  900 KB   ← 31 个构建脚本
css/                 1 个文件   68 KB
docs/               21 个文件  5.8 MB   ← 其中 15 张截图占绝大部分
data/               25 个文件  2.7 MB   ← 天地图官方数据快照（合规凭据）
顶层文件             9 个：index.html / README.md / HANDOVER.md / SOP / 两份报告 / .gitignore / README-如何发给同学.md
```
