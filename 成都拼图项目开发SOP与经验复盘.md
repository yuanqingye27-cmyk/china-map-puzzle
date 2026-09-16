# 地图拼图项目开发 SOP 与经验复盘

> 项目：地图拼图（用交互式拼图讲解城市的县级行政区；当前内置成都 20 个区县）
> 形态：零依赖纯前端单页，双击 `index.html` 即可运行
> 架构：**通用引擎 `MapPuzzleEngine` + 城市配置** —— 加一个新城市只需写一份 config，不动引擎
> 本文用途：记录架构决策、踩坑过程、解决方法，以及下次做同类项目可复用的流程

---

## 目录

- [一、项目概况](#一项目概况)
- [二、开发历程](#二开发历程)
- [三、最终架构方案](#三最终架构方案)
- [四、踩坑全记录](#四踩坑全记录)
- [五、开发 SOP](#五开发-sop)
- [六、文件目录结构](#六文件目录结构)
- [七、已知限制](#七已知限制)
- [八、几条最值钱的经验](#八几条最值钱的经验)

---

## 一、项目概况

| 项 | 值 |
| --- | --- |
| 目标 | 用拼图游戏讲解城市的县级行政区；已抽成可复用引擎，支持多城市 |
| 技术栈 | 原生 HTML / CSS / JavaScript，**无任何依赖、无任何外链** |
| 数据 | 阿里云 DataV.GeoAtlas 的成都 GeoJSON（20 个区县、6279 个顶点，`MultiPolygon`） |
| 运行方式 | 双击 `index.html`（`file://`），无需构建、无需服务器 |
| 代码规模 | `engine.js` 1554 行（通用逻辑）、`cities/chengdu.js` 96 行（城市配置）、`game.js` 34 行（启动器）、`style.css` 1566 行、`index.html` 411 行 |
| 总体积 | 1.1 MB（其中 648 KB 是 README 的 5 张配图） |
| 测试 | **166 项端到端断言**（89 城市回归 + 77 引擎功能）+ 1 项 CSS 静态检查，全部通过 |

**为什么坚持零依赖**：这是一份"送给别人也能直接打开"的小作品。任何 `npm install`、CDN、构建步骤都会成为分享时的摩擦点。事后看这个决定是正确的 —— 它倒逼出了几个有意思的实现（手写墨卡托、内联数据、自己搭测试），也避开了所有网络相关的坑。

---

## 二、开发历程

整个过程分了 6 个阶段，中间穿插了 3 轮独立的功能追加。

### 阶段 0 · 需求确认（没有直接动手）

原始需求里混了一句"比如快速排序或 TCP 三次握手"，明显是模板残留，与成都地图无关。没有直接猜测，而是**先用三个问题把关键分歧点问清楚**：

1. 玩法：拖拽 / 点击 / 两者都要 → 选了**拖拽**
2. 难度：20 个一次上 / 分关卡 → 选了**分关卡**（中心城区 / 近郊 / 远郊）
3. 拼对后弹不弹介绍 → 选了**要**

**经验**：需求里出现"和主题无关的示例"时，先质疑再动手，比做完了返工便宜得多。

### 阶段 1 · 核心实现

- 拉取并精简 GeoJSON → 内联成 `js/map-data.js`
- 手写墨卡托投影 + path/bbox/质心计算（`js/geomap.js`）
- 关卡系统、拖拽、落点判定、信息卡（`js/game.js`）
- 深色主题样式（`css/style.css`）
- **搭起测试体系**（这一步的价值在后面反复体现）

### 阶段 2 · 方向修复（用户报的第一个 bug）

用户指出"地图方向是反的"。我一开始的注释里信誓旦旦写着"方向正确"，用数据一验 —— 用户是对的，整张图南北颠倒。详见[坑 #5](#坑-5地图南北颠倒)。

### 阶段 3 · 视觉升级

- 手绘 SVG 图案库：熊猫、竹子、银杏、盖碗茶、川剧脸谱 + 6 个功能图标
- 配色从"深墨蓝"改为"青绿竹韵"，颜色收口成**通道变量**
- 屏幕适配（这一轮踩了 3 个布局坑）

### 阶段 4 · 三套主题 + 脸谱重设计

- 青绿竹韵 / 银杏暖秋 / 蜀锦朱砂
- 川剧脸谱重画（第一版太"线描"，不像脸谱）
- 顺手发现"逐关解锁"从未生效（[坑 #13](#坑-13numbernull-等于-0-导致全部解锁)）

### 阶段 5 · 开场动画 + 结算画面

- 开场动画：五个成都元素依次弹入
- 结算画面：星级评价 + 数字滚动 + 区县印记

### 阶段 6 · 工程化收尾

- 进度持久化、音效、无障碍、移动端性能降级
- 发现并修复最隐蔽的一个 bug：横向溢出（[坑 #12](#坑-12min-width-auto-撑破容器移动端横向溢出的真凶)）

### 阶段 7 · 引擎化重构（支持多城市）

四步走，每步都跑测试、每步都停下来验收：

1. **抽出城市配置**（`js/cities/chengdu.js`）：把主色调 `LEVEL_HUE`、存储 key、画布/碎片尺寸、文案收进一个 `CONFIG` 对象 —— 纯新增，零行为变化
2. **引擎参数化**：`game.js` 里的硬编码常量改为从 `CONFIG` 读，缺项一律有默认值兜底
3. **拆出 `js/engine.js`**：主体改名为 `MapPuzzleEngine.create(CONFIG)`（`git mv` 保历史、正文逐行不动，只改首尾包装），`game.js` 缩成 34 行启动器
4. **双测试体系**：新增假数据 fixture（3 个虚构区县）+ 瘦宿主页 + 引擎功能套件，驱动改成一次跑两套

**这一步的意外收获**：假数据一上来就把引擎的**输入契约太窄**逼了出来 —— 几何层只认 `MultiPolygon`，喂标准 `Polygon` 直接抛错（见[坑 #22](#坑-22几何层只认-multipolygonpolygon-直接抛错)）。

---

## 三、最终架构方案

### 3.1 分层

```
index.html
├── <svg class="svg-sprite">      图案库：12 个 <symbol> 定义一次
├── 页面结构（顶栏 / 地图板 / 托盘 / 侧栏 / 弹窗 / 开场层）
└── <script> 顺序加载 6 个文件

css/style.css
├── :root 设计令牌（通道变量）
├── 两套主题覆盖（data-theme）
├── 组件样式
└── 5 个媒体查询断点

【数据层】与引擎无关的原始数据，换城市就换这几个文件
js/map-data.js         成都 GeoJSON（构建产物，内联）
js/districts.js        20 个区县的资料卡 + 关卡设定

【配置层】一座城市 = 一份配置：把数据 + 配色 + 存储 key + 文案组装起来
js/cities/chengdu.js   window.MAP_PUZZLE_CONFIG

【引擎层】不含任何城市数据，只认传进来的 CONFIG
js/geomap.js           投影与几何：经纬度 → path / bbox / 质心（Polygon / MultiPolygon 都吃）
js/engine.js           MapPuzzleEngine：凹槽 / 碎片 / 拖拽 / 落点判定 / 存档 / 通关

【启动层】
js/game.js             34 行：把配置交给引擎并 start()
```

### 3.2 六个关键设计决策

#### ① 数据内联成 `.js`，不用 `.json`

`file://` 下 `fetch` 本地 JSON 会被 CORS 拦死，但 `<script>` 标签不受影响。所以构建脚本把 GeoJSON 处理成 `window.CHENGDU_GEO = {...}`。**这是"双击即玩"能成立的前提。**

#### ② 手写墨卡托，不引 d3

用到的地理计算只有"经纬度 → 平面坐标"一件事，20 行够了：

```js
function project(lon, lat) {
  return [lon * DEG, -Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2))];
}
```

**那个负号是整个项目的命门**，详见[坑 #5](#坑-5地图南北颠倒)。

#### ③ 碎片和地图共用同一份 path

碎片 `<svg>` 的 `viewBox` 直接设为该区县的 `bbox`：

```html
<svg viewBox="120 340 180 150"><path d="（全局坐标的 path）"/></svg>
```

好处是**落位动画变得极其简单**：幽灵层从托盘尺寸 `scale` 到地图上的真实尺寸时，因为两者共用同一份 path 和同一个 bbox，缩放后必然严丝合缝地重合 —— 看起来就是碎片"嵌"了进去。

#### ④ 拖拽用 Pointer Events，不用 Mouse/Touch 双份

单套 `pointerdown/move/up` 同时覆盖鼠标、触屏、手写笔。配合 `.piece { touch-action: none }` 阻止移动端滚动。**这一条让"移动端适配"从"需要重构"变成了"只需验证"。**

#### ⑤ 落点判定分两层

```js
// 第一层：精确 —— 点是否落在凹槽多边形内部
slot.path.isPointInFill(p)
// 第二层：容错 —— 离最近的凹槽中心够近吗
dist < clamp(min(w,h) * 0.85, 34, 110)
```

坐标换算走 `getScreenCTM().inverse()`，因此**地图 viewBox 怎么变都不影响判定**（这一条支撑了后面的"视图聚焦"）。

#### ⑥ 颜色用通道变量

```css
--c-jade: 63 201 156;              /* 定义：R G B 三段 */
color: rgb(var(--c-jade) / 0.14);  /* 使用：透明度在调用处决定 */
```

全站 40+ 处颜色引用都走变量，换主题只需给 `<html>` 换个 `data-theme`。**代价是变量名成了"角色代号"**（`--c-jade` 在暖秋主题里装的是金色），代码里已注明。

### 3.3 自建测试体系（这是最值得保留的资产）

因为**没有 npm、不装 puppeteer**，测试是这样搭起来的：

```
tools/e2e-test.js        Node 侧：起 HTTP 服务 → 按套件启动 headless Chrome → 收结果 → 汇总
      ↓ 依次打开两个载体页（每套独立 Chrome、独立 user-data-dir）
tools/selftest.html      【城市回归】装 index.html 进 iframe，用成都真实数据 + 真实 DOM 断言
tools/engine-test.html   【引擎功能】装 engine-host.html 进 iframe，只喂虚构 tiny-city 数据
      ↓ iframe 内
index.html / engine-host.html      被测页面
      ↓ 结果用隐表单 POST 回传（绕开 CORS 和 PNA）
tools/e2e-test.js        收到结果 → 打印 / 设置退出码
```

两套测试的分工（重构后新增的一层保险）：

| 套件 | 被测页 | 数据 | 管什么 |
| --- | --- | --- | --- |
| 城市回归 · 89 项 | `index.html` | 成都真实 GeoJSON | UI / 动画 / 布局 / 真实数据正确性（含 adcode 没写反） |
| 引擎功能 · 77 项 | `engine-host.html` | 虚构 tiny-city（3 个假区县） | 放置判定、错误拒绝、解锁、持久化、配置驱动 —— **与具体城市无关** |

**为什么要分成两套**：引擎改动后，用假数据那一套就能验证通用逻辑，不必依赖成都地图的细节；而 UI 回归由城市那一套守着，两边互不干扰。实测收益见[坑 #22](#坑-22几何层只认-multipolygonpolygon-直接抛错)：假数据第一次运行就逮住了真实数据掩盖了一个项目周期的兼容问题。

**为什么不用 CDP**：headless Chrome 153 在 `Runtime.enable` 时直接 SIGTRAP 崩溃，试了 `--headless=old`、`--no-sandbox` 各种组合都不行，果断放弃（详见[坑 #2](#坑-2headless-chrome-在-runtimeenable-时崩溃)）。

**这个体系的价值在后续每一轮改动里都体现了** —— 它逮住了 4 个我自己没意识到的 bug（含两个静默错误）。

### 3.4 数据 / 配置 / 引擎 三层解耦

重构的核心一句话：**引擎不认识任何一个具体城市。**

```
js/cities/<city>.js  ──┐
  geo        地图数据   │  window.MAP_PUZZLE_CONFIG
  districts  区县资料   │  （一个纯数据对象，没有任何行为）
  levels     关卡设定   │
  palette    配色       │
  storage    存储 key   │
  texts      文案     ──┘
                        ↓
              MapPuzzleEngine.create(CONFIG).start()
                        ↓
  引擎负责：底图 / 凹槽 / 碎片 / 拖拽 / 落点判定 / 提示 / 存档 / 通关
```

`CONFIG` 字段表 —— **只有 `geo` 和 `levels` 是必需的**，其余省略时走引擎内置默认值：

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `geo` | ✔ | GeoJSON FeatureCollection；每个 feature 需带 `properties.adcode` / `properties.name`。`Polygon` 与 `MultiPolygon` **两种写法都支持** |
| `levels` | ✔ | `[{ id, name, short, blurb, adcodes, hue? }]`；`hue` 可选，作为该关主色相 |
| `districts` | | `adcode → { area, landmark, tagline, funFact }`，拼对后信息卡的内容 |
| `palette` | | `hueByLevel` / `fallbackHue` / `saturation` / `lightBase` / `lightStep` / `lightSpan` / `hueSpread` —— **城市主色调就在这里** |
| `map` | | `{ width, padding }` 画布逻辑尺寸 |
| `piece` | | `{ max, minSide, pieces: [[视口宽度上限, 最大边], …] }` 碎片尺寸档位 |
| `storage` | | `{ save, theme, sound, intro, saveVersion }` ① |
| `themes` | | `{ list, fallback }`，`list` 里是 CSS 里存在的 `data-theme` 值 |
| `texts` | | `{ cityName, districtCount, missingDataHint }` |

① 多城市**必须**各用一套 `storage` key，否则两个城市会互相覆盖存档。

引擎的对外接口只有两个（刻意收得很窄，免得宿主页面改坏内部状态）：

```js
const engine = MapPuzzleEngine.create(CONFIG);
engine.start();      // 数据与 DOM 就绪后启动（引擎不自动启动，何时启动由宿主页决定）
engine.getState();   // 运行状态快照：levelIndex / placed / tries / hints / elapsed /
                     // solved / unlocked / finishedLevels / slotsLeft / piecesLeft …
```

**为什么用工厂函数而不是 class**：内部 `state` / `drag` / `el` / `shapes` 全是 `create()` 的闭包变量，天然做到"每个实例一套状态"，同时省掉了把上百处引用改成 `this.xxx` 的机械改动 —— **改动面越小，越不容易在重构里引入新 bug**。

**为什么引擎不自动启动**：`start()` 由宿主页显式调用，于是"同一页创建多个实例""测试宿主页用假数据启动"都变得自然，而不需要给引擎加一堆开关。

---

## 四、踩坑全记录

按"坑的类型"分组。每条都附上**现象 → 根因 → 修法 → 教训**。

### 4.1 坐标系与几何

#### 坑 #5：地图南北颠倒

**现象**：整张成都上下颠倒。彭州（最北）画在蒲江（最南）下面。

**根因**：墨卡托原始公式 `y = ln(tan(π/4 + φ/2))` 属于**数学坐标系** —— 那里 y 轴朝上，所以纬度越高 y 越大 = 越靠北，公式本身没错。但 **SVG 的 y 轴朝下**，直接把这个 y 当 SVG 坐标用，南北就翻了。

**更该警惕的是**：我一开始的注释把它**反着写成了"正确"**：

```js
// ✘ 错的注释，而且它让当时的我停止了怀疑
// 注意 y 轴方向：纬度越高 y 越小，正好和 SVG 的 y 轴向下一致，
// 所以成都北边的彭州、都江堰会自动画在画布上方，不需要翻转。
```

**修法**：取负号。

```js
return [lon * DEG, -Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2))];
```

**验证方法**（这个方法论要记住）：不要只看"形状像不像成都"，要**拿真实地理常识去断言**：

```
画布从上到下应该是：彭州(31.14°N) → 都江堰 → 市中心 → 简阳 → 蒲江(30.22°N)
```

**教训**：
1. **注释写错比代码写错更危险** —— 它让后来的人（包括自己）停止怀疑
2. 只验"bbox 不越界""面积排名合理"是不够的，**方位也要断言**
3. 修完立刻加了 3 条断言锁死（投影层 2 条 + 渲染层 1 条），防止回归

#### 坑 #11：极扁的碎片被"放大"后被撑破

**现象**：手机端托盘里的碎片溢出容器。

**根因**：碎片尺寸计算里有一段"短边不足 15px 就按短边撑开"的逻辑：

```js
// ✘ 旧逻辑：短边太细时无脑放大，长边也跟着冲出去了
let k = max / Math.max(w, h);
if (Math.min(w, h) * k < PIECE_MIN_SIDE) k = PIECE_MIN_SIDE / Math.min(w, h);
```

对于一个 5:1 的长条碎片，放大后长边能到 75px，远超 `max`（40px）。

**修法**：同时卡住长边上限，两边取更小的那个 k。

```js
k = Math.min(PIECE_MIN_SIDE / short, (max * 1.15) / long);
```

**教训**：等比缩放时，"保证短边不小于 X"和"保证长边不超过 Y"是两个会打架的约束，必须同时满足。

#### 坑 #22：几何层只认 MultiPolygon，Polygon 直接抛错

**现象**：引擎功能测试第一次跑，城市回归 89 项全绿，但假数据宿主页的**底图、凹槽、碎片全是 0**，进度停在 `0/0`；页面正文完好，**控制台也没有任何提示**（数据缺失的兜底提示没触发，说明 `init()` 是中途抛异常，而不是走了兜底分支）。

**排查**（比读代码猜快得多的一步）：把 `start()` 再调一次并用 `try/catch` 抓住异常现场 ——

```js
try { W.__ENGINE__.start(); } catch (e) { info.err = e.message; }
// → number 100 is not iterable (cannot read property Symbol(Symbol.iterator))
//    at js/geomap.js:94
```

**根因**：`buildGeoMap` 直接按 `coordinates.map(多边形).map(环).map(点)` 三层取点，等于**隐含要求 `MultiPolygon`**。真实成都数据恰好就是 `MultiPolygon`（`tools/build-data.js` 也统一转成它），所以这个问题被藏了整整一个项目周期。而标准 GeoJSON 的 `Polygon` 只有两层，喂进来时"环"被当成"点"去解构，当场炸掉：

```
MultiPolygon: coordinates = [多边形][环][点]   ← DataV 导出的成都数据
Polygon:      coordinates = [环][点]           ← 手写数据 / 别家数据源常见
```

**修法**（只改引擎，不动测试断言）：进点之前把两种写法统一补齐成同一形状。

```js
const geom = feature.geometry;
const rawPolygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
```

fixture 顺势改成**两种写法混用**（甲区 `Polygon`、乙区/丙县 `MultiPolygon`），并加了一条断言把这条兼容性钉死。

**验证方式**：用 `git show HEAD:js/geomap.js` 的旧实现和新实现分别构建成都全图，深比对结果 —— **76819 字节输出完全一致**（投影 / 路径 / bbox / 质心一个数字没变），确认修复对老数据零影响。

**教训**：
1. **"我用得对"不等于"它能通用"** —— 真实数据恰好落在某一个分支上，另一个分支的 bug 就可能潜伏很久；做通用化时，要主动去问"还有哪种写法/哪种输入"
2. **换一份极端数据当探针，是性价比最高的通用性测试**：喂 3 个假区县，比再通读一遍 1500 行代码更快命中问题
3. **把输入契约写进文档**：引擎到底吃哪种 GeoJSON 写法，不能在实现里"隐式约定"（现已写进 3.4 的字段表）
4. 排查顺序仍然是"抓现场数据 > 读代码猜"：`try/catch` 拿到异常行号，比通读 `buildGeoMap` 快得多

### 4.2 布局与响应式

#### 坑 #12：min-width auto 撑破容器（移动端横向溢出的真凶）

**现象**：390px 视口下，顶栏右侧的音效按钮和主题色点被推出屏幕。

**排查过程**（曲折，值得完整记录）：

| 尝试 | 结果 |
| --- | --- |
| 给 `body` 加 `overflow-x: hidden` | 溢出被裁，但控件还是在外 |
| 给 `.tray` 换 grid 布局 | 托盘问题缓解，顶栏依旧 |
| 给 `.board-column` / `.tray-panel` / `.stage` 逐层加 `min-width: 0` | **完全没变化** |
| **把每一层的实测宽度打出来** | **一击命中** |

实测数据（这是转折点）：

```
.app               w390   ← 容器看着完全正常
.topbar            w457   ✗ 子元素撑破了它
.stage             w457   ✗
.board-column      w457   ✗
body.scrollWidth   468   ✗ 整页溢出
```

**根因**：grid / flex 子项的默认值是 `min-width: auto`，含义是"**不小于内容的最小宽度**"。内容一宽，子项就撑破列 —— 而**容器本身宽度不变**，所以从外面完全看不出来。

**修法**：统一把子项的 `min-width` 归零。

```css
.app > *,
.stage > *,
.board-column > *,
.sidebar > * { min-width: 0; }
```

修完 `body.scrollWidth` 从 **468 → 390**（正好等于视口宽）。

**还剩一处**：`.topbar-right` 仍是 457。因为它内部三个东西（关卡标签 + 音效 + 主题）总宽刚好卡在临界，需要另外收尺寸：

```css
@media (max-width: 620px) {
  .topbar-right { width: 100%; max-width: 100%; overflow: hidden; gap: 7px; }
  .level-tabs { flex: 1 1 auto; min-width: 0; }
  .sound-btn { width: 31px; height: 31px; }
  .theme-dot { width: 15px; height: 15px; }
}
```

**教训**：
1. **"容器宽度正常"不等于"没溢出"** —— 一定要量子元素和 `scrollWidth`
2. 这类问题靠盯 CSS 是找不到的，**必须打印实测数据**
3. 防御性写法：给所有 grid/flex 子项加 `min-width: 0` 应该成为肌肉记忆
4. 最终加了断言守着：`body.scrollWidth ≤ window.innerWidth`

#### 坑 #9：`height:100vh + overflow:hidden` 把底部内容永久裁掉

**现象**：矮屏笔记本上，底部的碎片托盘和操作按钮被裁，而且**滚不动**。

**根因**：桌面端锁一屏的写法过于刚硬。内容一旦超过视口高度，多出来的部分既看不到也够不着。

**修法**：各区块的 `min-height` 改用 `min(400px, 46vh)` 跟着视口收缩，`body` 保留 `overflow-y: auto` 兜底。

#### 坑 #10：`min-height:100vh` 又把信息卡撑到 930px

**现象**：修完坑 #9 后，"点击模式"的测试挂了 —— 点击坐标 y=1178，而视口只有 1000px。

**根因**：我把 `.app` 从 `height: 100vh` 改成 `min-height: 100vh`。高度不再固定后，侧栏里 `.info-card` 的 `flex: 1` 被内容**撑到了 930px**，整页变成 1255px，托盘被顶出视口。

**修法**：`.app` 必须锁死高度，但要配合各区块的 `vh` 自适应：

```css
@media (min-width: 1081px) {
  body { overflow-x: hidden; overflow-y: auto; }  /* 兜底 */
  .app { height: 100vh; }                          /* 必须固定 */
}
```

**教训**：**坑 #9 和 #10 是一对**。第一次修方向对了一半（要允许滚动），但错在把 `.app` 的高度也放开了。**"允许滚动"和"放开高度"是两件事**。

#### 坑 #3：`file://` 下 `fetch` 本地 JSON 被 CORS 拦

**现象**：双击 `index.html` 后地图不显示。

**根因**：`file://` 协议下，浏览器把每个文件视为独立 origin，`fetch('data.json')` 直接被拦。

**修法**：构建脚本把数据处理成 `window.CHENGDU_GEO = {...}`，用 `<script>` 标签加载（不受 CORS 限制）。

### 4.3 CSS 与 SVG 的边界

#### 坑 #8：通道变量当完整颜色用（"银杏金不金"）

**现象**：图案预览页里"银杏金"那一列显示的是黑色图案。

**根因**：项目里有两套颜色变量，我混用了：

```css
--c-gold: 224 169 74;   /* 通道值：只能写在 rgb(... / α) 里 */
--amber:  #e0a94a;      /* 完整颜色：可以直接赋值给 color */

/* ✘ 无效声明，浏览器静默忽略 → 回退成继承色 */
.box.gold { color: var(--c-gold); }
```

**修法**：`color: rgb(var(--c-gold))`。并全局排查了同类错误（`game.js` 的图例用的是 `--amber`，本来就对）。

**教训**：通道变量和完整颜色变量**必须靠命名区分**（加 `c-` 前缀），否则迟早混用。而且这类错误**不报错**，只是静默失效 —— 必须靠肉眼比对或截图发现。

#### 坑 #14：`<use>` 引用的是 shadow tree，CSS 选择器进不去

**现象**：结算画面的"空星"几乎看不见，想改成空心星却改不动。

```css
/* ✘ 无效：选不中 shadow tree 里的 path */
.modal-star.is-empty path { fill: none; }
```

**根因**：`<use href="#id">` 引用的内容在 shadow tree 里，外部 CSS 选择器无法命中。

**修法**：**删掉 symbol 上的 `fill` 属性，改用继承**——继承能穿透 shadow boundary，选择器不能。

```html
<!-- symbol 里不写 fill/stroke -->
<symbol id="i-star" viewBox="0 0 24 24"><path d="..."/></symbol>
```
```css
.modal-star          { fill: currentColor; stroke: none; }   /* 实心 */
.modal-star.is-empty { fill: none; stroke: currentColor; }   /* 空心 */
```

**同一个原理的另一处应用**：熊猫的双色部件之所以要拆成 `--panda-ink` / `--panda-paper` 两个变量，也是因为外部没法用选择器改 shadow tree 内部的元素。

**教训**：用 `<symbol>` + `<use>` 做图案库时，**颜色一律走"继承"（`currentColor` / CSS 变量），不要走"选择器"**。

#### 坑 #4：`rgba()` 在 SVG 呈现属性里的行为

（次要）SVG 的 `fill` / `stroke` 作为**呈现属性**时优先级低于 CSS 规则。这既是坑也是解法 —— 上面那条正好利用它。

### 4.4 数据与状态

#### 坑 #1：崇州 / 邛崃的 adcode 写反了

**现象**：无。**这才是最可怕的** —— 玩家拼对了，信息卡却显示另一个区县的介绍。

**根因**：凭记忆写 `districts.js`，把两个相邻区县的行政区划代码弄反了：

```
正确：邛崃 510183、崇州 510184
我写的：崇州 510183、邛崃 510184   ✘
```

**发现方式**：派了一个后台任务去核实 20 个区县的资料（面积、地标、特产），交叉比对时发现的。

**修法**：改正，并加断言：

```js
check('崇州 510184 / 邛崃 510183 没有写反',
  nameMap.get(510184) === '崇州市' && nameMap.get(510183) === '邛崃市');
```

**教训**：**这类"静默错误"（不报错、但结果全错）只有靠外部数据交叉验证才能发现。** 凭记忆写的数据，必须有独立的核实环节。

#### 坑 #13：Number(null) 等于 0 导致全部解锁

**现象**：改徽标时发现"锁图标根本不显示"，一查 DOM 才知道三关一直是全解锁的 —— **用户明确要的"逐关解锁成就感"从未生效**。

**根因**：

```js
// ✘ 不带参数时 get() 返回 null，而 Number(null) === 0
// → 被误判成 "?level=0" → state.unlocked = LEVELS.length
const wanted = Number(new URLSearchParams(location.search).get('level'));
```

**修法**：

```js
const rawLevel = new URLSearchParams(location.search).get('level');
const wanted = rawLevel === null || rawLevel === '' ? NaN : Number(rawLevel);
```

**副作用**：修好后，测试里"跳到第三关"的用例挂了 —— 因为它原本是靠这个 bug 走的后门。改成**真的把第二关拼完**再进第三关，反而验证了完整的解锁链路。

**教训**：`Number()` 对 `null` / `''` / `[]` 的隐式转换是经典陷阱。**URL 参数解析一定要先判断"存在性"再判断"值"。**

#### 坑 #6：`statHints` / `statTries` 从来没被更新

**现象**：提示按钮点了没反应（数字不变）。

**根因**：`updateStats()` 里只更新了进度，漏了这两个计数。

**修法**：补上。

**教训**：这类"忘了接线"的 bug 靠人工点一遍容易漏，**用断言覆盖每个 UI 数字**更可靠。

#### 坑 #7：`click` 事件与 `pointerup` 撞车

**现象**：点击碎片无法选中（状态被切换了两次，等于没选）。

**根因**：为了支持键盘，我监听了 `click`；而鼠标点击时 `pointerup` 和 `click` **都会触发**，于是 `toggleSelect` 被调了两次。

**第一次修法**（不稳）：用 `ev.detail === 0` 区分"键盘触发的 click"。这个判据不可靠。

**最终修法**：键盘直接听 `keydown`，彻底避开与 pointer 事件的冲突。

```js
btn.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleSelect(adcode); }
});
```

**教训**：同一个用户操作能用**两套事件路径**触发时（鼠标走 pointer、键盘走 click），要么统一走一条路，要么用**互斥且可靠**的标志位区分。

### 4.5 测试与工具链

#### 坑 #2：headless Chrome 在 `Runtime.enable` 时崩溃

**现象**：想用 CDP（Chrome DevTools Protocol）驱动浏览器测试，WebSocket 连上了、`Browser.getVersion` 也返回了，但一调 `Runtime.enable` 就 `SIGTRAP` 崩溃。

**排查**：试了 5 组参数组合：

```
--headless                  → exit 133 (SIGTRAP)
--headless=new              → exit 133
--headless=old              → exit 133
--headless --disable-gpu    → exit 133
--headless --no-sandbox     → ✔ 正常，截图 436KB
```

**结论**：**这台机器的 Chrome sandbox 起不来**，必须 `--no-sandbox`。

**修法**：所有测试脚本都带 `--no-sandbox`，并在注释里写明原因（换机器可以去掉）。

**同时放弃了 CDP**，改用"页面自己跑测试 + 隐表单 POST 回传结果"。这个方案反而更简单、更稳，而且**零依赖**。

**教训**：调试协议跑不通时，**"让被测页面自己上报结果"是一条极好的退路**，比死磕协议划算得多。按红线"最多试 2 次"的原则，我在第 5 组参数上找到出路后就立刻转向了。

#### 坑 #15：测试断言写错（`.piece` 没过滤 `is-used`）

**现象**：断言"刷新后托盘里少了那一块"失败（实际 8，期望 7）。

**根因**：被拼上的碎片是加 `is-used` 类（`display:none`），**元素仍在 DOM 里**。`querySelectorAll('.piece').length` 把它们也算进去了。

**修法**：过滤掉。

**教训**：**断言本身也会写错。** 失败时先怀疑断言，再怀疑代码 —— 但一定要验证到底哪个错了，不能直接改断言让它变绿。

#### 坑 #16：动态创建的 iframe 在 `file://` 下被跨源拦

**现象**：想在测试里新建一个 390px 宽的 iframe 验证移动端 CSS，报 `SecurityError: Blocked a frame with origin "file://"`。

**根因**：`file://` 下每个文件是独立 origin。HTML 里**静态声明**的 iframe 有 `--allow-file-access-from-files` 罩着，**动态创建**的没有。

**修法**（按红线不纠缠）：把这项检查移到 **Node 侧做静态检查** —— 直接读 `style.css`，按大括号配平抠出媒体查询块，检查关键规则是否存在。

**教训**：浏览器里做不了的事，**挪到 Node 侧做静态分析**往往是更省事的选择。

#### 坑 #17：静态检查抠错了 CSS 块

**现象**：刚写的静态检查报"缺规则"，但规则明明在文件里。

**根因**：CSS 里有**两个** `@media (max-width: 620px)`（一个管布局、一个管性能降级），`indexOf` 只拿到第一个。

**修法**：遍历所有匹配块，拼接后再检查。

**教训**：**按关键字定位代码块时，要假设它可能出现多次。**

#### 坑 #18：开场覆盖层挡住所有点击，测试全挂

**现象**：加完开场动画后，"点击模式"测试又挂了。

**根因**：`.intro` 是 `position: fixed; inset: 0; z-index: 1200`，把所有点击都接走了，`elementFromPoint` 命中的是它而不是碎片。

**修法**：测试开头先验证开场动画存在，然后关掉它，再测后续。

**教训**：这是一个**好**的失败 —— 它反过来证明了开场动画确实生效。加全屏覆盖层时，要预料到它会打断所有基于坐标的测试。

### 4.6 视觉设计

#### 坑 #19：竹子初版画砸了

**现象**：第一版竹子看起来像藤蔓/含羞草 —— 竹竿太细、竹节几乎看不见、叶子太小太散。

**发现方式**：**做了个图案预览页，把每个图案放大到 128px 并排显示**。缩放后的截图里问题一览无余。

**修法**：竹竿加粗到 5.5、竹节用明显短横线、叶片加宽（宽 11~13）并加粗描边。

**二次踩坑**：加宽叶子后还是像羽毛 —— 因为叶片是**斜的**，垂直方向的宽度不等于垂直于叶轴的宽度。再调贝塞尔控制点才到位。

**教训**：**做 SVG 图案必须有一个"放大预览"的环节**。在 62px 的实际尺寸下，很多缺陷是看不出来的。

#### 坑 #20：脸谱第一版太"线描"

**现象**：画出来像一张对称面具，不像川剧脸谱。

**根因**：线宽只有 1.7~2.2、填充透明度 0.15~0.22 —— 那是在**描轮廓**，不是画脸谱。川剧脸谱的特征是**浓重的对称色块**。

**修法**：三处改动

1. 额心火焰纹改为**实心**（透明度 0.88）
2. 眉毛加粗到 **4.5**
3. 眼窝改为**粗描边椭圆 + 淡填充**，做出彩绘的体积感

**中间又踩一坑**：眉加粗后**和眼窝是分离的**，看着还是两条孤立弧线。把眉的末端从 y=21.5 **下压到 y=25**，让它接住眼窝上缘（y≈28），眉眼才连成一体。

**教训**：极简图形里，"元素之间的**连接关系**"比"单个元素画得多准"更决定观感。

#### 坑 #21：图案尺寸的适用边界

顺手量了一下脸谱的线宽：

```
54px 显示 → 实际线宽 0.81 ~ 3.04px   ✔ 清晰
15px 显示 → 实际线宽 0.23 ~ 0.84px   ✘ 糊成一团
```

**结论**：脸谱**只适合中大型展示（≥48px）**，不能当 15px 的小图标用。后续用它时守住这个下限。

---

## 五、开发 SOP

### 5.1 每次动手前的三步

1. **读相关文件**，理解现有结构和风格（不要凭印象改代码）
2. **用数据验证假设**（尤其是"我觉得这里是对的"这类判断）
3. **说明改哪里、为什么**，再动手

### 5.2 改动流程

```
改代码 → node --check 语法 → node tools/e2e-test.js（两套都要绿）→ 截图目视 → 汇报
```

**关键：改完必须跑测试。** 这个项目的 166 项断言逮住过多个我自己没意识到的 bug —— 包括两个静默错误，以及引擎化重构时的 GeoJSON 兼容问题。

### 5.3 遇到"看不到效果"时的排查顺序

```
1. 打印实测数据（宽度 / 坐标 / computedStyle）   ← 命中率最高
2. 查 DOM 实际结构（dump-dom）
3. 查控制台报错
4. 最后才怀疑 CSS 写法
```

坑 #12 就是典型：前三次都靠"改 CSS 试试"，全部无效；**打印数据一次命中**。

### 5.4 如何加一个新关卡

1. `js/districts.js` 的 `LEVELS` 里加一项（`id` / `name` / `short` / `blurb` / `adcodes`）
2. 配色二选一：在 `js/cities/chengdu.js` 的 `palette.hueByLevel` 里加一个色相，**或者**直接给这个关卡写 `hue: 200`（关卡自带的 `hue` 优先级更高）
3. 确认 `adcode` 在 `map-data.js` 里存在（跑测试会校验）
4. 若关卡数量变化，检查 `unlocked` 相关逻辑与测试断言

### 5.5 如何加一套新主题

1. `css/style.css` 的 `:root[data-theme='xxx']` 里覆盖颜色令牌（**只需覆盖颜色类，圆角/缓动沿用默认**）
2. `index.html` 的主题切换区加一个色点按钮
3. `js/cities/<city>.js` 的 `themes.list` 里加 id（还可以用 `themes.fallback` 指定默认主题）
4. 注意：暖色/红色在深底上**视觉亮度天然低于青色**，描边色需要比青绿主题提亮一档

### 5.6 如何加一个新图案

1. 在 `index.html` 的 `<svg class="svg-sprite">` 里加 `<symbol>`
2. **颜色走 `currentColor` 或 CSS 变量，不要在 symbol 里写死 fill**（否则外部改不动，见坑 #14）
3. 在 `tools/icon-preview.html` 里放大检查三种底色下的效果
4. 确认在目标显示尺寸下线宽够（可用 `线宽 × 显示尺寸 / viewBox 尺寸` 估算）

### 5.7 如何重新生成地图数据

```bash
curl -o /tmp/cd_full.json https://geo.datav.aliyun.com/areas_v3/bound/510100_full.json
node tools/build-data.js /tmp/cd_full.json
```

### 5.8 怎么跑测试

```bash
node tools/e2e-test.js
```

- 一次跑两套，末尾打汇总。正常输出是 **`合计：166 通过 / 0 失败`**（城市回归 89 + 引擎功能 77）
- 只想过其中一套：把另一套从 `tools/e2e-test.js` 顶部的 `SUITES` 数组里注掉即可
- 脚本里带的 `--no-sandbox` 是**这台机器必需的**（见坑 #2），换机器可以去掉
- 测试失败时会打印布局诊断（各层宽度、`elementFromPoint` 命中结果），便于快速定位
- 每套测试各起一个独立 Chrome（独立 `user-data-dir`），因此两边的 `localStorage` 互不可见 —— 引擎套件里"没有污染 `chengdu-*` 存档 key"那条断言就是这么成立的

### 5.9 如何加一个新城市（只写一份 config）

引擎不认识任何具体城市，所以**一行 `engine.js` 都不用改**：

1. **准备数据**：把该城市的 GeoJSON 处理成 `window.XXX_GEO = {...}`（可参考 `tools/build-data.js`；`Polygon` 和 `MultiPolygon` 引擎都吃）
2. **新建配置**：`js/cities/<city>.js`，照着 `js/cities/chengdu.js` 填 `id / name / geo / districts / levels / palette / storage / themes / texts`
3. **换两样东西**：`storage` 的 key（避免和别的城市互相覆盖存档）和 `palette`（这就是这个城市的主色调）
4. **接进页面**：按顺序加载 `数据 → 城市配置 → geomap.js → engine.js → game.js`，在 `game.js` 里把 `MAP_PUZZLE_CONFIG` 指向你要启动的那份配置
5. **跑测试**：`node tools/e2e-test.js`，确认城市回归那 89 项没被带坏
6. （可选）仿照 `tools/fixtures/tiny-city.js`，给这个城市也补一套 fixture 测试

**目前还没有的**：`?city=xxx` 这类多城市入口。本轮只做了引擎解耦，入口留到下一轮（见[已知限制](#七已知限制)）。

### 5.10 如何写一套 fixture 测试（新玩法）

假数据是**通用性的探针**：它跑得通，才说明引擎不是"只对成都有效"。

1. **写数据**：`tools/fixtures/<name>.js`，规模压到极小（这里就 3 个假区县 + 2 关），**并且刻意偏离真实配置** —— 不同色相/饱和度、不同默认主题、不同存储 key、不同城名。只有这样才能证明这些值真的"由外部传入"
2. **写宿主页**：`tools/engine-host.html`，**DOM 结构与 `index.html` 同构**（引擎按 id 缓存 DOM，CSS 布局依赖 `.app / .stage / .board-column / .board` 这套层级），然后三行启动：
   ```js
   window.__ENGINE__ = MapPuzzleEngine.create(window.TINY_CITY_CONFIG);
   window.__ENGINE__.start();
   ```
3. **写套件**：`tools/engine-test.html` —— 报告机制与 `check / section / drag / insidePointOf` 这套辅助函数和 `selftest.html` 同款，但**期望值全部由 fixture 反推**，断言里不出现任何真实城市的名词
4. **接进驱动**：在 `tools/e2e-test.js` 的 `SUITES` 数组里加一项 `{ name, page }`
5. **顺手把边界条件塞进 fixture**：凹多边形、两种 GeoJSON 写法、单块关卡…… 这些极端情况放在假数据里最合适（[坑 #22](#坑-22几何层只认-multipolygonpolygon-直接抛错)就是这么被逮住的）

---

## 六、文件目录结构

```
deepseekharness/
├── index.html                      411 行 · 页面结构 + 手绘图案库（12 个 <symbol>）
├── README.md                      · 项目说明文档
├── 成都拼图项目开发SOP与经验复盘.md   · 本文
│
├── css/
│   └── style.css                  1566 行 · 设计令牌 / 三套主题 / 全部动画
│
├── js/
│   ├── map-data.js                 · 成都 GeoJSON（构建产物，勿手改）
│   ├── districts.js               183 行 · 20 个区县资料 + 关卡设定
│   ├── geomap.js                  181 行 · 墨卡托投影 + path/bbox/质心（两种 GeoJSON 写法都吃）
│   ├── engine.js                 1554 行 · 通用引擎 MapPuzzleEngine（不含任何城市数据）
│   ├── game.js                     34 行 · 启动器：读配置 → 交给引擎 start()
│   └── cities/
│       └── chengdu.js              96 行 · 成都配置（数据 + 配色 + 存储 key + 文案）
│
├── tools/
│   ├── build-data.js               构建：GeoJSON → 内联 js
│   ├── e2e-test.js                230 行 · 测试驱动（跑两套 + CSS 静态检查 + 汇总）
│   ├── selftest.html              城市回归套件（89 项 · 成都真实数据 + UI/动画）
│   ├── engine-test.html           引擎功能套件（77 项 · 只用虚构数据）
│   ├── engine-host.html           引擎测试宿主页（与 index.html 同构的瘦页面）
│   ├── fixtures/
│   │   └── tiny-city.js           虚构测试城市（3 个假区县 + 2 关 + 自配色）
│   ├── icon-preview.html           手绘图案预览（需 http 打开）
│   └── districts-source.json       核实过的区县资料（数据存档）
│
└── docs/
    ├── level1.jpg                  第一关截图
    ├── level2.jpg                  第二关截图
    ├── intro.jpg                   开场动画截图
    ├── settle.jpg                  结算画面截图
    └── patterns.jpg                手绘图案总览
```

**加载顺序**（`index.html` 末尾，不可调换）：

```html
<script src="js/map-data.js"></script>       <!-- 先有数据 -->
<script src="js/districts.js"></script>      <!-- 再有区县资料与关卡 -->
<script src="js/cities/chengdu.js"></script> <!-- 组装成城市配置 -->
<script src="js/geomap.js"></script>         <!-- 投影与几何 -->
<script src="js/engine.js"></script>         <!-- 通用引擎 -->
<script src="js/game.js"></script>           <!-- 最后启动 -->
```

**运行方式**：

| 文件 | 打开方式 |
| --- | --- |
| `index.html` | **双击即可**（零依赖、无外链） |
| `tools/icon-preview.html` | 需 http（`python3 -m http.server`），`file://` 下会被同源策略拦 |
| `tools/selftest.html`、`tools/engine-test.html` | 由 `node tools/e2e-test.js` 自动驱动 |
| `tools/engine-host.html` | 被 `engine-test.html` 装进 iframe；也可以直接打开，看假数据的渲染效果 |

---

## 七、已知限制

1. **面积口径差异**：双流区 1067 km² 是含托管区口径（实际直管约 466）；简阳 2213.5 km² 含成都东部新区。已在 README 注明。
2. **脸谱不能小尺寸使用**：线宽限制，低于 48px 会糊（见坑 #21）。
3. **预览页依赖 http**：`file://` 下无法读取图案库，页面里已给出明确提示。
4. **测试依赖系统 Chrome**：硬编码了 macOS 的 Chrome 路径，换平台需调整 `tools/e2e-test.js` 里的 `CHROME` 常量。
5. **`--no-sandbox`**：当前机器的 Chrome sandbox 不可用，测试脚本必须带此参数。
6. **没有多城市入口**：引擎已完全解耦，但页面仍固定加载 `js/cities/chengdu.js`；`?city=xxx` 之类的入口留到下一轮。
7. **fixture 没覆盖 `palette.fallbackHue`**：只有"关卡既不自带 `hue`、`hueByLevel` 里也查不到"时才会走这条分支，要覆盖它得再加一关（`tools/fixtures/tiny-city.js` 顶部已注明）。
8. **引擎套件依赖宿主页**：引擎按 id 缓存 DOM，所以必须有 `tools/engine-host.html`。宿主页的 DOM 结构或 id 一旦改动，这个文件要跟着改。

---

## 八、几条最值钱的经验

### 1. 注释写错比代码写错更危险

坑 #5 里，一句写反的注释让我在"验证"时直接跳过了方位检查。**错误的注释会让人停止怀疑。**

### 2. "容器宽度正常"不等于"没溢出"

坑 #12 里，`.app` 的宽度一直是正确的 390px，发现问题的是子元素。**只看外层永远找不到 `min-width: auto` 类的坑。**

### 3. 打印数据 > 改代码试

坑 #9、#10、#12 的共同点：前几次"改 CSS 试试"全部无效，一次**打印实测数据**就命中根因。建立"先量后改"的反射。

### 4. 静默错误最需要外部验证

坑 #1（adcode 写反）和坑 #13（全解锁）都不会报错，只是**结果全错**。这类问题只能靠**独立数据源交叉验证**或**断言**发现。

### 5. 测试体系要在第一个阶段就搭

这个项目的测试是阶段 1 建的，之后每一轮改动都靠它兜底。它逮住了 4 个我自己没意识到的 bug —— 包括那两个静默错误。**测试不是收尾工作，是开发基础设施。**

### 6. 遇到跑不通的工具，及时换路

坑 #2 里，CDP 试了 5 组参数后发现是环境问题（sandbox 崩溃），立刻转向"页面自己上报"的方案。**新方案反而更简单**。按"最多试 2 次"的红线执行，省下了大量 token。

### 7. 视觉细节必须放大看

坑 #19、#20 都是"实际尺寸下看不出问题，放大后一览无余"。**为视觉工作建一个放大预览页**，是个投入产出比极高的做法。

### 8. 有些"完成"其实从未生效

坑 #13 里，用户明确要的"逐关解锁"从一开始就没工作过，直到我很偶然地去查徽标 DOM 才发现。**对每个功能做一次"真的生效了吗"的验证，比相信自己的实现更重要。**

### 9. 拿假数据当探针，能逼出真实数据掩盖的问题

坑 #22 里，几何层"只认 MultiPolygon"这个隐含契约，在真实成都数据上跑了整整一个项目周期都没暴露 —— 因为真实数据恰好就是 MultiPolygon。**换 3 个假区县喂进去，第一次运行就炸了。**

这和"测试要用构造数据"是同一个道理：真实数据是"一种恰好走通的情况"，不是"全部情况"。做通用化重构时，**先写一份最小假数据，往往比先通读一遍代码更快命中问题**；而且假数据是能长期留下的资产 —— 以后任何人改引擎，它都会替你再验一遍。

---

*文档完 · 2026-09（最后更新：引擎化重构 + 双测试体系）*
