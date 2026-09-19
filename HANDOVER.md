# 交接指南 · 从这里开始（v1.2.0）

> **给"新开一个对话"用的。** 只读**这一个文件** + 跑 3 条命令，
> 就能在 2 分钟内接上进度。不需要读源码，不需要读 157 KB 的 SOP。
>
> 详细背景按需再查：
> `PROJECT_INTRO.md`（是什么/架构/设计决策）·
> `地图拼图项目_开发SOP与交接文档_v1.0.0.md`（SOP + 44 条踩过的坑）·
> `CHANGELOG.md`（逐轮改动 + 待人工复核清单）

---

## 0. 一句话状态

**v1.2.0 · 技术骨架与玩法都已完成，卡在"没人玩"。**

- **骨架**：363 张地图（中国 → 34 省级 → 329 地级），3214 个下级行政区 100% 接入，面积 3214/3214
- **玩法**：六套本地模式（普通/计时/教学/考试/儿童/本地双人）+ 图鉴/徽章/每日一图/家乡/分享卡/众包纠错
- **测试**：**17185 项全绿**（离线 2202 + 浏览器 14946）
- **内容**：3214 条资料里完成 **116 条（3.6%）** —— 这是唯一的大缺口
- **用户**：**0 个真人玩过**（已部署上线，但还没发出去）
- **线上**：`https://map-puzzle-89v.pages.dev`（Cloudflare Pages，已部署过两轮）

> **当前阶段是「验证」，不是「开发」。** 在拿到 10 个真人的反馈之前，
> 不要再加新功能 —— 详见 §3 的决策说明。

---

## 1. 新对话第一句话：把下面这段整段粘贴过去

```
我在继续一个已到 v1.2.0 的项目（地图拼图，仓库在 /Users/apple/Desktop/deepseekharness）。
请先只做三件事，不要读任何源码：

1. 读根目录的 HANDOVER.md —— 先看 §1.5 进度快照（做到哪、下一步敲什么）
2. 跑 node tools/status.js
3. 跑 node tools/e2e-test.js --only-suite=offline 2>&1 | tail -14
   # 基线应为 2202 通过 / 0 失败（秒级）
   # 全量基线是 17185，约 10 分钟，非必要不跑

然后把"你理解的任务 + 打算怎么做"讲给我听，等我确认再动手。

硬性约束（违反即返工）：
- 地理合规红线：不许改任何边界坐标；审图号声明、南海诸岛及海上界线、
  台湾省、澳门/香港特别行政区、藏南阿克赛钦相关内容一律保留不动
- 不许编造地理科普事实。事实类文案（数字/年份/地名）改动前必须我确认
- 不许为了让测试通过而修改测试断言
- 数据源只用天地图官方：--source=tianditu-portal 或 file --dir=data/tianditu-official
- engine.js 只允许加**通用配置开关与回调**（如 pieceNames / hintLimit / onPlacement），
  不许塞进具体地图数据，也不许塞进"模式分支"（模式逻辑在 js/modes.js）
- 技术栈保持纯原生零依赖：不许引框架/npm 包/后端；file:// 双击必须能玩；
  新增状态全部存 localStorage
- 输出纪律：脚本/测试一律 `| tail -N`；js/maps/**/*.geo.js 是单行 100KB+，
  禁止 cat/head/tail，要看内容就用 node 脚本摘要

今天我想做：<填：找真人验证 / 补某个市的资料 / 收尾成作品集 / 其他>
```

> 把 `<填 …>` 换掉即可。这段话就是"上下文引导"，让新对话跳过所有摸索成本。

---

## 1.5 进度快照（2026-09-19 · 下次从这里接）

**一句话**：技术骨架 + 玩法都完成了，**下一步只有两种可能：验证有人玩，或者收尾成作品集**。

### 已完成

| 项 | 状态 |
| --- | --- |
| 地图骨架 | **363 张**：中国 → 34 省级 → 329 地级，0 个待接入 |
| 面积 | **3214 / 3214** 全覆盖（球面多边形从官方边界几何算，与公布值核对过） |
| 关卡 | 中国图按**地理分 7 关**；省按离省会距离；市按**民政部官方行政区划类型** |
| 玩法 | **六套模式** + 连击计分 + 图鉴 + 9 徽章 + 每日一图 + 我的家乡 + 分享卡片 + 众包纠错 |
| 内容文案 | **116 / 3214**（成都、乐山完整 + 34 个省级） |
| 测试 | **17185 项全绿**：离线 2202 / 城市回归 91 / 引擎 86 / 玩法模式 77 / 多地图冒烟 14687 / 极小碎片拖拽 42 |
| 部署 | Cloudflare Pages 已跑通两轮；`deploy/`（全国 1101 文件）、`deploy-sichuan/`（单文件） |
| 传播工具 | 局域网服务 / 单文件包 / **裁剪部署包** / 临时公网隧道，四个都实测可用 |

