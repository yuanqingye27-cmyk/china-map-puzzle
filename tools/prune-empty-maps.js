#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 清理"空地图" —— 没有下级行政区、做不成拼图的地图包
 * ---------------------------------------------------------------------
 * 路径：tools/prune-empty-maps.js
 * 用法：
 *   node tools/prune-empty-maps.js            # 只看（列出会删哪些）
 *   node tools/prune-empty-maps.js --write    # 真删
 *
 * 【为什么会有空地图】
 * 批量接地图时是"把某个父级的子级各建一张地图包"。但对**直辖市的市辖区**
 * （东城区/浦东新区…）和**港澳台的下级**来说，它们下面**没有更深一级**，
 * 于是生成的 `<id>.data.js` 里 `DISTRICTS = {}`、`LEVELS = []` 全空。
 *
 * 后果不是"没内容"，而是**会崩**：引擎要按关卡找 adcode，
 * `LEVELS.find(...)` 得到 undefined，紧接着读 `.adcodes` 就抛
 * `Cannot read properties of undefined (reading 'adcodes')`。
 *
 * 【为什么不改引擎去容错】
 * `js/engine.js` 是本项目的红线（见 HANDOVER 硬性约束）。
 * 而且"0 块碎片的拼图"本身就没有存在意义 —— 玩家点进去什么也玩不了。
 * 这些区县并不是丢了：它们已经作为**上级地图的碎片**存在
 * （北京地图的 16 块碎片就是东城区、西城区…）。
 *
 * 【判定】DISTRICTS 与 LEVELS 同时为空 → 空地图。
 * 只删"三件套"里属于它自己的文件，不动父级。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');

const doWrite = process.argv.includes('--write');

/** 空地图判定：两个数据容器都是空的 */
function isEmptyData(absData) {
  const t = fs.readFileSync(absData, 'utf8');
  const emptyDistricts = /const DISTRICTS = \{\s*\}\s*;/.test(t);
  const emptyLevels = /const LEVELS = \[\s*\]\s*;/.test(t);
  return emptyDistricts && emptyLevels;
}

const scan = tree.scanMaps();
const empties = [];

Object.keys(scan.maps).sort().forEach((id) => {
  const m = scan.maps[id];
  const base = m.dir ? path.join(tree.MAPS_DIR, m.dir, id) : path.join(tree.MAPS_DIR, id);
  const dataFile = base + '.data.js';
  if (!fs.existsSync(dataFile)) return;
  if (!isEmptyData(dataFile)) return;
  empties.push({
    id,
    name: m.name,
    dir: m.dir,
    parent: m.parent,
    files: [base + '.js', base + '.geo.js', base + '.data.js'].filter((f) => fs.existsSync(f)),
  });
});

console.log('══════════ 空地图清理 ══════════');
if (!empties.length) { console.log('  没有空地图（很好）。'); process.exit(0); }

console.log('  发现 ' + empties.length + ' 张（无下级行政区 → LEVELS 为空 → 引擎会抛 adcodes 错误）\n');
const byParent = {};
empties.forEach((e) => { (byParent[e.parent] = byParent[e.parent] || []).push(e.name); });
Object.entries(byParent).forEach(([p, names]) => {
  console.log('  ' + p + '（' + names.length + '）: ' + names.slice(0, 8).join(' ') + (names.length > 8 ? ' …' : ''));
});

console.log('\n  说明：这些区县没丢 —— 它们已经是**上级地图的碎片**（如北京地图的 16 块）。');

if (!doWrite) {
  console.log('\n  （预览模式，加 --write 真删）');
  process.exit(0);
}

let removed = 0;
empties.forEach((e) => e.files.forEach((f) => { fs.unlinkSync(f); removed++; }));

// 目录空了就顺手清掉（不递归删非空目录）
const dirs = new Set(empties.map((e) => e.dir).filter(Boolean));
dirs.forEach((d) => {
  const abs = path.join(tree.MAPS_DIR, d);
  try { if (fs.existsSync(abs) && !fs.readdirSync(abs).length) fs.rmdirSync(abs); } catch { /* 忽略 */ }
});

console.log('\n  ✔ 已删除 ' + empties.length + ' 张空地图、' + removed + ' 个文件');
console.log('  下一步：node tools/build-registry.js　然后跑测试');
