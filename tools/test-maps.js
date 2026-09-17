#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 离线自检 · 地图包自洽性（不需要浏览器）
 * ---------------------------------------------------------------------
 * 路径：tools/test-maps.js
 * 用法：node tools/test-maps.js      （被 tools/e2e-test.js 自动调用）
 *
 * 为什么要有它：**换数据源会改变 adcode 集合**。
 *   真实案例：会理县(513425) 在官方 2024 数据里已经是会理市(513402)。
 *   换源后 geo 是新 adcode，而 .data.js（关卡 adcodes，按设计不被覆盖）还是旧的，
 *   引擎渲染时 `shapes.get(adcode)` 取到 undefined → 整张地图直接崩，
 *   而且浏览器里只报一句 "Cannot read properties of undefined (reading 'd')"，
 *   不看数据根本猜不到是这个原因。
 *
 * 所以这里把"数据层面的不变量"全部前移成离线断言：
 *   ① 关卡里的 adcode 必须都能在 geo 里找到（否则必崩）
 *   ② geo 里的行政区不能漏在关卡之外（否则会少一块）
 *   ③ 每个行政区都要有资料卡
 *   ④ 关卡内 adcode 不重复
 *   ⑤ 每个地图包都要带来源元信息（MAP_GEO_META），且存储 key 全项目唯一
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const tree = require('./lib/map-tree');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; failures.push(name); console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

/** 在沙箱里跑一份包文件，取出它登记的全局（与 build-registry 同款做法） */
function sandboxLoad(files) {
  const win = {};
  const sb = { window: win, console: { log() {}, warn() {}, error() {} }, document: { currentScript: null } };
  sb.globalThis = sb;
  vm.createContext(sb);
  files.forEach((f) => new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }).runInContext(sb));
  return win;
}

console.log('══════════ 地图包自洽（adcode / 关卡 / 资料 / 来源） ══════════');

const scan = tree.scanMaps();
const slugs = Object.keys(scan.maps).sort(
  (a, b) => (scan.maps[a].adcode || 0) - (scan.maps[b].adcode || 0)
);

const storageKeys = {};
let broken = 0;

slugs.forEach((slug) => {
  const m = scan.maps[slug];
  const base = m.dir ? path.join(tree.MAPS_DIR, m.dir, slug) : path.join(tree.MAPS_DIR, slug);
  const geoFile = base + '.geo.js';
  const dataFile = base + '.data.js';

  if (!fs.existsSync(geoFile) || !fs.existsSync(dataFile)) {
    check(slug + ' 三件套齐全', false, '缺 ' + (!fs.existsSync(geoFile) ? '.geo.js' : '.data.js'));
    broken++;
    return;
  }

  let win;
  try {
    win = sandboxLoad([geoFile, dataFile]);
  } catch (err) {
    check(slug + ' 包文件可求值', false, err.message);
    broken++;
    return;
  }

  const geo = win.MAP_GEO && win.MAP_GEO[slug];
  const data = win.MAP_DATA && win.MAP_DATA[slug];
  if (!geo || !data) {
    check(slug + ' 登记了 MAP_GEO / MAP_DATA', false,
      'geo=' + !!geo + ' data=' + !!data);
    broken++;
    return;
  }

  const geoAdcodes = geo.features.map((f) => f.properties.adcode);
  const geoSet = new Set(geoAdcodes);
  const levelAdcodes = (data.levels || []).flatMap((l) => l.adcodes || []);
  const levelSet = new Set(levelAdcodes);

  // ① 关卡里的 adcode 都能在 geo 里找到 —— 违反必崩
  const missing = [...levelSet].filter((a) => !geoSet.has(a));
  check(slug + ' 关卡的 adcode 都在 geo 里（共 ' + levelSet.size + '）', missing.length === 0,
    'geo 里没有：' + missing.join(', ') + '　← 引擎会崩，通常是换数据源后 adcode 变了');
  if (missing.length) broken++;

  // ② geo 里的行政区不能漏在关卡外（非行政区要素除外，例如全国数据里的境界线）
  const adminGeo = geoAdcodes.filter((a) => /^\d{6}$/.test(String(a)));
  const orphan = adminGeo.filter((a) => !levelSet.has(a));
  check(slug + ' 关卡覆盖全部行政区', orphan.length === 0, '漏在关卡外：' + orphan.join(', '));

  // ③ 每个行政区都有资料卡
  const noCard = adminGeo.filter((a) => !data.districts || !data.districts[a]);
  check(slug + ' 每个行政区都有资料卡', noCard.length === 0, '缺：' + noCard.join(', '));

  // ④ 关卡内 adcode 不重复
  check(slug + ' 关卡内 adcode 不重复', levelAdcodes.length === levelSet.size,
    levelAdcodes.length + ' 个 / 去重 ' + levelSet.size + ' 个');

  // ⑤ 来源元信息（合规声明读它）
  const meta = win.MAP_GEO_META && win.MAP_GEO_META[slug];
  check(slug + ' 带数据来源元信息', !!meta && !!meta.providerLabel,
    meta ? '缺 providerLabel' : '没有 MAP_GEO_META');

  // 存储 key 唯一性（跨地图覆盖会互相冲档）
  const key = base + '.js';
  if (fs.existsSync(key)) {
    const w2 = sandboxLoad([key]);
    const cfg = w2.MAP_PACKAGES && w2.MAP_PACKAGES[slug];
    const save = cfg && cfg.storage && cfg.storage.save;
    if (save) {
      if (storageKeys[save]) {
        check(slug + ' 存储 key 唯一（' + save + '）', false, '与 ' + storageKeys[save] + ' 冲突');
      } else {
        storageKeys[save] = slug;
      }
    }
  }
});