### 未完成（按重要性）

| 缺口 | 数字 | 说明 |
| --- | --- | --- |
| **真人验证** | 0 / 10 人 | 已经部署上线，链接还没发出去。**这是第一优先级** |
| 资料文案 | 3098 条 / 9173 字段 | 流水线已跑通（`facts-batch` → 子代理 → `facts-verify --apply`） |
| 真人终审 | 4 项 | 34 条省级文案事实、部署文档完整性、关卡分区方案、本轮新增模式文案（见 `CHANGELOG.md`） |
| 真机测试 | — | 从没在真手机 / Safari / Firefox 上自动测过 |

### 下一步敲什么

```bash
# ① 找真人验证（当前阶段的唯一正事）
node tools/share-online.js --map=sichuan     # 生成公网链接，直接发群
node tools/serve.js --map=sichuan            # 或者局域网（同一 WiFi）

# ② 若要更新线上站点
npx wrangler@latest pages deploy deploy/ --project-name=<项目名>
npx wrangler@latest pages project list       # 忘了项目名就跑这个

# ③ 若决定继续补内容
node tools/status.js                         # 看总缺口
node tools/todo-report.js                     # 看哪个市缺口大
node tools/facts-batch.js --map=<市> --delay=1800 --prompt
#   → 交给子代理 → out/verify-<市>.json
node tools/facts-verify.js --map=<市> --in=out/verify-<市>.json --apply
```

---

## 2. 3 条命令自举

```bash
node tools/status.js                                         # 现状：地图数/资料缺口/数据源/下一步
node tools/e2e-test.js --only-suite=offline 2>&1 | tail -14   # 秒级，基线 2202
node tools/e2e-test.js 2>&1 | tail -24                        # 全量，基线 17185，约 10 分钟
```

**排查单张地图时不要跑全量**：

```bash
node tools/e2e-test.js --only-maps=beijing,taiwan --only-suite=smoke
node tools/e2e-test.js --only-suite=modes        # 只跑玩法模式套件（约 5 秒）
```

---

## 3. 两条主线（下次大概率选其中一条）

### 路线 A · 真人验证（**推荐**）

**为什么这是第一优先级**：内容缺口 3132 条是 40~50 轮的投入，
而"到底有没有人想玩"**从未被验证过**。如果没人玩到第二关，补内容就是白干。

**怎么做**：

```bash
node tools/share-online.js --map=sichuan     # 打印一个 https 公网链接
```

**要问的三个问题**（不能问"你觉得怎么样"）：

1. 第一关有没有卡住？哪里拖不进去？
2. 拼对之后那个介绍，你会看吗？
3. 玩完一关，你还想继续点下一关吗？

分别对应：**能不能玩 → 内容要不要 → 玩法留不留人**。

**验证之后的岔路口**：拿到反馈后要选一条 ——
**① 继续把产品做实**（补内容、修 bug）；**② 收尾成作品集**（写文档、写博客、停止加功能）。
这两条路对"接下来三个月"的答案是相反的。

详细话术与坑见 `README-如何发给同学.md`。

### 路线 B · 内容收尾（脚本活，不依赖反馈）

按缺口大小排：四川剩 88 条 → 河北 178 → 河南 173 → 山东 152 …

```bash
node tools/todo-report.js --map=<市>          # 看这个市缺哪个字段
```

**⚠ 抓取限流（实测过，务必遵守）**：
- 抓取必须**串行**，每批 3~5 个、间隔 ≥5 s、批之间 sleep 25 s
- 被限流**不要重试硬撞**（等于加码）；等 10~30 分钟，或 `--delay=0` 走缓存
- 缓存 `.cache/facts/`；`--delay=0` 全量重抽通常 <1 秒
- `facts-batch` 支持按 adcode 增量合并；`--fresh` 才只保留本次

---

## 4. 只读这几个文件（其余别读，省 token）

| 文件 | 什么时候读 |
| --- | --- |
| `HANDOVER.md`（本文件） | 开工前，只读这一份就够 |
| `PROJECT_INTRO.md` | 需要理解架构/设计决策时 |
| `CHANGELOG.md` | 想知道"上一轮改了什么、还欠什么人工确认" |
| `docs/项目现状简报（给外部AI）.md` | 要给别的 AI 讲清现状时（自包含） |
| SOP `坑 #39~#44` | 碰到"数据没落进产物 / 产物校验 / 窄屏溢出 / 清单漏项"这类问题时 |

**不要通读**：`js/maps/**/*.geo.js`（单行 100KB+）、`docs/资料缺口清单.md`（232 KB）。

---

## 5. 验证过的"正确姿势"（照做能省一半 token）

