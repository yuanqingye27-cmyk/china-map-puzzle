#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 重排关卡分组（只动 levels，**一个字都不碰资料**）
 * ---------------------------------------------------------------------
 * 用法：
 *   node tools/regroup-levels.js                 # 只看会改哪些
 *   node tools/regroup-levels.js --write          # 真改
 *   node tools/regroup-levels.js --only=chengdu   # 只处理指定地图
 *
 * 【为什么需要它】
 * 关卡分组逻辑（`add-map.js` 的 autoLevels）从"每 8 个一组"改成了
 * "按行政类型（市辖区 / 县级市 / 县）"之后，**已有的 363 张地图不会自动更新** ——
 * 因为它们是在旧规则下生成的。
 *
 * 【为什么不用 add-map.js --force 重刷】
 * `--force` 会把 .data.js 整个覆盖，**把已补的资料文案清成占位**。
 * 这里只做外科式替换：定位 `const LEVELS = [...]` 这一段，用新分组换掉，
 * DISTRICTS（资料）原样保留。
 *
 * 【安全网】改完做语法预检；并且断言"资料块字节数不变"，
 * 避免手滑把 DISTRICTS 也动了。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const tree = require('./lib/map-tree');
const { autoLevels, renderLevelsSource } = require('./add-map');

const doWrite = process.argv.includes('--write');
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const only = onlyArg ? onlyArg.split(',') : null;

/** 在沙箱里取一张地图的 geo features（只读 geo 文件，快速） */
function loadFeatures(absGeo, slug) {
  const win = {};
  const sb = { window: win, console: { log() {}, warn() {}, error() {} }, document: { currentScript: null } };
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(fs.readFileSync(absGeo, 'utf8'), { filename: absGeo }).runInContext(sb);
  const fc = win.MAP_GEO && win.MAP_GEO[slug];
  return fc ? fc.features : null;
}

const scan = tree.scanMaps();
const ids = Object.keys(scan.maps).sort().filter((id) => !only || only.includes(id));

const plan = [];
const skips = [];

ids.forEach((id) => {
  const m = scan.maps[id];
  const base = m.dir ? path.join(tree.MAPS_DIR, m.dir, id) : path.join(tree.MAPS_DIR, id);
  const geoFile = base + '.geo.js';
  const dataFile = base + '.data.js';
  if (!fs.existsSync(geoFile) || !fs.existsSync(dataFile)) { skips.push(id + '（缺三件套）'); return; }

  const features = loadFeatures(geoFile, id);
  if (!features || !features.length) { skips.push(id + '（geo 里没有 feature）'); return; }

  const src = fs.readFileSync(dataFile, 'utf8');
  /* 定位 `const LEVELS = [` … 到配对的 `];`
   * 正则要容忍两种缩进风格：自动生成的是两空格，手写的可能有四空格。 */
  const startM = /(\n[ \t]*const LEVELS = \[\n)([\s\S]*?)(\n[ \t]*\];)/.exec(src);
  if (!startM) { skips.push(id + '（找不到 LEVELS 段）'); return; }

  /* 【护栏：绝不覆盖人工编写的关卡】
   * 自动生成的关卡 id 规律是 l1 / l2 / l3…；一旦看到别的 id（如成都的
   * `core` / `inner` / `outer`），说明这一份是**人按地理/文化逻辑手写的**，
   * 那正是这个项目最值钱的东西，脚本一律不碰。
   * 实测：成都的关卡是"第一关 · 中心城区（锦江/青羊/金牛/武侯/成华，
   * 边界犬牙交错、最难拼的一组）"这种带解释的分组 —— 机械分组永远比不上它。 */
  const allIds = (startM[2].match(/id: '([a-zA-Z0-9_]+)'/g) || [])
    .map((x) => x.replace(/id: '/, '').replace(/'$/, ''));
  const handWritten = allIds.filter((x) => !/^l\d+$/.test(x));
  if (handWritten.length) {
    skips.push(id + '（关卡是人工编写的：' + handWritten.join('/') + ' —— 保护，不改）');
    return;
  }

  const levels = autoLevels(features, m.adcode);
  if (!levels.length) { skips.push(id + '（算不出关卡）'); return; }
  const rendered = renderLevelsSource(levels);

  // 新分组必须与原分词集合完全一致 —— 否则会丢块或加块
  const oldAds = (startM[2].match(/\d{6}/g) || []).map(Number).sort((a, b) => a - b).join(',');
  const newAds = levels.reduce((acc, l) => acc.concat(l.adcodes), []).sort((a, b) => a - b).join(',');
  if (oldAds !== newAds) {
    skips.push(id + '（adcode 集合会变，拒绝改：' + levels.length + ' 关）');
    return;
  }

  const next = src.replace(startM[0], startM[1] + rendered + startM[3]);

  /* 【安全断言】把 LEVELS 段挖掉之后，改前改后必须**逐字节一致**。
   * 为什么用这个写法而不是"检查 DISTRICTS 段没变"：
   *   老地图（成都）的资料容器叫 `DISTRICT_INFO` 而不是 `DISTRICTS` ——
   *   按名字写死会漏判，而"除了 LEVELS 之外一个字节都不许变"是更强的保证，
   *   且不依赖任何命名约定。 */
  const stripLevels = (s) => s.replace(/const LEVELS = \[[\s\S]*?\n[ \t]*\];/, 'const LEVELS = [];');
  if (stripLevels(next) !== stripLevels(src)) {
    skips.push(id + '（LEVELS 之外的字节被改动了，拒绝写）');
    return;
  }
  // 断言：语法必须通过
  try { new vm.Script(next, { filename: dataFile }); }
  catch (e) { skips.push(id + '（语法预检失败：' + e.message + '）'); return; }

  const oldLevelCount = (startM[2].match(/id: 'l\d+'/g) || []).length;

  if (next === src && oldLevelCount === levels.length) return;   // 已经一样
  plan.push({ id, file: dataFile, from: oldLevelCount, to: levels.length, names: levels.map((l) => l.name).join(' / '), next });
});

console.log('══════════ 重排关卡分组 ══════════');
console.log('  会修改 ' + plan.length + ' 张地图\n');
plan.slice(0, 25).forEach((p) => console.log('  ' + p.id.padEnd(16) + p.from + ' 关 → ' + p.to + ' 关：' + p.names));
if (plan.length > 25) console.log('  …还有 ' + (plan.length - 25) + ' 张');

if (skips.length) {
  console.log('\n  ⚠ 跳过 ' + skips.length + ' 张：');
  skips.slice(0, 8).forEach((s) => console.log('    · ' + s));
}

if (!doWrite) { console.log('\n  （预览模式，加 --write 真改）'); process.exit(0); }

let done = 0;
plan.forEach((p) => { fs.writeFileSync(p.file, p.next, 'utf8'); done++; });
console.log('\n  ✔ 已重排 ' + done + ' 张地图的关卡分组（资料一个字没动）');
console.log('  下一步：node tools/test-maps.js 2>&1 | tail -3');
