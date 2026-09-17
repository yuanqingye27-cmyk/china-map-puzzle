#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 自动化接入脚本 · 一键生成一张地图包
 * ---------------------------------------------------------------------
 * 路径：tools/add-map.js
 *
 * 用法：
 *   node tools/add-map.js --adcode=510300 --name=zigong --parent=sichuan
 *   node tools/add-map.js --adcode=510000 --name=sichuan        # 父级自动推为 china
 *   node tools/add-map.js --adcode=510300 --name=zigong --parent=sichuan --dry-run
 *
 * 干的活：
 *   1. 解析层级：从 adcode 与 --parent 推出这张地图该放在哪个目录
 *   2. 父级还没接入时，**自动补全祖先链**（如 zigong 需要 sichuan 与 china 先就位）
 *   3. 逐张下载 DataV 边界数据（网络失败最多重试 2 次）
 *   4. 生成三件套：
 *        <id>.geo.js   构建产物（每次都会被覆盖刷新）
 *        <id>.data.js  资料骨架（**已存在就不动**，绝不冲掉人工文案）
 *        <id>.js       配置（**已存在就不动**）
 *   5. 调 tools/build-registry.js 的核心逻辑重新生成 registry.js
 *
 * 生成出来的资料是**占位骨架**（area=null、其余填"（待补充）"），
 * 面积、地标、冷知识这些得人工补 —— 脚本编不出来，也不该瞎编。
 *
 * 参数：
 *   --adcode=<6位>   行政区划代码（必填）
 *   --name=<slug>    地图包 id / 文件名 / 目录名，小写英文（必填）
 *   --parent=<id>    上一级地图包 id（县级必须给；省市可省略，按 adcode 推断）
 *   --force          已存在的 .data.js / .js 也覆盖（默认不覆盖，保护人工数据）
 *   --geo-only       只重新下载并刷新 .geo.js，人工文件一律不动
 *   --source=<id>    数据源：datav（默认）| tianditu | file，见 tools/lib/geo-source.js
 *   --tk=<key>       天地图开发者 Key（也可用环境变量 TIANDITU_TK 或配置文件）
 *   --dir/--file     file 数据源要读的本地官方数据包
 *   --dry-run        只打印计划，不联网、不写盘
 *   --quiet          安静模式
 *
 * 【同时是一个库】核心逻辑抽在 `addMap(opts)` 里，**不打印、不退出、不动注册表**，
 * 于是 tools/batch-add-maps.js 可以真的调用它（而不是抄一份逻辑）：
 *
 *   const { addMap } = require('./add-map');
 *   const r = await addMap({ adcode: 510300, slug: 'zigong', parentSlug: 'sichuan' });
 *
 * CLI 只是在它外面套了参数解析、打印和"重新生成注册表"。
 * ⚠️ 所以本文件末尾的 main() 必须用 `require.main === module` 守住 ——
 *   否则别的脚本一 require 它就会把 CLI 跑起来。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');
const geoLib = require('./lib/inline-geo');
const geoSource = require('./lib/geo-source');

/* slug 表（省级 / 地级）与 adcode 层级推断都在公共库里，见 tools/lib/slugs.js */
const slugs = require('./lib/slugs');

/* 官方地名表（adcode → 中文名）。取显示名时兜底用，见 nameOfAdcode 的说明。 */
let NAME_MAP = {};
try { NAME_MAP = require('./lib/name-map.json'); } catch (e) { NAME_MAP = {}; }

/** adcode → 官方中文名（拿不到就返回 null，由调用方决定怎么兜底） */
function nameOfAdcode(adcode) {
  return NAME_MAP[String(adcode)] || null;
}
const PROVINCE_SLUGS = slugs.PROVINCE_SLUGS;
const CHINA = slugs.CHINA;

/** 自动分关时每关放几个下级行政区 */
const LEVEL_SIZE = 8;

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const cnLevel = (i) => (i < CN_NUM.length ? '第' + CN_NUM[i] + '关' : '第' + (i + 1) + '关');

const slugToProvinceAdcode = slugs.slugToProvinceAdcode;

/* ============================ 参数解析 ============================ */

function parseArgs(argv) {
  const out = { flags: new Set() };
  argv.forEach((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) return;
    if (m[2] === undefined) out.flags.add(m[1]);
    else out[m[1]] = m[2];
  });
  return out;
}

function validateArgs(args) {
  const adcode = args.adcode === undefined ? NaN : Number(args.adcode);
  if (!/^\d{6}$/.test(String(args.adcode || ''))) {
    throw new Error('--adcode 必须是 6 位数字，例如 --adcode=510300');
  }
  if (!/^[a-z][a-z0-9_-]*$/.test(args.name || '')) {
    throw new Error('--name 必须是"小写英文 + 数字/下划线/连字符"，例如 --name=zigong（它同时是文件名和目录名）');
  }
  if (args.parent !== undefined && !/^[a-z][a-z0-9_-]*$/.test(args.parent)) {
    throw new Error('--parent 必须是已接入的地图 id，或内置省级 slug（如 sichuan）');
  }
  return { adcode, slug: args.name, parentSlug: args.parent === undefined ? undefined : args.parent };
}

/* ============================ 层级推导 ============================ */

