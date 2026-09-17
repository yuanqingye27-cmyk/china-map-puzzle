#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 面积补全 —— 从官方边界几何算出 area，写进 .data.js
 * ---------------------------------------------------------------------
 * 路径：tools/area-from-geo.js
 * 用法：
 *   node tools/area-from-geo.js --check                  # 只校验计算方法（锚点比对）
 *   node tools/area-from-geo.js --only=leshan            # 预览（不写盘，默认）
 *   node tools/area-from-geo.js --only=leshan --write    # 真正写入
 *   node tools/area-from-geo.js --parent=510000 --write  # 按父级 adcode 批量
 *
 * 【它只改一样东西】：每个 adcode 块里的 `area` 字段（null 或旧数字 → 计算值）。
 * landmark / tagline / funFact **一个字都不碰** —— 那些是人的活，脚本不能编。
 *
 * 【为什么敢批量写】
 *   面积不是"抄来的"，是**从项目自带的官方边界几何算出来的**，
 *   和拼图用的边界严格同源，可复现、可复核（见 tools/lib/geo-area.js 的精度实测）。
 *   工具会在文件头写一段"计算口径"声明，产物不会冒充官方公布值。
 *
 * 【安全网】
 *   写入前会对每个文件做语法检查（new vm.Script），改完再跑整体语法检查；
 *   任何一个文件语法不过就整体中止，不留下半成品。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const tree = require('./lib/map-tree');
const geoArea = require('./lib/geo-area');

const NOTE_TAG = '[area-from-geo]';
const NOTE_BLOCK = [
  ' * ' + NOTE_TAG + ' 面积口径：本文件 area 由 tools/area-from-geo.js 从',
  ' * 《<id>.geo.js》的官方边界几何计算得出（球面多边形面积，与 d3.geoArea 同公式），',
  ' * 与拼图所用边界严格同源、可复现；属"几何计算值"，不等于官方公布的统计口径面积。',
  ' * 重新生成：node tools/area-from-geo.js --only=<id> --write',
].join('\n');

function parseArgs(argv) {
  const out = { flags: new Set(), values: {} };
  argv.forEach((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out.values[m[1]] = m[2];
    else {
      const f = /^--([^=]+)$/.exec(a);
      if (f) out.flags.add(f[1]);
    }
  });
  return out;
}

/** 在沙箱里跑 geo 文件，取出 FeatureCollection */
function loadGeo(absGeoFile, slug) {
  const win = {};
  const sb = { window: win, console: { log() {}, warn() {}, error() {} }, document: { currentScript: null } };
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(fs.readFileSync(absGeoFile, 'utf8'), { filename: absGeoFile }).runInContext(sb);
  const fc = win.MAP_GEO && win.MAP_GEO[slug];
  if (!fc) throw new Error('geo 文件没有登记 MAP_GEO.' + slug);
  return fc;
}

/* ------------------------------------------------------------------ *
 * 同步一个 .data.js：写入 area + 更新文件头口径声明
 * ------------------------------------------------------------------ */

/** 把某个 adcode 块里的 area 值换成 next（保持缩进与行内注释） */
function replaceAreaInBlock(src, adcode, next) {
  // 定位 "adcode": { ... } 块（key 可能带引号也可能不带）
  const keyRe = new RegExp('(^|\\n)([ \\t]*)(?:"' + adcode + '"|' + adcode + ')([ \\t]*):[ \\t]*\\{');
  const km = keyRe.exec(src);
  if (!km) return { src, changed: false, reason: '没找到 adcode ' + adcode + ' 的块' };

  const blockStart = km.index + km[0].length;
  // 块到下一个同缩进的 "adcode: {" 或对象结束为止 —— 用简单扫描找配对花括号
  let depth = 1;
  let i = blockStart;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  const blockEnd = i;
  const block = src.slice(blockStart, blockEnd);

  const areaRe = /^([ \t]*)area[ \t]*:[ \t]*(-?\d+(?:\.\d+)?|null)([ \t]*,)?([ \t]*\/\/[^\n]*)?$/m;
  const am = areaRe.exec(block);
  if (!am) return { src, changed: false, reason: 'adcode ' + adcode + ' 块里没有 area 行' };

  const indent = am[1];
  const oldRaw = am[2];
  const comment = '// 由 tools/area-from-geo.js 依官方边界几何计算（km²）';
  const newLine = indent + 'area: ' + next + ',  ' + comment;

  const oldLine = am[0];
  if (oldRaw === String(next)) return { src, changed: false, reason: '已经是对的（' + next + '）', same: true };

  const newBlock = block.slice(0, am.index) + newLine + block.slice(am.index + oldLine.length);
  return {
    src: src.slice(0, blockStart) + newBlock + src.slice(blockEnd),
    changed: true,
    from: oldRaw,
    to: next,
  };
}