1. **外部契约先探针再写码**：文档会滞后，接口行为以实测为准
2. **能离线验证的先测透**：纯计算写成单测，不依赖网络
3. **小样本试水再放量**：先 2 张地图，跑测试 + 肉眼比对，再铺开
4. **数据不变量前移成断言**：踩过的坑立刻变成测试的一项
5. **每阶段一个 commit**：回滚粒度 = 阶段粒度
6. **改代码的脚本每步都要断言**：python 批量替换**静默失败**过两次
7. **等结果、不等时间**：测试里凡是要等副作用，就轮询它出现
8. **日志不是证据，产物才是证据**：断言要落在产物上（坑 #39）
9. **不要维护第二份真相**：能推导就不要手写清单（坑 #44）
10. **让测试说出"是谁"**：断言不只报"错了"，还要报"哪里错了、是谁"（坑 #43）

---

## 6. 常用命令速查

```bash
# —— 自举与测试 ——
node tools/status.js                                    # 现状一览
node tools/e2e-test.js --only-suite=offline 2>&1 | tail -14   # 秒级自检（2202）
node tools/e2e-test.js 2>&1 | tail -24                  # 全量（17185，约 10 分钟）
node tools/e2e-test.js --only-suite=modes 2>&1 | tail -6       # 玩法模式套件
node tools/e2e-test.js --only-maps=china,chengdu --only-suite=smoke   # 单张排查

# —— 内容流水线 ——
node tools/status.js / todo-report.js                   # 缺口
node tools/facts-batch.js --map=<市> --delay=1800 --prompt
node tools/facts-verify.js --map=<市> --in=out/verify-<市>.json --apply
node tools/area-from-geo.js --only=<id> [--write]       # 从官方边界几何算面积
node tools/soften-placeholders.js                       # 占位文案统一口径

# —— 地图接入 ——
node tools/batch-add-maps.js --parent=<省 adcode>        # 批量接入一个省
node tools/add-map.js --adcode=<6位> --name=<slug> --parent=<父id>
node tools/mca-check.js --refresh --write-tree          # 拉民政部官方区划树（关卡分类用）
node tools/regroup-levels.js [--write]                  # 重排关卡（会自动跳过手写关卡）
node tools/build-registry.js                            # 重新生成登记册

# —— 打包与部署 ——
node tools/deploy-pack.js --province=sichuan            # 裁剪部署包（81 文件，<1000 可直接拖拽）
node tools/bundle.js --province=sichuan                 # 单文件离线包（1.3MB，发文件用）
node tools/bundle.js --all                              # 全国单文件（18.5MB）
npx wrangler@latest pages deploy deploy/ --project-name=<项目名>

# —— 让别人真的玩到 ——
node tools/share-online.js --map=sichuan                # 临时公网链接（手机/微信都能开）
node tools/serve.js --map=sichuan                       # 局域网（同一 WiFi）
node tools/shot.js --map=china --level=2 --out=/tmp/x.png   # 截图

# —— 内容生成（省级文案/关卡）——
node tools/fill-china-provinces.js [--write]            # 中国图 34 省文案 + 7 关分区
node tools/test-china-provinces.js                      # 中国图专项校验（41 项）
```

---

## 7. 红线（每次都要遵守）

| # | 红线 | 怎么算违反 |
| --- | --- | --- |
| 1 | **地理合规** | 改了任何边界坐标；动了审图号声明 / 南海诸岛及海上界线 / 台湾省 / 港澳特别行政区 / 藏南阿克赛钦 |
| 2 | **不编造事实** | 写了查不到出处的数字/年份/地名。查不到就留占位「📖 资料收录中，欢迎参与共建」 |
| 3 | **不改测试断言来凑通过** | 把红的断言改绿，而不是修代码 |
| 4 | **纯前端零依赖** | 引入框架 / npm 运行时依赖 / 后端 / WebSocket / 账号 / 云端存储；file:// 双击打不开 |
| 5 | **engine.js 只认通用配置** | 往引擎里塞具体地图数据，或塞"模式分支"（模式逻辑属于 `js/modes.js`） |
| 6 | **数据源只用天地图官方** | 用了 `--source=tianditu`（已废弃）或别的来源当边界数据 |

---

## 8. 已知的数据源限制（不是 bug）

- **澳门**：官方区划数据里没有它的下级 → 按规则**不单独建地图**，它是中国图里的一块
- **东莞/中山/儋州/嘉峪关 + 甘肃 3 个保护区**：同上，没有下级，是上级地图的碎片
- **`*.pages.dev` 在国内不稳**：Cloudflare 在中国大陆没有节点，有被墙报告

---

## 9. 交接检查清单（新对话开工前跑一遍）

```bash
git log --oneline -1                                     # 确认在 v1.2.0
git status --short                                       # 应当干净
node tools/status.js                                     # 现状
node tools/e2e-test.js --only-suite=offline 2>&1 | tail -14   # 2202 全绿
```

全绿就说明环境没坏，可以直接开工。