/**
 * 由 adcode 推断"它该怎么办"，必要时报错让用户显式给 --parent。
 * 返回 { slug, adcode, parentSlug }，slug 已知的（祖先）直接给出。
 */
function describeSlug(slug, existing) {
  if (existing[slug]) {
    return { slug, adcode: existing[slug].adcode, parentSlug: existing[slug].parent };
  }
  if (slug === CHINA.slug) return { ...CHINA };
  const adcode = slugToProvinceAdcode(slug);
  if (adcode) return { slug, adcode, parentSlug: 'china' };
  return null;
}

/**
 * 规划出"从根到目标"需要新建哪些包，以及每张包该放在哪个目录。
 * 已存在的地图直接复用（以磁盘为准），不会重复下载。
 */
function planChain(target, existing) {
  // 1. 决定目标的父级 slug
  let parentSlug = target.parentSlug;
  if (parentSlug === undefined) {
    if (target.adcode === CHINA.adcode) {
      parentSlug = null;
    } else if (target.adcode % 10000 === 0) {
      parentSlug = 'china'; // 省级 → 中国
    } else if (target.adcode % 100 === 0) {
      parentSlug = PROVINCE_SLUGS[String(target.adcode).slice(0, 2)] || null; // 地级 → 省
      if (!parentSlug) {
        throw new Error(
          '无法从 adcode ' + target.adcode + ' 推断所属省份，请显式指定 --parent=<省级id>'
        );
      }
    } else {
      throw new Error(
        '县级地图（adcode ' + target.adcode + '）的父级 slug 无法从代码推断，' +
        '请显式指定 --parent=<地级市id>，例如 --parent=zigong'
      );
    }
  }

  const targetNode = { slug: target.slug, adcode: target.adcode, parentSlug };

  // 2. 从目标一路向上走到根
  const upward = [targetNode];
  let cur = targetNode;
  for (let guard = 0; guard < 8; guard++) {
    if (cur.parentSlug === null) break;
    const parent = describeSlug(cur.parentSlug, existing);
    if (!parent) {
      throw new Error(
        '父级「' + cur.parentSlug + '」还没接入，而且它不在内置省级表里。\n' +
        '请先用 add-map.js 接入它，例如：\n' +
        '  node tools/add-map.js --adcode=<父级adcode> --name=' + cur.parentSlug + ' --parent=<祖父id>'
      );
    }
    upward.unshift(parent);
    cur = parent;
  }
  if (cur.parentSlug !== null) throw new Error('层级链异常：向上追溯 8 层仍未到根，请检查 parent 是否成环');

  // 3. 自上而下算目录，收集"需要新建"的
  const plan = [];
  let dir = '';
  upward.forEach((node) => {
    if (existing[node.slug]) {
      dir = existing[node.slug].dir; // 以磁盘为准
    } else {
      plan.push({ ...node, dir });
    }
    dir = dir ? dir + '/' + node.slug : node.slug; // 下一步轮到它的子目录
  });

  return { plan, upward };
}

/* ============================ 代码生成 ============================ */

