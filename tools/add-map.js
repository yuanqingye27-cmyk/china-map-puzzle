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
 *   --dry-run        只打印计划，不联网、不写盘
 *   --quiet          安静模式
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');
const geoLib = require('./lib/inline-geo');

/* ---------------- 内置省级 slug 表（adcode 前两位 → 目录名） ----------------
 * 只有这一张表是"写死"的：因为县级地图必须靠人给 --parent，
 * 而省级 slug 无法从 adcode 反推（总不能让目录叫 51），所以内置一份。
 * 有了它，--parent=sichuan 就能自动补出 510000 这张地图。
 * ------------------------------------------------------------------------ */
const PROVINCE_SLUGS = {
  11: 'beijing', 12: 'tianjin', 13: 'hebei', 14: 'shanxi', 15: 'neimenggu',
  21: 'liaoning', 22: 'jilin', 23: 'heilongjiang',
  31: 'shanghai', 32: 'jiangsu', 33: 'zhejiang', 34: 'anhui', 35: 'fujian',
  36: 'jiangxi', 37: 'shandong',
  41: 'henan', 42: 'hubei', 43: 'hunan', 44: 'guangdong', 45: 'guangxi', 46: 'hainan',
  50: 'chongqing', 51: 'sichuan', 52: 'guizhou', 53: 'yunnan', 54: 'xizang',
  61: 'shaanxi', 62: 'gansu', 63: 'qinghai', 64: 'ningxia', 65: 'xinjiang',
  71: 'taiwan', 81: 'hongkong', 82: 'macau',
};

const CHINA = { slug: 'china', adcode: 100000, parentSlug: null };

/** 自动分关时每关放几个下级行政区 */
const LEVEL_SIZE = 8;

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const cnLevel = (i) => (i < CN_NUM.length ? '第' + CN_NUM[i] + '关' : '第' + (i + 1) + '关');

const slugToProvinceAdcode = (slug) => {
  const hit = Object.keys(PROVINCE_SLUGS).find((k) => PROVINCE_SLUGS[k] === slug);
  return hit ? Number(hit) * 10000 : null;
};

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

/** 关卡占位：按 adcode 升序每 LEVEL_SIZE 个一关（只收真正的行政区，见下） */
function autoLevels(features, adcode) {
  const adcodes = features.map((f) => f.properties.adcode);
  const groups = [];
  for (let i = 0; i < adcodes.length; i += LEVEL_SIZE) {
    groups.push(adcodes.slice(i, i + LEVEL_SIZE));
  }
  return groups.map((group, i) => ({
    id: 'l' + (i + 1),
    name: cnLevel(i),
    short: cnLevel(i),
    color: hslToHex(hueFor(adcode, i), 62, 52),
    blurb: '（待补充：说明这一关的分组依据，比如"中心城区"或"沿江城市带"）',
    adcodes: group,
  }));
}

/**
 * 只挑出"能当拼图块"的 feature。
 * DataV 的全国数据里混着非行政区 feature（南海九段线，adcode `"100000_JD"`）：
 * 它要留在 GeoJSON 里画底图，但**不能进关卡和资料卡** —— 它不是一块可拼的行政区，
 * 而且它的 adcode 不是数字，当成对象 key 写出来会变成非法 JS（真实踩过）。
 */
function adminFeatures(features) {
  return features.filter((f) => geoLib.isAdminAdcode(f.properties.adcode));
}

