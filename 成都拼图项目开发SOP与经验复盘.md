# 地图拼图项目开发 SOP 与经验复盘

> 项目：地图拼图（用交互式拼图讲解行政区划；已接入中国 / 四川 / 成都 / 自贡四级地图）
> 形态：零依赖纯前端单页，双击 `index.html` 即可运行
> 架构：**通用引擎 `MapPuzzleEngine` + 地图工厂** —— 加一张地图只需一条命令 + 补文案，不动引擎
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
| 目标 | 用拼图游戏讲解行政区划；已抽成"通用引擎 + 地图工厂"，可自动接入无限多张地图，页面上可直接切换 |
| 技术栈 | 原生 HTML / CSS / JavaScript，**无任何依赖、无任何外链** |
| 数据 | 阿里云 DataV.GeoAtlas：中国（34 省级）/ 四川（21 市州）/ 21 个市各自的区县；**共 23 张地图** |
| 运行方式 | 双击 `index.html`（`file://`），无需构建、无需服务器 |
| 代码规模 | `engine.js` 1554 行（通用逻辑）、`game.js` 208 行（启动器 + 导航 UI）、`loader.js` 141 行（按需加载）、`add-map.js` 620 行（单张接入）、`batch-add-maps.js` 320 行（批量接入）、`style.css` 1695 行、`index.html` 431 行 |
| 首屏体积 | **75 KB**（registry + loader + geomap + engine + game）；23 张地图的数据按需注入，从不全量下载 |
| 测试 | **751 项端到端断言**（89 城市回归 + 77 引擎功能 + 585 多地图冒烟/导航/窄屏专项）+ 1 项 CSS 静态检查，全部通过 |

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

### 3.5 世界地图层级规范（地图工厂）

> 这一节是**地图包的契约**：工具（`tools/add-map.js`、`tools/build-registry.js`）、
> 运行时（`js/maps/loader.js`）、以及将来任何一张新地图，都按它来。
> 契约一旦破坏，`build-registry.js` 会报错拒绝生成登记册 —— 校验写在工具里，不靠自觉。

#### 3.5.1 一张地图 = 三个文件

按**谁来维护**拆开，这是整套自动化的前提：

| 文件 | 谁维护 | 内容 | 会被脚本覆盖吗 |
| --- | --- | --- | --- |
| `<id>.geo.js` | 构建产物 | GeoJSON（内联成 `window.MAP_GEO[<id>]`） | ✔ 每次重刷都会重写 |
| `<id>.data.js` | **人** | 下级行政区资料卡 + 关卡设定（`window.MAP_DATA[<id>]`） | ✘ **永不覆盖** |
| `<id>.js` | 半自动 | 配置：层级、配色、存储 key、文案（`window.MAP_PACKAGES[<id>]`） | ✘ 已存在就不动 |

**为什么必须拆**：面积、地标、冷知识这类文字是人工核实过的资产，脚本编不出来也不该瞎编。
拆分之后，"重新下载边界数据"这个高频操作永远碰不到人写的文字 —— 这是把"会不会冲掉人工成果"从**靠小心**变成**靠结构**。

#### 3.5.2 目录规则（一条递归规则，没有例外）

> **地图 `X` 的包文件路径 = 父地图的子目录 + `X.js`**
> **某地图的子目录 = 它包文件所在目录 + 它自己的 id + `/`**

推导出来的布局：

| 地图 | id | parent | 包文件 | 子地图目录 |
| --- | --- | --- | --- | --- |
| 中国 | `china` | `null`（根） | `js/maps/china.js` | `js/maps/china/` |
| 四川 | `sichuan` | `china` | `js/maps/china/sichuan.js` | `js/maps/china/sichuan/` |
| 成都 | `chengdu` | `sichuan` | `js/maps/china/sichuan/chengdu.js` | `js/maps/china/sichuan/chengdu/` |
| 自贡 | `zigong` | `sichuan` | `js/maps/china/sichuan/zigong.js` | （暂无下级地图） |

要点：

- **根地图直接放在 `js/maps/` 下**（`parent = null`）
- 地图有没有下级**不影响它自己的位置**：叶子地图和带下级的地图放在同一层，
  将来长出下级也不会被迫搬家（只有"接入世界层"那一次特殊搬迁，见 3.5.7）
- 目录名 = 文件名的前缀 = 配置里的 `id` = `MAP_PACKAGES` / `MAP_GEO` / `MAP_DATA` 的 key，
  **四处必须完全一致**，`build-registry.js` 会把不一致直接判为 error

#### 3.5.3 字段规范

**引擎强制**的只有 `geo` 和 `levels`；后面几项是**地图工厂强制**的（少了它们，这张地图就没法被登记、被选择、被导航）：