/** 由 adcode 派生一个稳定的主色相，保证每张自动接入的地图有自己的一套配色 */
function hueFor(adcode, levelIndex) {
  return Math.abs((adcode * 37 + levelIndex * 52) % 360);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * 把 levels 数组渲染成 .data.js 里的源码片段。
 * 抽成函数是为了让 tools/regroup-levels.js 能**复用同一份渲染逻辑** ——
 * 复刻一份会立刻产生"两处不一致"的风险（改了生成器忘了改脚本）。
 */
function renderLevelsSource(levels) {
  return levels
    .map((l) => (
      '    {\n' +
      '      id: \'' + l.id + '\',\n' +
      '      name: \'' + l.name + '\',\n' +
      '      short: \'' + l.short + '\',\n' +
      '      color: \'' + l.color + '\',\n' +
      '      blurb: \'' + l.blurb + '\',\n' +
      '      adcodes: [' + l.adcodes.join(', ') + '],\n' +
      '    },'
    ))
    .join('\n');
}

/**
 * 读官方类型表 { adcode: type }。数据由 tools/mca-check.js --write-tree 生成。
 * 读不到就返回空对象（此时 autoLevels 会退回名字后缀判断）。
 */
let _officialTypes = null;
function loadOfficialTypes() {
  if (_officialTypes) return _officialTypes;
  _officialTypes = {};
  try {
    const rows = require('./lib/mca-tree.json');
    rows.forEach((r) => { if (r.code6 && r.type) _officialTypes[String(Number(r.code6))] = r.type; });
  } catch (e) { /* 没有就不优化 */ }
  return _officialTypes;
}

/**
 * 关卡分组：**按行政类型**（市辖区 / 县级市 / 县）。
 *
 * 【为什么不再"每 8 个一组"】
 * 旧做法是纯机械切分，第 1 关和第 2 关之间没有任何地理或文化含义 ——
 * 玩家拼完一关不知道自己刚拼的是哪一片。而"市辖区 / 县级市 / 县"是
 * **行政区划里真实存在的分类**，用它分组：
 *   · 有实际含义：第 1 关就是"这个市的城区"，第 2 关是"它的县级市"…
 *   · 完全可自动推导（看名字后缀即可），不需要人工逐市编写
 *   · 每组大小天然合理：实测成都 市辖区12 / 县级市5 / 县3，
 *     邢台 市辖区4 / 县12 / 县级市2，乐山 市辖区4 / 县6 / 县级市1
 *
 * 【仍然建议人工重排】这只是一个**有意义的默认值**，不是最终答案。
 * 真正好玩的分组还要考虑地理相邻、文化圈（如"沿江城市带"），
 * 那部分只能靠人 —— 所以 blurb 里会写清"这是按行政类型的自动分组，欢迎重排"。
 */
function autoLevels(features, adcode) {
  /* 类型判断**优先用官方 type**（民政部国家地名信息库，见 tools/mca-check.js）。
   * 为什么不能只看名字后缀：
   *   · 地级市（xx00）与县级市（xxxx）都以"市"结尾 → 光看后缀会把安徽省
   *     21 个地级市全归进"其他"（实测踩过）
   *   · `旗` / `自治旗` / `林区` / `特区` 从名字看不出归属 → 内蒙古的 49 个旗
   *     会被丢进"其他"（官方树里确实有这些类型）
   * 官方 type 是权威分类，抓一次落盘（tools/lib/mca-tree.json，205 KB）。
   * 拿不到时退回名字后缀判断，保证工具能独立工作。 */
  const OFFICIAL = loadOfficialTypes();
  const TYPE_MAP = {
    '市辖区': 'district', '县': 'county', '县级市': 'countyCity',
    '自治县': 'county', '旗': 'county', '自治旗': 'county',
    '林区': 'county', '特区': 'county',
    '地级市': 'city', '自治州': 'prefecture', '地区': 'prefecture', '盟': 'prefecture',
  };
  const typeOf = (f) => {
    const n = String(f.properties.name || '');
    const a = Number(f.properties.adcode);
    const off = OFFICIAL[String(a)];          // 官方 type
    if (off && TYPE_MAP[off]) return TYPE_MAP[off];
    // —— 退回名字后缀判断 ——
    const isPrefecture = a % 100 === 0;       // 地级（xx00）
    if (isPrefecture) {
      if (/自治州$/.test(n)) return 'prefecture';
      if (/(地区|盟)$/.test(n)) return 'prefecture';
      return 'city';
    }
    if (/区$/.test(n)) return 'district';
    if (/市$/.test(n)) return 'countyCity';
    if (/县$/.test(n)) return 'county';
    return 'other';
  };
  const LABEL = {
    district: { name: '市辖区', blurb: '这个市的城区部分（市辖区）' },
    countyCity: { name: '县级市', blurb: '代管的县级市' },
    county: { name: '县', blurb: '下辖的县与自治县' },
    city: { name: '地级市', blurb: '省内的各地级市' },
    prefecture: { name: '自治州与地区', blurb: '自治州 / 地区 / 盟' },
    other: { name: '其他', blurb: '其余下级行政区' },
  };
  const ORDER = ['district', 'countyCity', 'county', 'city', 'prefecture', 'other'];

  // 按类型归组，组内保持 adcode 升序（与官方区划顺序一致）
  const buckets = {};
  features.forEach((f) => {
    /* 【必须自己过滤】不能假设调用方已经筛过：
     *   · 全国数据里混着"南海诸岛及海上界线"（adcode "100000_JD"，非数字）
     *     —— 它不是一块可拼的行政区，进关卡会立刻报错（实测踩过）
     *   · 地图自己（adcode === 本图 adcode）也不该成为自己的一块
     * add-map.js 在写 .geo.js 时已经处理过，但 autoLevels 是**纯函数**，
     * 也可能被别的脚本用原始 features 调用（tools/regroup-levels.js 就是）。
     */
    const raw = f.properties && f.properties.adcode;
    const n = Number(raw);
    if (!raw || !isFinite(n) || String(raw).indexOf('_') >= 0) return;   // 非行政区
    if (Number(adcode) && n === Number(adcode)) return;                  // 地图自己
    const t = typeOf(f);
    (buckets[t] = buckets[t] || []).push(n);
  });
  const groups = ORDER.filter((t) => buckets[t] && buckets[t].length)
    .map((t) => ({ type: t, adcodes: buckets[t] }));

  if (!groups.length) return [];

  /* 【过滤退化的"一关只有 1 个"】并把它并入相邻组。
   * 为什么必须做：引擎会把"本关只有 1 块"当成白送的一块直接放好
   * （否则玩家无从下手）。于是会同时出现两个坏结果：
   *   · 玩家看到地图上已经拼好一块，任务显示"1/18" —— 像 bug
   *   · 关卡的难度分布也被打乱
   * 实测踩过：甘孜的"县级市"只有康定市 1 个 → 生成 2 关（县级市1 + 县17），
   * 第 1 关被白送，冒烟测试的"刷新后进度还在"因此稳定失败。
   * 处理：把只有 1 个的组并进**成员最多的那一组**，保证每关至少 2 块。 */
  const merged = groups.filter((g) => g.adcodes.length >= 2);
  const lonely = groups.filter((g) => g.adcodes.length < 2);
  if (lonely.length && merged.length) {
    const target = merged.reduce((a, b) => (b.adcodes.length > a.adcodes.length ? b : a));
    lonely.forEach((g) => { target.adcodes = target.adcodes.concat(g.adcodes).sort((a, b) => a - b); });
  } else if (lonely.length && !merged.length) {
    // 全部都是单元素组（极罕见）→ 合成一关，别摆出一堆"白送关"
    merged.push({ type: 'other', adcodes: lonely.reduce((a, g) => a.concat(g.adcodes), []).sort((a, b) => a - b) });
  }

  /* 【命名】单类型时也用**类型名**，不要退回"第一关"。
   * 理由：类型名本身就是信息 —— 北京地图的 16 项全是"市辖区"，
   * 安徽地图的 16 项全是"地级市"。写"第一关"等于什么都没说，
   * 写类型名玩家一眼就知道这一关在拼什么。
   * 只有真的判不出类型（other）时才退回"第一关"。 */
  const single = merged.length === 1;

  return merged.map((g, i) => {
    const label = LABEL[g.type];
    const named = g.type !== 'other';
    const name = named ? label.name : cnLevel(0);
    return {
      id: 'l' + (i + 1),
      name: name,
      short: name,
      color: hslToHex(hueFor(adcode, i), 62, 52),
      blurb: single
        ? ('本图的下级行政区全部是' + label.blurb + '（' + g.adcodes.length + ' 个）。' +
           '想按地理相邻或主题重排关卡，直接改这个文件里的 levels。')
        : ('按行政类型自动分组：' + label.blurb + '（' + g.adcodes.length + ' 个）。' +
           '想把相邻的区县编成一关，或凑成"中心城区""沿江城市带"这类主题，直接改这个文件里的 levels。'),
      adcodes: g.adcodes,
    };
  });
}

/**
 * 只挑出"能当拼图块"的 feature。
 *
 * 过滤掉两类：
 *  ① 非行政区 feature —— DataV 的全国数据里混着南海九段线（adcode `"100000_JD"`）：
 *     它要留在 GeoJSON 里画底图，但**不能进关卡和资料卡**（不是可拼的块，
 *     而且 adcode 不是数字，当成对象 key 写出来会变成非法 JS —— 真实踩过）。
 *  ② **地图自己** —— 天地图对**省级**地图返回的 `_full.json` 里，
 *     第一条 feature 就是它自己（如北京市 110000 混在东城区 110101…里）。
 *     地级市的数据不带这一条，所以这个坑只在省级地图上出现。
 *     后果很隐蔽：关卡里多了一个"上级自己的 adcode"，拼图多一块，
 *     拖拽落点判定随之错乱（实测北京/天津/上海/重庆/台湾/香港 6 张地图
 *     的冒烟测试全挂在"拖不进去、飘字说 XX 还在别处"）。
 */
function adminFeatures(features, selfAdcode) {
  return features.filter((f) => {
    const ad = f.properties.adcode;
    if (!geoLib.isAdminAdcode(ad)) return false;
    if (selfAdcode !== undefined && Number(ad) === Number(selfAdcode)) return false;
    return true;
  });
}

function renderDataModule(planItem, features, label, levels, generator) {
  const districtLines = features
    .map((f) => {
      const p = f.properties;
      // 占位符里带上名字：人工补资料时一眼就知道这条该填哪个地方的什么
      const who = String(p.name || '').replace(/'/g, '’');
      return (
        '    ' + JSON.stringify(String(p.adcode)) + ': {\n' +
        '      area: null,                    // TODO 面积（km²，数字）\n' +
        "      landmark: '【待补充：" + who + "地标】',\n" +
        "      tagline: '【待补充：" + who + "一句话介绍】',\n" +
        "      funFact: '【待补充：" + who + "冷知识】',\n" +
        '    }, // ' + p.name
      );
    })
    .join('\n');

  const levelLines = renderLevelsSource(levels);

  return (
    '/* =====================================================================\n' +
    ' * 地图包 · ' + label + ' · 资料与关卡【占位骨架，等待人工补全】\n' +
    ' * ---------------------------------------------------------------------\n' +
    ' * 路径：js/maps/' + (planItem.dir ? planItem.dir + '/' : '') + planItem.slug + '.data.js\n' +
    ' * 生成：' + generator + '\n' +
    ' *\n' +
    ' * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：\n' +
    ' *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。\n' +
    ' *\n' +
    ' * 待补清单（' + features.length + ' 个下级行政区 × 4 项）：\n' +
    ' *   1. area      面积（km²，数字；缺失时信息卡显示"—"）\n' +
    ' *   2. landmark  地标\n' +
    ' *   3. tagline   一句话介绍\n' +
    ' *   4. funFact   冷知识\n' +
    ' *\n' +
    ' * 还有一个**可选**字段 src：这一条的资料来源（如"XX县政府网《县情概况》"）。\n' +
    ' * 填了它，资料卡底部就会把它显示出来；不填则显示"资料来源待补"。\n' +
    ' * 为什么鼓励填：没有来源的条目，维护者不敢改、别人不敢信 ——\n' +
    ' * 见 docs/可持续性与内容生产.md 2.3「科学」的定义。\n' +
    ' *\n' +
    ' * 关卡（levels）按**行政类型**自动分组（市辖区 / 县级市 / 县），\n' +
    ' * 这是一个"有含义的默认值"：想按地理相邻或文化圈重排，直接改 levels 即可。\n' +
    ' * ===================================================================== */\n' +
    '\n' +
    "(function (global) {\n" +
    "  'use strict';\n" +
    '\n' +
    '  /** 下级行政区资料，key 是国家行政区划代码（adcode） */\n' +
    '  const DISTRICTS = {\n' +
    districtLines + '\n' +
    '  };\n' +
    '\n' +
    '  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */\n' +
    '  const LEVELS = [\n' +
    levelLines + '\n' +
    '  ];\n' +
    '\n' +
    '  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});\n' +
    "  MAP_DATA['" + planItem.slug + "'] = { districts: DISTRICTS, levels: LEVELS };\n" +
    '})(window);\n'
  );
}

function renderConfigModule(planItem, label, levels, districtCount, generator) {
  const hueLines = levels.map((l, i) => "      " + l.id + ': ' + hueFor(planItem.adcode, i) + ',').join('\n');

  return (
    '/* =====================================================================\n' +
    ' * 地图包 · ' + label + '（配置）\n' +
    ' * ---------------------------------------------------------------------\n' +
    ' * 路径：js/maps/' + (planItem.dir ? planItem.dir + '/' : '') + planItem.slug + '.js\n' +
    ' * 生成：' + generator + '\n' +
    ' *\n' +
    ' * 【层级】parent = ' + (planItem.parentSlug === null ? 'null（根地图）' : "'" + planItem.parentSlug + "'") +
    '　adcode = ' + planItem.adcode + '\n' +
    ' *   children 不在这里写 —— 它由 registry 根据子地图的 parent 反向推导，\n' +
    ' *   所以新增下级地图不必回头改这个文件（见 tools/build-registry.js）。\n' +
    ' *\n' +
    ' * 三件套分工：\n' +
    ' *   ' + planItem.slug + '.geo.js   构建产物（自动生成）\n' +
    ' *   ' + planItem.slug + '.data.js  人工资料与关卡（本包的文字都在那里改）\n' +
    ' *   ' + planItem.slug + '.js       本文件：配色/存储/文案\n' +
    ' * ===================================================================== */\n' +
    '\n' +
    "(function (global) {\n" +
    "  'use strict';\n" +
    '\n' +
    '  const GEO_ALL = (global.MAP_GEO = global.MAP_GEO || {});\n' +
    '  const DATA_ALL = (global.MAP_DATA = global.MAP_DATA || {});\n' +
    '  const DATA = DATA_ALL[\'' + planItem.slug + '\'] || {};\n' +
    '\n' +
    '  const CONFIG = {\n' +
    '    id: \'' + planItem.slug + '\',\n' +
    '    name: \'' + label + '\',\n' +
    '    parent: ' + (planItem.parentSlug === null ? 'null' : "'" + planItem.parentSlug + "'") + ',\n' +
    '    adcode: ' + planItem.adcode + ',\n' +
    '\n' +
    '    geo: GEO_ALL[\'' + planItem.slug + '\'],\n' +
    '    districts: DATA.districts,\n' +
    '    levels: DATA.levels,\n' +
    '\n' +
    '    map: { width: 1000, padding: 14 },\n' +
    '    piece: { max: 62, minSide: 15, pieces: [[420, 40], [620, 48], [900, 56]] },\n' +
    '\n' +
    '    /* 主色相由 adcode 派生（见 tools/add-map.js 的 hueFor），每关错开 52° */\n' +
    '    palette: {\n' +
    '      hueByLevel: {\n' + hueLines + '\n      },\n' +
    '      fallbackHue: ' + hueFor(planItem.adcode, 0) + ',\n' +
    '      saturation: 62,\n' +
    '      lightBase: 48,\n' +
    '      lightStep: 7,\n' +
    '      lightSpan: 16,\n' +
    '      hueSpread: 44,\n' +
    '    },\n' +
    '\n' +
    '    /* 每张地图必须有独立的存储 key，否则两张地图的存档会互相覆盖 */\n' +
    '    storage: {\n' +
    '      save: \'' + planItem.slug + '-map-puzzle\',\n' +
    '      theme: \'' + planItem.slug + '-map-theme\',\n' +
    '      sound: \'' + planItem.slug + '-map-sound\',\n' +
    '      intro: \'' + planItem.slug + '-map-intro-seen\',\n' +
    '      saveVersion: 2,\n' +
    '    },\n' +
    '\n' +
    '    themes: { list: [\'jade\', \'ginkgo\', \'shu\'], fallback: \'jade\' },\n' +
    '\n' +
    '    texts: {\n' +
    '      cityName: \'' + label + '\',\n' +
    '      districtCount: ' + districtCount + ',\n' +
    '      missingDataHint:\n' +
    '        \'地图数据没加载出来，请确认 js/maps/' + (planItem.dir ? planItem.dir + '/' : '') + planItem.slug +
    '.geo.js 存在且没有被浏览器拦截。\',\n' +
    '    },\n' +
    '  };\n' +
    '\n' +
    '  const PACKAGES = (global.MAP_PACKAGES = global.MAP_PACKAGES || {});\n' +
    "  PACKAGES['" + planItem.slug + "'] = CONFIG;\n" +
    '})(window);\n'
  );
}

/* ============================ 名字借用 ============================ */

/**
 * 取某张地图的显示名（如"自贡市"）。
 * 优先从**父地图的 GeoJSON** 里借 —— 父地图的 features 就是它的下级行政区，
 * 里面正好有我们要的那一条，所以不额外发请求。
 * 借不到才退化成单独请求 <adcode>.json（只有自己一个 feature）。
 */
function nameFromFeatures(features, adcode) {
  const hit = features && features.find((f) => f.properties.adcode === adcode);
  return hit ? hit.properties.name : null;
}

/** 从磁盘上已有的 <id>.geo.js 里抠出 GeoJSON（用于向已接入的父级借名字） */
function readExistingGeoFeatures(dirRel, slug) {
  const file = tree.absOf((dirRel ? dirRel + '/' : '') + slug + '.geo.js');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('{"type"');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)).features;
  } catch (e) {
    return null;
  }
}

