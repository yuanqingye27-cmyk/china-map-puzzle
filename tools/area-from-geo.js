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
/* 面积行的来源标记：带这个标记的行 = 本工具算的，可以安全刷新；
 * 不带标记的 area 数字 = 人工填的，默认不动（见 replaceAreaInBlock 的说明）。
 * 老版本写的注释里没有这个标记，所以升级后它们会被当成人工内容 —— 这是**故意保守**：
 * 只会「少改」，不会「改错」。 */
const MARK = '[geo-area]';
const COMMENT_TEXT = '// ' + MARK + ' 依官方边界几何计算（km²）';
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
function replaceAreaInBlock(src, adcode, next, forceHuman) {
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
  const oldLine = am[0];
  const oldComment = am[4] || '';

  /* ---- 安全闸门：分不清来源的数字，一律当成人工内容，默认不动 ----
   * 实测教训：早期版本「只要值不一样就覆盖」，把成都 20 个区县**人工核实过的面积**
   * （锦江 62.0）改成了几何计算值（60.8）—— 违反项目「脚本不覆盖人工文件」的原则。
   * 现在用行内标记区分来源：
   *   带 MARK 的行 = 本工具算出来的 → 可以随边界更新自动刷新
   *   不带标记的数字 = 人工填的     → 只有显式 --overwrite-human 才动
   *   null                        = 占位，直接补  */
  if (oldRaw !== 'null' && !oldComment.includes(MARK) && !forceHuman) {
    return { src, changed: false, reason: '人工已填 ' + oldRaw + '（默认不动，需 --overwrite-human）', human: true };
  }
  if (oldRaw === String(next) && oldComment.includes(MARK)) {
    return { src, changed: false, reason: '已经是对的（' + next + '）', same: true };
  }

  const newLine = indent + 'area: ' + next + ',  ' + COMMENT_TEXT;
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

/**
 * 解析 --parent=<adcode> 应该选中哪些地图。
 *
 * ⚠️ 这里有个**实测踩到的坑**：不能拿 adcode 前缀当父子关系。
 *    乐山 511100 的父级四川是 510000，而 511100 **不以 510000 开头** ——
 *    按前缀过滤会一张都匹配不到（`--parent=510000` 只命中省本级自己）。
 * 所以父子关系一律走**包配置里声明的 parent**（真相来源，与登记册同一份数据）。
 * 若该 adcode 还没有对应的地图包（准备新接一个省时），退回官方 adcode 的行政区划规则：
 *   省级 x0000 → 地级 xX00；地级 xx00 → 县级 xxxx（同两位前缀）。
 */
function resolveParentTargets(scan, parentAdcode) {
  const parentStr = String(parentAdcode);
  if (!/^\d{6}$/.test(parentStr)) throw new Error('--parent 必须是 6 位 adcode，例如 --parent=510000');

  const parentSlug = Object.keys(scan.maps).find((id) => String(scan.maps[id].adcode) === parentStr);
  if (parentSlug) {
    const kids = Object.keys(scan.maps).filter((id) => scan.maps[id].parent === parentSlug).map((id) => scan.maps[id]);
    // 该地图的区县已写在它自己的 .data.js 里（叶子地图，如各市）→ 直接处理它本人
    if (kids.length) return kids;
    return [scan.maps[parentSlug]];
  }

  const isProvince = Number(parentStr) % 10000 === 0;
  const prefix = parentStr.slice(0, 2);
  return Object.keys(scan.maps)
    .map((id) => scan.maps[id])
    .filter((m) => {
      if (!m.adcode) return false;
      const ad = String(m.adcode);
      return isProvince ? ad.slice(0, 2) === prefix && ad !== parentStr
                        : ad.slice(0, 2) === prefix;
    });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const checkOnly = args.flags.has('check');
  const doWrite = args.flags.has('write');
  const only = args.values.only ? String(args.values.only).split(',') : null;
  const parent = args.values.parent || null;
  /* 危险开关：连"人工填过"的面积一起覆盖。默认关。
   * 正常情况下**不需要**它：新地图面积是 null、本工具自己写的带 [geo-area] 标记，
   * 两类都能正常更新；只有你确实要丢弃人工数值时才用。 */
  const forceHuman = args.flags.has('overwrite-human');

  const scan = tree.scanMaps();
  const allIds = Object.keys(scan.maps).sort();

  /* ---------- --check：只校验计算方法 ---------- */
  if (checkOnly) {
    console.log('══════════ 面积计算方法校验（与官方公布值比对） ══════════');
    let pass = 0;
    let fail = 0;
    const cached = {};

    /* 把每个地图包的几何预算出来（含它下级的面积表） */
    allIds.forEach((id) => {
      const m = scan.maps[id];
      const base = m.dir ? path.join(tree.MAPS_DIR, m.dir, id) : path.join(tree.MAPS_DIR, id);
      if (!fs.existsSync(base + '.geo.js')) return;
      try { cached[id] = geoArea.areasFromFeatureCollection(loadGeo(base + '.geo.js', id)); }
      catch { /* 几何读不出来就跳过，锚点会报"找不到" */ }
    });

    /* 锚点可以指向任意一层，所以这里按"哪个地图包里有这个 adcode"来找，
     * 而不是按"哪个包自己的 adcode 等于它" —— 市级面积写在**省**的 .data.js 里，
     * 不在市自己的包里（见坑：--parent 一度只命中省本级）。 */
    geoArea.REFERENCE_ANCHORS.forEach((a) => {
      const ownerOfKey = (k) => allIds.find((id) => cached[id] && cached[id][k] !== undefined);
      /* 求和锚点：要的是"父级自身地图"的下级之和（乐山 511100 → leshan 包的 11 个区县），
       * 不能按"含这个 adcode 的包"去找 —— 那样会找到省包（四川里恰好也有 511100 这条） */
      const ownerSum = (adcode) => allIds.find((id) => String(scan.maps[id].adcode) === String(adcode) && cached[id]);
      const owner = a.adcode !== null ? ownerOfKey(String(a.adcode)) : ownerSum(a.sumOf);

      if (!owner) { fail++; console.log('  ✘ ' + a.label + '  → 找不到对应的地图包'); return; }

      const computed = a.adcode !== null
        ? cached[owner][String(a.adcode)]
        : Object.values(cached[owner]).reduce((s, v) => s + v, 0);
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
  if (parent) {
    const picked = resolveParentTargets(scan, parent);
    if (!picked.length) {
      console.error('--parent=' + parent + ' 没有匹配到任何地图包');
      console.error('  提示：父子关系看包配置的 parent 字段；先确认父级已接入（node tools/status.js）');
      process.exitCode = 1;
      return;
    }
    targets = picked.map((m) => m.id).sort();
  }

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
    let humanKept = 0;
    let wrote = 0;
    Object.keys(areas).forEach((adcode) => {
      const r = replaceAreaInBlock(src, adcode, areas[adcode], forceHuman);
      if (r.changed) { src = r.src; totalFilled++; wrote++; rows.push(['  ', adcode, r.from + ' → ' + r.to]); }
      else if (r.same) { totalSkipped++; rows.push(['· ', adcode, '已一致 ' + areas[adcode]]); }
      else if (r.human) { humanKept++; rows.push(['🔒', adcode, r.reason]); }
      else { rows.push(['✘ ', adcode, r.reason]); }
    });
    /* 只有**真的写了本工具算出来的值**才加口径声明。
     * 否则会给一个「面积全是人工填的」文件（如成都）贴上"由工具计算"的假溯源。 */
    if (wrote) src = upsertNote(src, slug);

    const changed = src !== original;
    const label = doWrite ? (changed ? '写入' : '无变化') : (changed ? '待写入' : '无变化');
    console.log('  ' + slug + '（' + Object.keys(areas).length + ' 个下级）：' + label
      + (humanKept ? '　🔒 保护人工值 ' + humanKept + ' 处' : ''));
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