| 字段 | 谁强制 | 说明 |
| --- | --- | --- |
| `id` | 地图工厂 | 唯一 id，= 文件名 = 目录名；只允许小写英文、数字、`_`、`-` |
| `name` | 地图工厂 | 显示名，如 `自贡市`（从父地图 GeoJSON 里自动借到） |
| `parent` | 地图工厂 | **上一级地图 id**；根地图写 `null` |
| `adcode` | 地图工厂 | 本级行政区划代码（6 位数字）；**世界/大洲等自然地理层级写 `null`** |
| `geo` | 引擎 | GeoJSON FeatureCollection；每个 feature 需 `properties.adcode` / `properties.name`；`Polygon` 与 `MultiPolygon` 都吃 |
| `levels` | 引擎 | `[{ id, name, short, blurb, adcodes, hue? }]` |
| `districts` | — | `adcode → { area, landmark, tagline, funFact }`；缺失时信息卡显示 `—`，不会崩 |
| `palette` | — | `hueByLevel` / `fallbackHue` / `saturation` / `lightBase` / `lightStep` / `lightSpan` / `hueSpread` |
| `map` | — | `{ width, padding }` 画布逻辑尺寸 |
| `piece` | — | `{ max, minSide, pieces }` 碎片尺寸档位 |
| `storage` | — | **每张地图必须换新前缀**，否则两张地图的存档互相覆盖 |
| `themes` | — | `{ list, fallback }` |
| `texts` | — | `{ cityName, districtCount, missingDataHint }` |

配置里**还可以**写 `children`，但它是**可选的自我声明**：

- 真相由子地图的 `parent` 反推（下节），父地图不写 `children` 也完全正确
- 若写了，`build-registry.js` 会拿它和反推结果对照，不一致就报警告
  （防的是"父子两处都手写、结果打架"这种最难查的错）

#### 3.5.4 父子关系：只写 `parent`，`children` 反推

新增一张地图时，**你只需要在新包自己的配置里写 `parent`**，不需要回头改父地图的文件。
`tools/build-registry.js` 扫描全部包、反推 `children`、生成登记册：

```
js/maps/**/*.js  ──扫描+沙箱求值──▶  { id, name, parent, adcode }
                                        │
                       按 parent 反推 children
                                        ▼
                              js/maps/registry.js（自动生成，勿手改）
```

一条实测证据（`sichuan` 从未声明过自己的孩子，`chengdu` 也从未声明过兄弟）：

```
roots: ["china"] | orphans: []
  china    中国    parent=null    children=[sichuan]
  sichuan  四川省  parent=china   children=[chengdu, zigong]   ← 反推出来的
  chengdu  成都    parent=sichuan children=[]
  zigong   自贡市  parent=sichuan children=[]
```

**为什么这样设计**：如果 `children` 也要手写，那么"加一张地图"就得改两个文件，
而且两份声明迟早会不一致。把 `parent` 定为唯一真相来源后，加地图是**纯粹的追加操作**，
天然可并行、不会冲突 —— 这正是"地图工厂"能自动化下去的前提。

`registry.js` 里另有两个诊断字段：

- `roots`：`parent = null` 的地图（树的根）
- `orphans`：声明了 `parent` 但**父级还没接入**的地图，如 `[{ id, parent }]`
  这不是错误，而是"父级空位还等着填"的信号（接入四川之前，成都就一直挂在这里）

#### 3.5.5 registry.js：元信息清单，与加载策略

`registry.js` 只装**元信息**（每张地图几十字节），不含任何 GeoJSON，所以可以一次性全量加载：

| 字段 | 说明 |
| --- | --- |
| `version` | 登记册结构版本 |
| `roots` | 根地图 id 数组 |
| `orphans` | 父级待接入的地图 |
| `maps[id].id / name / parent / adcode / children` | 层级信息 |
| `maps[id].dir` | 相对 `js/maps/` 的目录，如 `china/sichuan`（根为 `""`） |
| `maps[id].scripts` | 该地图三个文件的路径，相对 `js/maps/`，按依赖顺序 |

运行时由 `js/maps/loader.js` 按需注入：

```
首屏固定加载： registry.js(2.9KB) + loader.js(4.7KB) + geomap + engine + game  ≈ 75KB
用户选中某地图： 才注入它的三个文件            成都 ≈ 145KB
```

- 于是**地图数量再多，首屏也不变重**
- 注入用 `<script>` 而不是 `fetch`：`file://` 下浏览器会拦 fetch 本地 JSON，`<script>` 不受影响 ——
  **"双击即玩"这条底线决定了加载方式，不是随便选的**
- `scripts` 路径相对 **`js/maps/`**，loader 用自己 `<script src>` 的地址推算基准目录，
  所以宿主页放在哪一层都不会错

#### 3.5.6 面包屑 / "返回上一级"：为什么不在引擎里，怎么实现

**引擎不参与层级导航。** 引擎只认 `geo / levels / districts / palette / storage / texts` 这些
"渲染和玩法"字段，`parent` / `children` / `adcode` 它**完全不认识**（多传了也直接无视）。
这不是偷懒，而是分层原则：**引擎负责"拼一张图"，宿主层负责"在树里走"**。

所以"返回上一级"按钮和面包屑属于**宿主层**（`js/game.js` / 将来的选择器 UI），
它拿 `js/maps/loader.js` 的公开接口拼路径：

```js
// loader.js 已提供（运行时读 registry，不碰引擎）
MapLoader.trail('zigong')
// → [{ id:'china', name:'中国' }, { id:'sichuan', name:'四川省' }, { id:'zigong', name:'自贡市' }]
MapLoader.parentOf('zigong')   // → 四川省这条记录（父级未接入时返回 null）
MapLoader.childrenOf('sichuan')// → [chengdu, zigong]
```