/* ============================ 核心：接入一张地图 ============================
 * 这是本文件真正的核心。CLI（下面的 main）和 tools/batch-add-maps.js 都调它。
 * 约定：**不打印、不 process.exit、不动注册表** —— 输出交给 log，
 * 注册表由调用方在合适的时机统一重建（批量时只重建一次，而不是 21 次）。
 * ========================================================================= */

/**
 * 接入一张地图；父级还没接入时会把祖先链一起补齐。
 *
 * @param {object} opts
 *   adcode     number  必填，6 位行政区划代码
 *   slug       string  必填，地图包 id（= 文件名 = 目录名）
 *   parentSlug string  父级 id；不传则按 adcode 推断
 *   force      boolean 连人工写的 .data.js / .js 一起覆盖
 *   geoOnly    boolean 只刷新 .geo.js，人工文件一律不动
 *   dryRun     boolean 只算计划，不联网、不写盘
 *   log        function 逐行输出（默认什么都不打印）
 * @returns {Promise<object>} 结构化结果，给报告/汇总用
 */
async function addMap(opts) {
  const log = opts.log || (() => {});
  const force = !!opts.force;
  const geoOnly = !!opts.geoOnly;
  const dryRun = !!opts.dryRun;
  const adcode = opts.adcode;
  const slug = opts.slug;
  const parentSlug = opts.parentSlug;

  const generator = 'node tools/add-map.js --adcode=' + adcode + ' --name=' + slug +
    (parentSlug === undefined || parentSlug === null ? '' : ' --parent=' + parentSlug) +
    (opts.source && opts.source !== geoSource.DEFAULT_SOURCE ? ' --source=' + opts.source : '');

  // 数据源：调用方没指定就用项目默认（目前是 datav，换源见 tools/lib/geo-source.js）
  const source = geoSource.getProvider(opts.source);
  log('数据源：' + source.label + (source.approval ? '　审图号 ' + source.approval : '（无审图号）'));

  const scan = tree.scanMaps();
  const { plan } = planChain({ adcode, slug, parentSlug }, scan.maps);

  /* --force / --geo-only 时，即使目标已接入也要重新走一遍：
   *   --force     覆盖一切（含人工写的 .data.js / .js）
   *   --geo-only  只刷新 .geo.js，人工文件一律不动
   * 所以这里把目标补回计划里；下面写文件时再按"已存在且非 --force 就不写"来兜底。 */
  const refresh = force || geoOnly;
  if (refresh && scan.maps[slug] && !plan.some((p) => p.slug === slug)) {
    plan.push({
      slug,
      adcode: scan.maps[slug].adcode,
      parentSlug: scan.maps[slug].parent,
      dir: scan.maps[slug].dir,
    });
  }

  const planSummary = plan.map((p) => ({
    slug: p.slug,
    adcode: p.adcode,
    parentSlug: p.parentSlug,
    dir: p.dir,
  }));

  if (!plan.length) {
    log('ℹ 这张地图已经接入过了：' + slug);
    log('  刷新边界数据：node tools/add-map.js … --geo-only（只重写 .geo.js，人工资料不动）');
    return { status: 'existing', slug, adcode, plan: [], maps: [] };
  }

  log('══════════ 接入计划 ══════════');
  plan.forEach((p, i) => {
    const pt = p.parentSlug === null ? '（根）' : p.parentSlug;
    log(
      '  ' + (i + 1) + '. ' + p.slug.padEnd(12) + ' adcode=' + p.adcode +
      '  parent=' + String(pt).padEnd(12) +
      ' → js/maps/' + (p.dir ? p.dir + '/' : '') + p.slug + '{.js,.geo.js,.data.js}'
    );
  });
  if (geoOnly) log('  （--geo-only：只刷新 .geo.js，已存在的人工文件不碰）');

  if (dryRun) {
    log('\n（--dry-run：只打印计划，没有联网、没有写盘）');
    return { status: 'dry-run', slug, adcode, plan: planSummary, maps: [] };
  }

  /* 记忆本次已下载的 features，供下级借显示名 */
  const featuresBySlug = {};
  const results = [];
  let lastFetchedSource = null;

  for (const item of plan) {
    const dirRel = item.dir;
    const baseAbs = tree.absOf((dirRel ? dirRel + '/' : '') + item.slug);
    const relOf = (abs) => abs.replace(tree.ROOT + '/', '');

    log('\n──── ' + item.slug + '（adcode ' + item.adcode + '）────');

    // 1) 下载边界（数据源由 provider 决定：datav / tianditu / file）
    const fetched = await source.fetchGeo(item.adcode, {
      log,
      tk: opts.tk,
      dir: opts.dir,
      file: opts.file,
    });
    const geo = fetched.geo;
    const url = fetched.url;

    /* 【关键】剔除"地图自己"那个 feature。
     * 天地图对**省级**地图返回的 _full.json 里，第一条就是它自己
     * （如 110000 北京市混在 110101 东城区…里）；地级市的数据不带这一条。
     * 为什么必须在这里、而不是只在资料层过滤：
     *   引擎会把 geo 里**每个** feature 渲染成一块拼图。
     *   留着它 → 拼图多一块永远放不对的"省自己" → 拖拽判定错乱
     *   （实测北京/天津/上海/重庆/台湾/香港 6 张省级地图全部拖不进去）。
     *   所以 geo、关卡、资料卡三处必须用同一份"下级列表"。
     * 注意 geo.features 与 features 是同一个数组引用，splice 会同步生效。 */
    const selfIdx = geo.features.findIndex(
      (f) => f.properties && Number(f.properties.adcode) === Number(item.adcode)
    );
    if (selfIdx >= 0) {
      if (geo.features.length > 1) {
        geo.features.splice(selfIdx, 1);
        log('  ℹ 已剔除 geo 里"地图自己"的 feature（adcode ' + item.adcode +
          '）—— 它属于上级视角，不该是这块拼图的一块');
      } else {
        /* 只剩它自己（如澳门：下级就只有一条"澳门"）—— 剔了就什么都没有了。
         * 这种情况保留它：虽然是一块 1 块碎片的拼图，但地图能正常显示与游玩，
         * 好过一张空白地图。 */
        log('  ℹ geo 里只有"地图自己"这一个 feature，保留它（否则地图会是空的）');
      }
    }

    const features = geo.features;
    // child=1 却没拿到下级时给出提示（天地图接口可能只返回自己）
    const hasChildren = features.length > 1;
    featuresBySlug[item.slug] = features;

    // 2) 显示名：优先向父级借（父级的 features 就是它的下级列表）
    let label = null;
    const parentFeatures = item.parentSlug ? featuresBySlug[item.parentSlug] : null;
    if (parentFeatures) {
      label = nameFromFeatures(parentFeatures, item.adcode);
    } else if (item.parentSlug) {
      const existingParent = scan.maps[item.parentSlug];
      if (existingParent) {
        label = nameFromFeatures(readExistingGeoFeatures(existingParent.dir, item.parentSlug), item.adcode);
      }
    }
    if (!label && item.adcode === CHINA.adcode) label = '中国';
    /* 【兜底：查官方地名表】不要直接退回 slug。
     * 实测踩过：省级地图是单独接入的，批处理到它时"父级 features 缓存"是空的，
     * 于是借不到名字 → 静默用 slug（hebei / shijiazhuang…）→ **整个菜单全是拼音**。
     * 这个 bug 从接第二个省就存在，直到看界面才发现。 */
    if (!label) label = nameOfAdcode(item.adcode);
    if (!label) label = item.slug;   // 连地名表都没有才用 slug（并告警）
    if (label === item.slug) {
      log('  ⚠ 取不到「' + item.slug + '」的中文名，暂用 slug 代替。' +
        '若这是新省/市，跑 node tools/gen-name-map.js 补上官方地名表。');
    }

    if (!hasChildren) {
      log('  ⚠ DataV 上这张地图没有下级区划（只拿到它自己 1 个 feature），拼图会只有 1 块');
    }

    // 3) 写 .geo.js（构建产物，总是刷新）
    const geoFile = baseAbs + '.geo.js';
    const written = geoLib.writeGeoModule(geoFile, geo, {
      id: item.slug,
      label,
      adcode: item.adcode,
      sourceUrl: url,
      generator,
      source: fetched.source,
    });
    log('  ✔ ' + relOf(geoFile) +
      '（' + features.length + ' 个下级行政区，' + (written.bytes / 1024).toFixed(1) + ' KB）');

    // 4) 写 .data.js（人工资料，默认不覆盖）
    //    只有真正的行政区才是"拼图块"；非行政区 feature（如九段线）留在 geo 里画底图
    const blocks = adminFeatures(features, item.adcode);
    const skipped = features
      .filter((f) => {
        const ad = f.properties.adcode;
        return !geoLib.isAdminAdcode(ad) || Number(ad) === Number(item.adcode);
      })
      .map((f) => ({ adcode: String(f.properties.adcode), name: f.properties.name || '' }));
    if (skipped.length) {
      log('  ℹ 跳过 ' + skipped.length + ' 个非行政区 feature（' +
        skipped.map((s) => s.adcode + (s.name ? ' ' + s.name : '')).join('、') +
        '）：它画在底图上，但不作为拼图块');
    }

    const levels = autoLevels(blocks, item.adcode);

    const dataFile = baseAbs + '.data.js';
    let dataWritten = false;
    if (fs.existsSync(dataFile) && !force) {
      log('  · ' + relOf(dataFile) + ' 已存在，保留不动（人工数据优先）');
    } else {
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile, renderDataModule(item, blocks, label, levels, generator), 'utf8');
      dataWritten = true;
      log('  ✔ ' + relOf(dataFile) + '（' + blocks.length + ' 个下级行政区 × 4 项，' +
        levels.length + ' 关，全是占位）');
    }

    // 5) 写配置文件（默认不覆盖）
    const configFile = baseAbs + '.js';
    let configWritten = false;
    if (fs.existsSync(configFile) && !force) {
      log('  · ' + relOf(configFile) + ' 已存在，保留不动（人工数据优先）');
    } else {
      fs.writeFileSync(configFile, renderConfigModule(item, label, levels, blocks.length, generator), 'utf8');
      configWritten = true;
      log('  ✔ ' + relOf(configFile));
    }

    lastFetchedSource = fetched.source;

    results.push({
      slug: item.slug,
      adcode: item.adcode,
      name: label,
      parentSlug: item.parentSlug,
      dir: dirRel,
      hasChildren,
      featureCount: features.length,
      districtCount: blocks.length,
      levelCount: levels.length,
      skippedFeatures: skipped,
      files: {
        geo: relOf(geoFile),
        data: relOf(dataFile),
        config: relOf(configFile),
        geoBytes: written.bytes,
      },
      // 占位符清单：报告里据此告诉人"哪些文件、哪些字段还得补"
      placeholders: dataWritten
        ? {
            file: relOf(dataFile),
            fields: ['area', 'landmark', 'tagline', 'funFact'],
            perDistrict: blocks.length,
            levelBlurbs: levels.length,
          }
        : null,
      wrote: { geo: true, data: dataWritten, config: configWritten },
    });
  }

  return {
    status: 'created',
    slug,
    adcode,
    source: lastFetchedSource || {
      provider: source.id,
      label: source.label,
      approval: source.approval,
    },
    plan: planSummary,
    maps: results,
  };
}