/** 在文件头插入/更新口径声明 */
function upsertNote(src, slug) {
  // 只吃掉「标签行 + 后续连续的 * 注释行」，遇到 `*/` 结尾那行必须停下
  const existing = /[ \t]*\*[ \t]*\[area-from-geo\][^\n]*\n(?:[ \t]*\*(?![ \t]*\/)[^\n]*\n)*/;
  const block = NOTE_BLOCK.replace(/<id>/g, slug) + '\n';
  if (existing.test(src)) return src.replace(existing, block);
  // 插到头部注释块内部：第一条 ` * =====` 结尾行之前
  const anchor = /\n[ \t]*\*[ \t]*=+[ \t]*\*\//;
  if (!anchor.test(src)) return src;
  return src.replace(anchor, '\n' + block + '$&');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const checkOnly = args.flags.has('check');
  const doWrite = args.flags.has('write');
  const only = args.values.only ? String(args.values.only).split(',') : null;
  const parent = args.values.parent || null;

  const scan = tree.scanMaps();
  const allIds = Object.keys(scan.maps).sort();

  /* ---------- --check：只校验计算方法 ---------- */
  if (checkOnly) {
    console.log('══════════ 面积计算方法校验（与官方公布值比对） ══════════');
    let pass = 0;
    let fail = 0;
    const anchorParent = String(geoArea.REFERENCE_ANCHORS.find((a) => a.sumOf)?.sumOf || '');
    const cached = {};

    geoArea.REFERENCE_ANCHORS.forEach((a) => {
      // 找到包含该 adcode 的地图包
      const owner = allIds.find((id) => {
        const m = scan.maps[id];
        const base = m.dir ? path.join(tree.MAPS_DIR, m.dir, id) : path.join(tree.MAPS_DIR, id);
        if (!fs.existsSync(base + '.geo.js')) return false;
        try { cached[id] = cached[id] || geoArea.areasFromFeatureCollection(loadGeo(base + '.geo.js', id)); }
        catch { return false; }
        return a.adcode === null ? String(m.adcode) === anchorParent : cached[id][a.adcode] !== undefined;
      });

      if (!owner) { fail++; console.log('  ✘ ' + a.label + '  → 找不到对应的地图包'); return; }

      const computed = a.adcode === null
        ? Object.values(cached[owner]).reduce((s, v) => s + v, 0)
        : cached[owner][a.adcode];
      const diff = Math.abs(computed - a.official);
      const ok = diff <= a.tolerance;
      if (ok) { pass++; console.log('  ✔ ' + a.label + '：计算 ' + Math.round(computed) + ' / 官方 ' + a.official + '（差 ' + Math.round(diff) + '）'); }
      else { fail++; console.log('  ✘ ' + a.label + '：计算 ' + Math.round(computed) + ' / 官方 ' + a.official + '（差 ' + Math.round(diff) + ' > 容差 ' + a.tolerance + '）'); }
    });

    console.log('\n  → ' + pass + ' 通过 / ' + fail + ' 失败');
    process.exitCode = fail ? 1 : 0;
    return;
  }

  /* ---------- 选哪些地图 ---------- */
  let targets = allIds;
  if (only) targets = targets.filter((id) => only.includes(id));
  if (parent) targets = targets.filter((id) => String(scan.maps[id].adcode || '').startsWith(String(parent)));

  if (!targets.length) {
    console.error('没有匹配的地图包（--only=' + (only || '') + ' --parent=' + (parent || '') + '）');
    process.exitCode = 1;
    return;
  }

  console.log('══════════ 面积补全（几何计算 → .data.js） ══════════');
  console.log('  模式：' + (doWrite ? '写入' : '预览（加 --write 才落盘）') + '　目标：' + targets.join(', ') + '\n');

  const pending = []; // { file, src, slug, rows }
  let totalFilled = 0;
  let totalSkipped = 0;

  targets.forEach((slug) => {
    const m = scan.maps[slug];
    const base = m.dir ? path.join(tree.MAPS_DIR, m.dir, slug) : path.join(tree.MAPS_DIR, slug);
    const geoFile = base + '.geo.js';
    const dataFile = base + '.data.js';
    if (!fs.existsSync(geoFile) || !fs.existsSync(dataFile)) {
      console.log('  · ' + slug + ' 跳过（三件套不全）');
      return;
    }

    let areas;
    try {
      areas = geoArea.areasFromFeatureCollection(loadGeo(geoFile, slug));
    } catch (err) {
      console.log('  ✘ ' + slug + ' 读取几何失败：' + err.message);
      process.exitCode = 1;
      return;
    }

    let src = fs.readFileSync(dataFile, 'utf8');
    const original = src;
    const rows = [];
    Object.keys(areas).forEach((adcode) => {
      const r = replaceAreaInBlock(src, adcode, areas[adcode]);
      if (r.changed) { src = r.src; totalFilled++; rows.push(['  ', adcode, r.from + ' → ' + r.to]); }
      else if (r.same) { totalSkipped++; rows.push(['· ', adcode, '已一致 ' + areas[adcode]]); }
      else { rows.push(['✘ ', adcode, r.reason]); }
    });
    src = upsertNote(src, slug);

    const changed = src !== original;
    const label = doWrite ? (changed ? '写入' : '无变化') : (changed ? '待写入' : '无变化');
    console.log('  ' + slug + '（' + Object.keys(areas).length + ' 个下级）：' + label);
    rows.forEach((r) => console.log('    ' + r[0] + ' ' + r[1] + '  ' + r[2]));

    if (changed) pending.push({ file: dataFile, src, slug });
  });

  console.log('\n  合计：' + totalFilled + ' 处待写 / ' + totalSkipped + ' 处已一致 / ' + pending.length + ' 个文件有变化');

  if (!doWrite) {
    console.log('  （预览模式，未落盘。确认无误后加 --write）');
    return;
  }
  if (!pending.length) { console.log('  没有需要写入的文件。'); return; }

  // 写入前全部语法预检，避免留下半成品
  const bad = [];
  pending.forEach((p) => {
    try { new vm.Script(p.src, { filename: p.file }); }
    catch (err) { bad.push(p.file + '：' + err.message); }
  });
  if (bad.length) {
    console.error('\n  ✘ 语法预检失败，已整体中止（未写任何文件）：');
    bad.forEach((b) => console.error('    ' + b));
    process.exitCode = 1;
    return;
  }

  pending.forEach((p) => {
    fs.writeFileSync(p.file, p.src, 'utf8');
    console.log('  ✔ 已写入 ' + path.relative(tree.ROOT, p.file));
  });
  console.log('\n  下一步：node tools/test-maps.js 2>&1 | tail -4');
}

main();