导航规则（已按这个实现，代码在 `js/game.js` 的宿主层）：

1. 用 `trail(id)` 渲染面包屑：`中国 › 四川省 › 自贡市`，前几级是 `<a href="?map=<id>">`，末级用 `aria-current="page"` 标出且不可点
2. **"返回上一级"就是面包屑的上一级**，不再单独做一个按钮 —— 少一个控件就少一处状态不一致
3. 地图选择器是一个原生 `<select>`：按 `children` 递归渲染、用全角空格按层级缩进（`　　成都`），
   所以"选地图"和"看层级"是同一个控件。父级未接入的孤儿地图会挂到顶层并标注"（父级 … 待接入）"
4. 切换地图 = 改 URL 重新加载页面（`?map=<id>`）。
   **为什么是重新加载而不是就地切换**：引擎没有 `destroy()`，也刻意不加（红线），
   而"换地图"意味着换掉 geo/关卡/存档 key 一整套状态；重新加载最干净，
   也顺手让每张地图的进度天然独立（各自的 `storage` key）
5. 图层相关的 UI **一律不许塞进 `engine.js`**。宿主层要加东西时，只用引擎的三个公开接口：
   `create()` / `start()` / `getState()`（见 3.4）

整条导航的渲染顺序也定死了一件事：**先 `engine.start()`，再渲染导航，最后才打就绪标记**
（`<html data-map-ready="<id>">` + `map-ready` 事件）。于是"就绪"就意味着"页面完全可用"，
测试和宿主页都不必再猜时间 —— 这个约定是从坑 #25 里长出来的。

#### 3.5.7 层级与现实行政区划、以及世界层（待接入）

当前只做了中国区划（DataV 数据源），层级深度靠 adcode 天然对应：

| 层级 | adcode 形态 | 例子 | 数据源 |
| --- | --- | --- | --- |
| 世界 | `null` | `world` | **DataV 没有，待接入** |
| 大洲 | `null` | `asia` | **DataV 没有，待接入** |
| 国家 | `100000` | 中国 | DataV ✔ |
| 一级行政区（省） | `XX0000` | `510000` 四川省 | DataV ✔ |
| 二级（地级市） | `XXXX00` | `510300` 自贡市 | DataV ✔ |
| 三级（区县） | `XXXXXX` | `510302` 自流井区 | DataV ✔ |

**已实测：DataV 没有世界地图数据**（`areas_v3/bound/world.json` 返回 404），
世界/大洲层必须换数据源（Natural Earth、world-atlas 的 TopoJSON 是常见选择）。

接入时有两个必须提前知道的约束：

1. **仍要内联成 `.js`**：为了 `file://` 双击可用，任何数据源最终都得在构建期转成
   `window.MAP_GEO[<id>] = {...}`，不能让浏览器去 fetch
2. **TopoJSON 需要拓扑重建**：Natural Earth 官方是 Shapefile/GeoJSON，world-atlas 是 TopoJSON
   （坐标是量化后的增量，需要解码）。若选 TopoJSON，构建脚本里要自带一个小解码器；
   若选 GeoJSON，体积会大不少（世界级边界几 MB），可能需要再做简化
3. **一次搬迁**：世界层一旦接入，中国就不再是根了 —— `parent` 改成 `asia`，
   包文件从 `js/maps/china.js` 移到 `js/maps/world/asia/china.js`，
   子目录 `js/maps/china/` 跟着变成 `js/maps/world/asia/china/`。
   目录规则本身支持这次搬迁（`parent` 一改，`build-registry.js` 会告诉你"放错位置"），
   但要**单独作为一次任务做**，不要和别的改动混在一起

> 世界层数据源调研与接入是**独立任务**，不混进中国区划这一轮 ——
> 混做会同时动到"数据源、几何精度、层级根节点"三样东西，出问题很难定位。

#### 3.5.8 新增一张地图的标准流程

中国区划（DataV 有数据）——一条命令：

```bash
node tools/add-map.js --adcode=510300 --name=zigong --parent=sichuan
```