/* 成品口径：不允许"待补充"这类施工痕迹出现在任何资料文件里（换成共建文案）。
 * 注意：这是**措辞**检查，不是内容检查 —— 我们仍然不伪造任何资料。 */
(function checkPlaceholderSoftened() {
  const { execSync } = require('child_process');
  let hits = '';
  try {
    hits = execSync('grep -rl "待补充" js/maps --include=*.data.js || true',
      { cwd: tree.ROOT, encoding: 'utf8' }).trim();
  } catch (e) { hits = ''; }
  check('资料文件里没有"待补充"这类施工痕迹', hits === '', '仍有：' + hits.split('\n').join('、'));
  const build = execSync('grep -rl "欢迎参与共建" js/maps --include=*.data.js || true',
    { cwd: tree.ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
  check('占位资料已统一为共建文案（' + build + ' 个文件）', build > 0, '一个都没有');
})();

/* 九段线专项：中国地图必须包含「南海诸岛及海上界线」这条非行政区要素，
 * 且它的纬度要伸到南海（否则地图范围到不了那里，等于没画）。
 * 官方数据把它作为 MultiLineString 给出，我们在下载时转成了细长多边形并进 geo。 */
(function checkNineDashLine() {
  const chinaFile = path.join(tree.MAPS_DIR, 'china.geo.js');
  if (!fs.existsSync(chinaFile)) return;
  const win = sandboxLoad([chinaFile]);
  const fc = win.MAP_GEO && win.MAP_GEO.china;
  const extra = fc ? fc.features.filter((f) => !/^\d{6}$/.test(String(f.properties.adcode))) : [];
  check('中国地图含非行政区要素（南海诸岛及海上界线）', extra.length > 0,
    '一条都没有 —— 九段线会缺失');
  if (extra.length) {
    let minLat = Infinity;
    const walk = (x) => {
      if (typeof x[0] === 'number') { if (x[1] < minLat) minLat = x[1]; return; }
      x.forEach(walk);
    };
    walk(extra[0].geometry.coordinates);
    check('九段线伸到南海（纬度 < 5°N，实测 ' + minLat.toFixed(2) + '°N）', minLat < 5,
      '最低只到 ' + minLat.toFixed(2) + '°N，说明要素不对');
    check('九段线不参与拼图（非数字 adcode 不进关卡）',
      (win.MAP_DATA && win.MAP_DATA.china ? win.MAP_DATA.china.levels : [])
        .every((l) => l.adcodes.every((a) => /^\d{6}$/.test(String(a)))) ||
      !extra.some((f) => (win.MAP_DATA.china.levels || [])
        .some((l) => l.adcodes.includes(f.properties.adcode))),
      '九段线被塞进关卡了');
  }
})();

/* ------------------------------------------------------------------ *
 * 登记册体积不变量
 * ------------------------------------------------------------------ *
 * registry.js 是**首屏就要下载**的文件，SOP 3.5.5 的承诺是
 * "地图数量再多，首屏也不变重"。这条承诺靠"条目里只放必要字段"维持。
 * 曾经踩过：每条带一个 `scripts` 数组（三个脚本路径），约 96 字节/条 ——
 * 纯冗余（能由 dir + id 推导），23 张时看不出，接满 494 张就是三分之一体积。
 * 下面这条断言把"不存可推导字段"钉住，防止以后有人顺手加回来。
 */
(function () {
  const regFile = path.join(tree.MAPS_DIR, 'registry.js');
  if (!fs.existsSync(regFile)) { check('registry.js 存在', false); return; }
  const src = fs.readFileSync(regFile, 'utf8');
  const bytes = Buffer.byteLength(src, 'utf8');
  const mapCount = (src.match(/"adcode":/g) || []).length;

  check('registry.js 不存可推导的 scripts 字段（首屏体积）',
    !/"scripts"\s*:/.test(src),
    '发现了 scripts 字段：它是 dir + id 的推导结果，不该进 registry');

  // 每条平均超过 600 字节就说明又塞了冗余字段（当前约 300 字节/条）
  const per = mapCount ? bytes / mapCount : 0;
  check('registry.js 单条体积合理（当前 ' + Math.round(per) + ' 字节/条）',
    per < 600,
    '单条 ' + Math.round(per) + ' 字节，偏大 —— 检查是否塞了可推导字段');
})();

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
if (failed) console.log('  失败项：' + failures.join('、'));
if (broken) console.log('  ⚠ 其中有 ' + broken + ' 张地图存在"会让引擎崩"的问题');

module.exports = { passed, failed, failures };
if (require.main === module) process.exit(failed ? 1 : 0);