function renderDataModule(planItem, features, label, levels, generator) {
  const districtLines = features
    .map((f) => {
      const p = f.properties;
      return (
        '    ' + JSON.stringify(String(p.adcode)) + ': {\n' +
        '      area: null,                    // TODO 面积（km²，数字）\n' +
        '      landmark: \'（待补充）\',\n' +
        '      tagline: \'（待补充）\',\n' +
        '      funFact: \'（待补充）\',\n' +
        '    }, // ' + p.name
      );
    })
    .join('\n');

  const levelLines = levels
    .map((l) => {
      return (
        '    {\n' +
        '      id: \'' + l.id + '\',\n' +
        '      name: \'' + l.name + '\',\n' +
        '      short: \'' + l.short + '\',\n' +
        '      color: \'' + l.color + '\',\n' +
        '      blurb: \'' + l.blurb + '\',\n' +
        '      adcodes: [' + l.adcodes.join(', ') + '],\n' +
        '    },'
      );
    })
    .join('\n');

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
    ' * 关卡（levels）现在只是"每 ' + LEVEL_SIZE + ' 个一组"的机械切分，\n' +
    ' * 真正好玩的关卡应当按地理/文化逻辑重新分组，并补上 blurb。\n' +
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

/* ============================ 主流程 ============================ */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has('dry-run');
  const force = args.flags.has('force');
  const geoOnly = args.flags.has('geo-only');
  const quiet = args.flags.has('quiet');

  const { adcode, slug, parentSlug } = validateArgs(args);
  const generator = 'node tools/add-map.js --adcode=' + adcode + ' --name=' + slug +
    (parentSlug === undefined ? '' : ' --parent=' + parentSlug);

  const scan = tree.scanMaps();
  const planResult = planChain({ adcode, slug, parentSlug }, scan.maps);
  const { plan } = planResult;

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

  if (!plan.length) {
    console.log('ℹ 这张地图已经接入过了：' + slug);
    console.log('  刷新边界数据：node tools/add-map.js … --geo-only（只重写 .geo.js，人工资料不动）');
    const res = tree.regenerateRegistry({});
    if (res.ok) {
      console.log('✔ registry.js 已是最新（共 ' + Object.keys(res.model.maps).length + ' 张地图）');
    } else {
      res.errors.forEach((p) => console.log('  ✘ ' + p.message));
      process.exit(1);
    }
    return;
  }

  console.log('══════════ 接入计划 ══════════');
  plan.forEach((p, i) => {
    const pt = p.parentSlug === null ? '（根）' : p.parentSlug;
    console.log(
      '  ' + (i + 1) + '. ' + p.slug.padEnd(12) + ' adcode=' + p.adcode +
      '  parent=' + String(pt).padEnd(10) +
      ' → js/maps/' + (p.dir ? p.dir + '/' : '') + p.slug + '{.js,.geo.js,.data.js}'
    );
  });
  if (geoOnly) console.log('  （--geo-only：只刷新 .geo.js，已存在的人工文件不碰）');

  if (dryRun) {
    console.log('\n（--dry-run：只打印计划，没有联网、没有写盘）');
    return;
  }

  /* 记忆本次已下载的 features，供下级借显示名 */
  const featuresBySlug = {};

  for (const item of plan) {
    const dirRel = item.dir;
    const baseAbs = tree.absOf((dirRel ? dirRel + '/' : '') + item.slug);

    console.log('\n──── ' + item.slug + '（adcode ' + item.adcode + '）────');

    // 1) 下载边界
    const { raw, url, hasChildren } = await geoLib.fetchDatavGeo(item.adcode, {
      log: quiet ? () => {} : (m) => console.log('  ' + m),
    });
    const geo = geoLib.normalizeGeo(raw);
    const features = geo.features;
    featuresBySlug[item.slug] = features;

    // 2) 显示名：向父级借（父级的 features 就是它的下级列表）
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
    if (!label) label = item.slug; // 实在借不到就用 slug 兜底

    if (!hasChildren) {
      console.log('  ⚠ DataV 上这张地图没有下级区划（只拿到它自己 1 个 feature），拼图会只有 1 块');
    }

    // 3) 写 .geo.js（构建产物，总是刷新）
    const geoFile = baseAbs + '.geo.js';
    const written = geoLib.writeGeoModule(geoFile, geo, {
      id: item.slug,
      label,
      adcode: item.adcode,
      sourceUrl: url,
      generator,
    });
    console.log('  ✔ ' + geoFile.replace(tree.ROOT + '/', '') +
      '（' + features.length + ' 个下级行政区，' + (written.bytes / 1024).toFixed(1) + ' KB）');

    // 4) 写 .data.js（人工资料，默认不覆盖）
    const dataFile = baseAbs + '.data.js';

    // 只有真正的行政区才是"拼图块"；非行政区 feature（如九段线）留在 geo 里画底图
    const blocks = adminFeatures(features);
    const skipped = features.filter((f) => !geoLib.isAdminAdcode(f.properties.adcode));
    if (skipped.length) {
      console.log('  ℹ 跳过 ' + skipped.length + ' 个非行政区 feature（' +
        skipped.map((f) => String(f.properties.adcode) + (f.properties.name ? ' ' + f.properties.name : '')).join('、') +
        '）：它画在底图上，但不作为拼图块');
    }
    const levels = autoLevels(blocks, item.adcode);
    if (fs.existsSync(dataFile) && !force) {
      console.log('  · ' + dataFile.replace(tree.ROOT + '/', '') + ' 已存在，保留不动（人工数据优先）');
    } else {
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile, renderDataModule(item, blocks, label, levels, generator), 'utf8');
      console.log('  ✔ ' + dataFile.replace(tree.ROOT + '/', '') + '（' + levels.length + ' 关，占位）');
    }

    // 5) 写配置文件（默认不覆盖）
    const configFile = baseAbs + '.js';
    if (fs.existsSync(configFile) && !force) {
      console.log('  · ' + configFile.replace(tree.ROOT + '/', '') + ' 已存在，保留不动（人工数据优先）');
    } else {
      fs.writeFileSync(configFile, renderConfigModule(item, label, levels, blocks.length, generator), 'utf8');
      console.log('  ✔ ' + configFile.replace(tree.ROOT + '/', ''));
    }

    item.label = label;
    item.districtCount = blocks.length;
    item.levelCount = levels.length;
  }

  // 6) 重新生成注册表
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
  if (regen.model.orphans.length) {
    console.log('  ℹ 父级待接入：' + regen.model.orphans.map((o) => o.id + '→' + o.parent).join(', '));
  }

  // 7) 收尾清单
  console.log('\n══════════ 还需要人工做的事 ══════════');
  plan.forEach((p) => {
    console.log('  · js/maps/' + (p.dir ? p.dir + '/' : '') + p.slug + '.data.js' +
      ' → ' + p.districtCount + ' 个下级行政区的 area / landmark / tagline / funFact，' +
      '以及 ' + p.levelCount + ' 关的分组依据与 blurb');
  });
  console.log('  · 跑一遍测试确认没带坏老地图：node tools/e2e-test.js');
}

main().catch((err) => {
  console.error('\n✘ ' + err.message);
  process.exit(1);
});