**整批接入**（一个省 / 一个市）见 [5.11 批量地图操作手册](#511-批量地图操作手册)：

```bash
node tools/batch-add-maps.js --parent=510000
```

它会：

1. 算出这张地图该放在哪个目录（父级还没接入时**自动补全祖先链**，如自贡会先补出四川、中国）
2. 下载边界（网络失败最多重试 **2 次**，仍失败就停下报错，不死磕）
3. 生成三个文件：`.geo.js` 覆盖刷新、`.data.js` 与 `.js` **已存在就不动**
4. 调 `build-registry.js` 重新生成登记册（`children` 自动反推）
5. 打印**还需要人工补什么**（哪几个区的面积/地标/冷知识/关卡分组）

常用参数：`--dry-run`（只打印计划，不联网不写盘）、`--geo-only`（只刷新边界，
人工文件一律不动）、`--force`（连人工文件一起覆盖，慎用）。

跑完必须做的事：

```bash
node tools/e2e-test.js     # 166 项必须全绿（新地图不许带坏老地图）
```

**脚本的边界**：能自动生成 `geo`、`levels` 的骨架、`palette` 的色相、`storage` 的 key；
**不能**生成面积、地标、冷知识、以及"为什么这样分关"——这些是内容，不是数据。
生成出来的占位长这样，跑得起来、信息卡显示 `—` 或"（待补充）"：

```js
510302: { area: null, landmark: '（待补充）', tagline: '（待补充）', funFact: '（待补充）' }
```

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

### 4.7 地图工厂这一轮踩的坑

#### 坑 #23：块注释里写 `js/maps/**/*.js`，`**/` 里的 `*/` 把注释提前闭合了

**现象**：给 `engine.js` 改**注释**（纯注释，没动一行代码），166 项测试直接掉到 8 通过，报 `SyntaxError: Unexpected token '<'`。

**根因**：注释里写了 `js/maps/**/<id>.js`。`**/` 这个序列里含 `*/`，块注释在那里就结束了，后面的 `<id>.js` 变成了代码。

**教训**：**"改动都在注释行内"不等于"注释没被提前闭合"**。我当时的自查是"逐行看 diff 是否以 `*` 开头"，全部通过 —— 但注释早已断开。
改注释后必须跑 `node --check`（或测试），**别用肉眼审注释**。另外文档里引用通配路径时，别在块注释里写 `**/`。

#### 坑 #24：DataV 全国数据里混着非行政区 feature，把生成物写成了非法 JS

**现象**：自动生成的中国地图包一加载就崩，`china.data.js` 语法错误。

**根因**：`100000_full.json` 有 35 个 feature，其中一个是**南海九段线**，`adcode` 是字符串 `"100000_JD"`。
资料文件是按 `adcode` 当对象 key 生成的，于是写出了 `100000_JD: {` —— 非法 JS 字面量。

**修法**（两层）：
1. 生成 key 时一律 `JSON.stringify`（防御性，数字 key 也加引号）
2. 明确区分"行政区"与"非行政区"：`isAdminAdcode()` 只认 6 位数字，**非行政区 feature 留在 GeoJSON 里画底图，但不进关卡、不进资料卡**
3. adcode 是数字串的统一转成 `Number`，否则 `Map` 的 key 类型会不一致

**教训**：真实数据里总有"看着像但不是"的脏数据。生成代码时**永远不要相信字段的合法形态** ——
把它当 key 写进代码前，先问一句"这玩意儿一定是合法标识符吗"。

#### 坑 #25：测试跟 300ms 的吸附动画抢时间，看起来像引擎坏了

**现象**：新写的多地图冒烟套件里，**每一张**地图（包括本来能跑通的成都）都"拖不进去"：
`placed=0`、碎片还在托盘、`tries=1`、没有任何飘字。

**排查过程**（值得记的是方法，不是结论）：
1. 先怀疑坐标算错 → 给 iframe 里的 `getScreenCTM` / `isPointInFill` **打桩**，记录引擎实际问了哪个点、得到什么答案
2. 记录显示：引擎拿到的是正确坐标、`isPointInFill` 返回 `true`、候选高亮也亮了 —— **引擎完全正常**
3. 既然判定正确，就去读 `commitPlace`：它只播吸附动画，真正的落位在 `SNAP_MS` 之后由 `revealDistrict()` 完成
4. 而测试只等了 **280ms**，`SNAP_MS = 300ms` —— 差 20ms

**修法**：不要 sleep 一个"看起来够大"的固定值，改成**等结果**：
轮询"幽灵层消失 + tries 已累加"才认为这次拖拽结算完（三种结局耗时不同，定时值必然踩坑）。

**教训**：
- **动画时长是实现的内部细节，测试不该知道它**。凡是要等某个副作用出现，就轮询它出现，而不是猜时间。这个项目里同一个错误犯过两次（第一次是等地图就绪，第二次是等落位）
- 排查时**先证明被测对象有没有问题**，再怀疑自己的测试。打桩记录"它实际收到什么"，比反复读代码猜快得多

> 同一轮里还有两个**测试环境**的坑，一并记下：
> **① 被测 iframe 必须留在正常文档流里**。第一版把 iframe 藏到 `left:-99999px`，
> 拖拽要靠 `getBoundingClientRect`（碎片中心）和 `getScreenCTM`（落点）两套坐标，
> 藏太远会让两者错开几十像素，于是"每一张地图都拖不进去"。
> **② 关卡开始时视图会用 `viewBox` 插值推近**，动画期间取坐标必然错位；
> 套件里要先等 CTM 稳定再算落点。

#### 坑 #26：`flex-basis: 100%` 在 column 容器里，含义从"宽度"变成了"高度"

**现象**：新加的地图导航条在桌面上好好的，手机上一看：导航条不见了、右侧还有东西被裁掉，
`body.scrollWidth` 是 779 而视口只有 500。

**根因**：导航条是 `.topbar` 的第 3 个子项，靠 `flex-basis: 100%` 换到第二行。
但窄屏的布局块里有一条 `.topbar { flex-direction: column }` —— **主轴换成了竖直方向，
`flex-basis` 于是成了"高度 100%"**，导航条被撑成一整列高，还被挤出屏幕。

**修法**：在那个 620px 断点里补一句 `.mapbar { flex-basis: auto; }`（纵向排列本来就各占一行）。

**教训**：
- **`flex-basis` 是主轴尺寸，不是宽度**。给 flex 子项设 `flex-basis` 前，先确认祖先容器在
  **所有断点**下都是同一个 `flex-direction`，否则同一份 CSS 会在某个断点下突然失效
- **横向溢出的断言必须覆盖窄屏**。这个项目的浏览器测试全跑在 1600px 宽的 iframe 里，
  手机上出的事它们一个都看不见 —— 现在多了一条"390×844 专项"（`tools/map-smoke.html`）
- 截图是发现这类问题的有效手段：数值断言会告诉你"没溢出"，而截图会告诉你"导航条压根没在那儿"

#### 坑 #27：`getScreenCTM()` 和 `clientX/clientY` 可能不在同一个坐标系里

**现象**（排查坑 #25 时撞上的伴生问题）：第一版多地图冒烟套件把被测 iframe 藏到
`left: -99999px`，结果**每一张地图都"拖不进去"**。

**根因**：拖拽要同时用两套坐标 —— 碎片中心来自 `getBoundingClientRect()`，
凹槽落点来自 `getScreenCTM()`。iframe 被挪到远离原点的位置后，这两套坐标错开了几十像素，
落点自然判不到凹槽上。

**修法**：被测 iframe 必须留在**正常文档流**里（照抄 `tools/selftest.html` 的做法，
iframe 放在 body 最前面）。另外关卡开始时视图会用 `viewBox` 插值推近，
动画期间取坐标必然错位，所以套件里要先等 `getScreenCTM()` 连续两次采样一致再算落点。

**教训**：同时使用多个坐标 API 时，先确认它们**参考系相同**；测试环境本身
（iframe 的位置、可见性）也是被测逻辑的一部分，别以为"页面没变就没影响"。

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

新地图（或刷新某张地图的边界）走自动化脚本，**不要手写**：

```bash
# 接入一张新地图（父级没接入会自动补全祖先链）
node tools/add-map.js --adcode=510300 --name=zigong --parent=sichuan

# 只想刷新某张地图的边界，人工写的资料一个字都不动
node tools/add-map.js --adcode=510100 --name=chengdu --parent=sichuan --geo-only

# 先看它打算干什么，不联网、不写盘
node tools/add-map.js --adcode=510300 --name=zigong --parent=sichuan --dry-run
```

成都这张图还留了一个薄封装（内部和 `add-map.js` 共用同一份转换逻辑）：

```bash
curl -o /tmp/cd_full.json https://geo.datav.aliyun.com/areas_v3/bound/510100_full.json
node tools/build-data.js /tmp/cd_full.json
```

> 自检小技巧：重构构建脚本后，用同源数据重新生成一次，
> 和旧产物做**逐字节比对**——一致才说明重构没改变行为。

### 5.8 怎么跑测试

```bash
node tools/e2e-test.js
```

- 一次跑三套，末尾打汇总。正常输出是 **`合计：751 通过 / 0 失败`**（城市回归 89 + 引擎功能 77 + 多地图冒烟 585）
- 每套会打印耗时（23 张地图时冒烟套件约 30s）；超时按套配置，见 `SUITES` 里的 `timeoutMs`
- 只想过其中一套：把别的从 `tools/e2e-test.js` 顶部的 `SUITES` 数组里注掉即可
- 脚本里带的 `--no-sandbox` 是**这台机器必需的**（见坑 #2），换机器可以去掉
- 测试失败时会打印布局诊断（各层宽度、`elementFromPoint` 命中结果），便于快速定位
- 每套测试各起一个独立 Chrome（独立 `user-data-dir`），因此两边的 `localStorage` 互不可见 —— 引擎套件里"没有污染 `chengdu-*` 存档 key"那条断言就是这么成立的
- **新增地图后必须跑一遍**：第三套会自动把登记册里**每一张**地图都打开、真的拖一块进去，验"生成物能不能玩"

三套的分工：

| 套件 | 被测页 | 管什么 |
| --- | --- | --- |
| `tools/selftest.html` | `index.html` | 成都这张图的全部 UI/动画细节、方位、存档、主题、键盘 |
| `tools/engine-test.html` | `tools/engine-host.html` | 引擎通用性（只用虚构 tiny-city，断言里不含真实地名） |
| `tools/map-smoke.html` | `index.html?map=<id>` | **地图工厂的验收**：每张地图都真能加载、数据自洽、能拖进去、导航正确、刷新后进度还在；外加窄屏（390×844）与"点选切换/面包屑返回"专项 |

> 第三套是"文件生成了 ≠ 东西能用"的那道闸。它第一次运行就抓出了两个真问题
> （全国数据里的非行政区 feature 把资料文件写成了非法 JS；以及测试自己跟 300ms 吸附动画抢时间）。

### 5.9 如何加一张新地图（一条命令 + 补文案）

完整规范见 [3.5 世界地图层级规范](#35-世界地图层级规范地图工厂)，动手流程就两步：

**第一步 · 脚本生成骨架**

```bash
node tools/add-map.js --adcode=510300 --name=zigong --parent=sichuan
```

它会补全祖先链、下载边界、生成三件套、更新 `registry.js`，最后打印一张"还需人工补什么"的清单。

**第二步 · 人工补内容**（脚本编不出来的部分）

| 要补的 | 在哪个文件 | 说明 |
| --- | --- | --- |
| `area` / `landmark` / `tagline` / `funFact` | `<id>.data.js` | 面积、地标、一句话介绍、冷知识 |
| 关卡分组与 `blurb` | `<id>.data.js` | 脚本只按"每 8 个一组"机械切分，好玩的关卡要按地理/文化逻辑重排 |
| 主色调 | `<id>.js` 的 `palette` | 脚本按 adcode 派生了一个稳定色相，觉得不好看就改 |

**注意**：`.data.js` 与 `.js` 已存在时脚本**永不覆盖**，所以你补的内容是安全的；
重新下载边界请用 `--geo-only`，**不要**用 `--force`（那会连人工文件一起冲掉）。

然后跑测试：

```bash
node tools/e2e-test.js            # 166 项必须全绿
```

调试单张地图：`index.html?map=<id>` 直接打开即可（如 `?map=zigong`）。

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

### 5.11 批量地图操作手册

单张地图用 `add-map.js`（见 5.9）；**一次接入一整批**用 `batch-add-maps.js`。
两者的关系是"调用"而不是"复制"：批量脚本直接 `require` 了 `add-map.js` 抽出来的
`addMap()` 函数（`add-map.js` 现在同时是 CLI 和一个库），所以单张与批量永远走同一套逻辑。

#### 一、批量接入一个省

```bash
# 先看计划（不联网、不写盘，纯列清单）
node tools/batch-add-maps.js --parent=510000 --dry-run

# 正式跑：接入四川省下辖的全部 21 个市州
node tools/batch-add-maps.js --parent=510000

# 只要其中几个
node tools/batch-add-maps.js --parent=510000 --only=511100,511300
```

传的是**父级 adcode**（这里是 510000 = 四川省）。脚本会：

1. 确保父级已接入；没接入就先把它补出来（它自己也会向上补，直到中国）
2. 下载 `bound/{adcode}_full.json`，取出全部子级（**一次请求就够**，不是每个子级一个请求）
3. 逐个调用 `addMap()`：算目录 → 下载该子级的 `_full.json` → 生成三件套
4. 最后**统一重建一次** `registry.js`（批量时只重建一次，不是 21 次）
5. 写 `batch-report.json`

> **一个市的区县同理**：`node tools/batch-add-maps.js --parent=510100` 会把成都的 20 个区县
> 各生成一张地图包。但区县已经是最下一级了 —— 它们的 `_full.json` 不存在，会退化成
> "只有自己一个 feature"，拼图只有 1 块。**所以批量接"市"才是常规用法。**

#### 二、目录名（slug）是怎么来的

地图包的 id / 目录名是英文（`zigong`），而**拼音没法从 adcode 或中文名推出来**，
除非引一个拼音库（违背零依赖）。所以：

| 层级 | 命名来源 |
| --- | --- |
| 省级 | 内置 34 条省表（adcode 前两位 → slug），见 `tools/lib/slugs.js` |
| 地级 | 内置地级表 `CITY_SLUGS`（**按省逐步补**，目前是四川 21 个） |
| 查不到 | 兜底成 `map-<adcode>`，并写进报告的 `fallbackSlugs` 提醒人工改名 |

**新增一个省时的动作**：往 `tools/lib/slugs.js` 的 `CITY_SLUGS` 里加那个省的地级市，
几行而已，不动任何逻辑。忘了加也不会失败 —— 只是目录会叫 `map-440300` 这种名字。

#### 三、报告怎么看（`batch-report.json`）

| 字段 | 含义 |
| --- | --- |
| `parent` | 父级 adcode / slug / 中文名 / 数据来源 URL |
| `summary` | `children` 子级总数、`created` 新建、`existing` 已接入跳过、`failed` 失败 |
| `maps[]` | 每张地图一行：状态、下级行政区数、关卡数、跳过的非行政区 feature、文件路径 |
| `failures[]` | 失败的 adcode / 名称 / 完整错误（**这些是跳过的，没重试**） |
| `needsHuman[]` | **待人工补的清单**：哪个文件、多少个下级行政区、要补哪些字段 |
| `dataGaps[]` | 数据缺口：没有下级的、含非行政区 feature 的 |
| `fallbackSlugs[]` | 用了兜底命名、建议改成拼音的 slug |
| `registry` | 重建后的地图总数、根、孤儿、告警 |

跑完先看 `summary.failed` 和 `needsHuman` 这两个字段，其余是排查时才翻的细节。

#### 四、数据缺失怎么处理

三种情况，处理方式完全不同 —— 别把它们混成一句"数据不全"：

| 情况 | 表现 | 对策 |
| --- | --- | --- |
| **下载失败**（网络 / 404） | 该地图 `status: "failed"`，出现在 `failures[]` | 脚本**记下、跳过、不重试、不死循环**；回头**再跑一次同样的命令**即可（已接入的会被识别成 `existing` 跳过，只有失败的那几个会重下） |
| **该层级没有下级区划** | `dataGaps` 里 `kind: "no-children"` | DataV 上 `<adcode>_full.json` 不存在，退化成"只有自己"。**说明这一级就是叶子**，不该单独做成一张拼图 |
| **混着非行政区 feature** | `dataGaps` 里 `kind: "non-admin-feature"` | 典型是全国数据里的南海九段线（adcode 是字符串 `100000_JD`）。它**画在底图上，但不进关卡、不进资料卡** —— 这是刻意的，见坑 #24 |

> **红线：不要 `--parent=100000`。** 脚本里硬编码拒绝了整个中国：
> 34 个省级 × 各自的下一级 = 数百张地图，规模远超"批量"该有的样子。
> 正确姿势是一个省一个省来。

#### 五、怎么补卡片资料（这是人工活）

脚本生成的 `<id>.data.js` 里全是占位符，长这样：

```js
"512002": {
  area: null,                          // TODO 面积（km²，数字）
  landmark: '【待补充：雁江区地标】',
  tagline: '【待补充：雁江区一句话介绍】',
  funFact: '【待补充：雁江区冷知识】',
},
```

补资料的标准流程：

1. 打开报告里的 `needsHuman[]`，挑一个 `file`
2. **按 adcode 逐个填**（`area` 填数字，单位 km²；其余填文字）。
   **不要动 key（adcode）** —— 它必须和 `<id>.geo.js` 里的 feature 严格对应，
   写反了就会"拼对位置、弹出别人的介绍"（坑 #1）
3. 关卡（`levels`）也要重排：脚本只按"每 8 个一组"机械切分，好玩的关卡应按地理/文化逻辑分组，并补上 `blurb`
4. 跑测试：`node tools/e2e-test.js` —— 冒烟套件会核对"每个下级行政区都有资料卡"、
   "关卡覆盖与 GeoJSON 完全一致"，**漏填或写错 adcode 会被逮住**
5. 只想刷新边界数据（不动你写的字）：`node tools/add-map.js --adcode=… --name=… --geo-only`
   —— **千万别用 `--force`**，那会连人工文件一起覆盖

> 补资料时可以拿 `【待补充` 当进度指示：
> `grep -c '【待补充' js/maps/china/sichuan/*.data.js` 一眼看出哪个市还没动过。

#### 六、一次批量接入的完整节奏

```bash
node tools/batch-add-maps.js --parent=510000 --dry-run   # 1. 看计划
node tools/batch-add-maps.js --parent=510000             # 2. 真跑
node tools/e2e-test.js                                   # 3. 全绿（地图变多，冒烟套件耗时也变长）
git add -A && git commit -m 'feat: 接入四川省 21 个市州'  # 4. 提交（地图数据也是代码）
```

#### 七、实战记录（2026-09 · 四川）

| 项 | 值 |
| --- | --- |
| 命令 | `node tools/batch-add-maps.js --parent=510000` |
| 子级 | 21 个市州 |
| 结果 | 新建 19、已接入跳过 2（成都、自贡）、**失败 0** |
| 登记册 | 4 张 → **23 张地图**，根仍是 `china`，无孤儿、无告警 |
| 待人工补 | 19 张地图、共 **157 个下级行政区** × 4 项字段 |
| 测试 | 276 项 → **751 项全绿**（冒烟套件逐张打开 23 张地图、每张真拖一块，耗时 30.7s） |
| 兜底命名 | 0 个（21 个市州都在 `CITY_SLUGS` 表里） |

---

## 六、文件目录结构

```
deepseekharness/
├── index.html                      431 行 · 页面结构 + 手绘图案库（12 个 <symbol>）
├── batch-report.json              · 最近一次批量接入的报告（成功/失败/待人工补清单）
├── README.md                      · 项目说明文档
├── 成都拼图项目开发SOP与经验复盘.md   · 本文
│
├── css/
│   └── style.css                  1695 行 · 设计令牌 / 三套主题 / 地图导航 / 全部动画
│
├── js/
│   ├── engine.js                 1554 行 · 通用引擎 MapPuzzleEngine（不含任何地图数据）
│   ├── geomap.js                  181 行 · 墨卡托投影 + path/bbox/质心（两种 GeoJSON 写法都吃）
│   ├── game.js                    208 行 · 启动器 + 地图导航 UI（面包屑 / 选择器，宿主层）
│   └── maps/                       · 地图工厂（层级目录，规则见 3.5）
│       ├── registry.js            113 行 · 总登记册【自动生成，勿手改】
│       ├── loader.js              141 行 · 运行时按需注入脚本 + trail() 面包屑接口
│       ├── china.js / .geo.js / .data.js      中国（根地图，34 个省级行政区）
│       └── china/
│           ├── sichuan.js / .geo.js / .data.js  四川省（21 个市州）
│           └── sichuan/
│               ├── chengdu.{js,geo.js,data.js}  成都 · 20 个区县【资料是人工核实的】
│               ├── zigong.{js,geo.js,data.js}   自贡 · 6 个区县
│               └── … 另外 19 个市州（panzhihua / luzhou / deyang / mianyang /
│                  guangyuan / suining / neijiang / leshan / nanchong / meishan /
│                  yibin / guangan / dazhou / yaan / bazhong / ziyang / aba /
│                  ganzi / liangshan），全部由 batch-add-maps 生成
│                  · .geo.js 是构建产物 / .data.js 是占位资料（待人工补）
│                  · 目录规则见 3.5.2：包文件 = 父地图的子目录 + <id>.js
│
├── tools/
│   ├── add-map.js                 620 行 · 单张接入（CLI + 可被调用的 addMap() 库函数）
│   ├── batch-add-maps.js          320 行 · 批量接入一个省/市 + 写 batch-report.json
│   ├── build-registry.js           71 行 · 扫描 js/maps/ 生成 registry（children 反推）
│   ├── build-data.js               64 行 · 只重刷成都边界的薄封装（新地图请用 add-map）
│   ├── lib/
│   │   ├── inline-geo.js          229 行 · 公共库：GeoJSON 规范化 / 内联模块 / DataV 下载
│   │   ├── map-tree.js            371 行 · 公共库：目录规则 / 包元信息扫描 / registry 生成
│   │   └── slugs.js                90 行 · 公共库：adcode ↔ 拼音 slug（省表 / 地级表 / 兜底）
│   ├── e2e-test.js                238 行 · 测试驱动（跑三套 + CSS 静态检查 + 汇总）
│   ├── selftest.html              560 行 · 城市回归套件（89 项 · 成都真实数据 + UI/动画）
│   ├── engine-test.html           503 行 · 引擎功能套件（77 项 · 只用虚构数据）
│   ├── map-smoke.html            584 行 · 多地图冒烟套件（拖拽 + 导航 + 点选切换 + 窄屏）
│   ├── shot.js / shot.html        · 截图工具（把应用跑到想要的样子再让 Chrome 拍）
│   ├── engine-host.html           引擎测试宿主页（与 index.html 同构的瘦页面）
│   ├── fixtures/
│   │   └── tiny-city.js           虚构测试城市（3 个假区县 + 2 关 + 自配色）
│   ├── shot.js                    · 截图工具（生成 docs/ 里的界面配图）
│   ├── shot.html                  · 截图载体（负责"把 load 事件拖住"）
│   ├── icon-preview.html           手绘图案预览（需 http 打开）
│   └── districts-source.json       核实过的区县资料（数据存档）
│
└── docs/
    ├── level1.jpg                  第一关截图
    ├── level2.jpg                  第二关截图
    ├── intro.jpg                   开场动画截图
    ├── settle.jpg                  结算画面截图
    ├── patterns.jpg                手绘图案总览
    ├── ui-chengdu.png              地图导航 UI（成都，面包屑 + 选择器）
    ├── ui-zigong.png               地图导航 UI（自贡，占位资料）
    ├── ui-china.png                地图导航 UI（中国，根地图）
    └── ui-mobile.png               窄屏下的导航 UI（390×844）
```

**加载顺序**（`index.html` 末尾，不可调换）：

```html
<script src="js/maps/registry.js"></script>  <!-- 轻量元信息：谁是谁的父级、脚本在哪 -->
<script src="js/maps/loader.js"></script>    <!-- 按 registry 在选中地图时注入脚本 -->
<script src="js/geomap.js"></script>         <!-- 投影与几何 -->
<script src="js/engine.js"></script>         <!-- 通用引擎（不自动启动） -->
<script src="js/game.js"></script>           <!-- 读 ?map= → loader.load() → start() -->
```

> 注意：具体的**地图包不再写死在 `index.html` 里**。成都的三个文件是运行时由
> `loader.js` 注入的，所以地图从 1 张长到 100 张，首屏依然是上面这 5 个脚本（≈75KB）。

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
6. **一个地图只有一份进度**：进度按地图的 `storage` key 存，切换地图不会互相覆盖，但也没有"跨地图总进度"这种东西。
7. **导航栏只在多地图时出现**：只有一张地图且没有上下级时，`renderNav()` 会把整条导航收起来（`hidden`），免得只有一个选项的下拉占地方。
8. **世界/大洲层没有数据源**：DataV 只覆盖中国区划（`world.json` 实测 404），世界层需要换 Natural Earth / world-atlas，是独立任务（见 [3.5.7](#357-层级与现实行政区划以及世界层待接入)）。
9. **自动生成的资料是占位**：`add-map.js` / `batch-add-maps.js` 生成的下级行政区资料是
   `area: null` + `【待补充：<地名><字段>】`，面积/地标/冷知识必须人工补；关卡也只是"每 8 个一组"的机械切分。
   目前四川 19 个新市州共 157 个区县都是占位状态（成都、自贡之外的卡片资料都还没写）。
10. **fixture 没覆盖 `palette.fallbackHue`**：只有"关卡既不自带 `hue`、`hueByLevel` 里也查不到"时才会走这条分支，要覆盖它得再加一关（`tools/fixtures/tiny-city.js` 顶部已注明）。
11. **引擎套件依赖宿主页**：引擎按 id 缓存 DOM，所以必须有 `tools/engine-host.html`。宿主页的 DOM 结构或 id 一旦改动，这个文件要跟着改。
12. **孤儿地图**：子地图声明的 `parent` 若还没接入，它会挂在 `registry.orphans` 里（能玩、能选，但没有"返回上一级"）。这是过渡态信号，不是错误。

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

*文档完 · 2026-09（最后更新：地图工厂 + 层级架构 + 三套测试体系）*