/* ============================ CLI ============================ */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const quiet = args.flags.has('quiet');
  const log = quiet ? () => {} : (m) => console.log(m);

  const { adcode, slug, parentSlug } = validateArgs(args);

  const result = await addMap({
    adcode,
    slug,
    parentSlug,
    force: args.flags.has('force'),
    geoOnly: args.flags.has('geo-only'),
    dryRun: args.flags.has('dry-run'),
    source: args.source,
    tk: args.tk,
    dir: args.dir,
    file: args.file,
    log,
  });

  if (result.status === 'dry-run') return;

  // 注册表：批量脚本会自己统一做一次，CLI 每次做完都顺手重建
  console.log('\n══════════ 更新注册表 ══════════');
  const regen = tree.regenerateRegistry({});
  regen.warns.forEach((p) => console.log('  ⚠ ' + p.message));
  regen.errors.forEach((p) => console.log('  ✘ ' + p.message));
  if (!regen.ok) {
    console.log('  ✘ registry 生成失败（有 error），请先修掉上面的问题');
    process.exit(1);
  }
  const all = Object.keys(regen.model.maps).length;
  console.log('  ✔ js/maps/registry.js（共 ' + all + ' 张地图，根 ' + regen.model.roots.length + ' 张）');
  if (result.source) {
    console.log('  数据源：' + result.source.label +
      (result.source.approval ? '（审图号 ' + result.source.approval + '）' : '（无审图号）'));
  }
  if (regen.model.orphans.length) {
    console.log('  ℹ 父级待接入：' + regen.model.orphans.map((o) => o.id + '→' + o.parent).join(', '));
  }
  if (!regen.warns.length && !regen.errors.length) console.log('  （无告警）');

  // 收尾清单
  if (result.maps.length) {
    console.log('\n══════════ 还需要人工做的事 ══════════');
    result.maps.forEach((m) => {
      if (!m.placeholders) {
        console.log('  · ' + m.files.data + '（已存在，未改动）');
        return;
      }
      console.log(
        '  · ' + m.files.data + ' → ' + m.districtCount + ' 个下级行政区的 ' +
        m.placeholders.fields.join(' / ') + '，以及 ' + m.levelCount + ' 关的分组依据与 blurb'
      );
    });
  }
  console.log('  · 跑一遍测试确认没带坏老地图：node tools/e2e-test.js');
}

/* 只有 "node tools/add-map.js" 直接运行时才走 CLI。
 * 别的脚本 require 它（比如批量脚本）时不能顺手把 CLI 跑起来。 */
if (require.main === module) {
  main().catch((err) => {
    console.error('\n✘ ' + err.message);
    process.exit(1);
  });
}

module.exports = {
  addMap,
  listSources: geoSource.listProviders,
  planChain,
  parseArgs,
  validateArgs,
  LEVEL_SIZE,
  slugForAdcode: slugs.slugForAdcode,
  /* 导出给"只重排关卡、不动资料"的脚本复用（tools/regroup-levels.js）。
   * 复刻一份分组逻辑会立刻产生"两处不一致"的风险，所以这里直接复用。 */
  autoLevels,
  renderLevelsSource,
};
