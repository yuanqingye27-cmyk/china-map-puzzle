#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 资料缺口清单 —— 精确到"哪个市、哪个区县、缺哪几个字段"
 * ---------------------------------------------------------------------
 * 路径：tools/todo-report.js
 * 用法：
 *   node tools/todo-report.js                      # 打印摘要（按市分组）
 *   node tools/todo-report.js --map=liangshan      # 只看一个市
 *   node tools/todo-report.js --write              # 写入 docs/资料缺口清单.md
 *
 * 【为什么要有它】
 * `tools/status.js` 只给"总共几条没补"；但补资料是**按市**推进的，
 * 而且很多条目是"只缺 funFact、landmark 已有"（有意留空，不是漏做）。
 * 所以需要一个能回答"下一步该跑哪个市、那条缺什么"的清单，
 * 并且要能**落盘存档** —— 否则跨对话/跨天就容易丢失上下文。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');

const FIELDS = ['landmark', 'tagline', 'funFact'];

function parseArgs(argv) {
  const out = { flags: new Set(), values: {} };
  argv.forEach((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out.values[m[1]] = m[2];
    else { const f = /^--([^=]+)$/.exec(a); if (f) out.flags.add(f[1]); }
  });
  return out;
}

/** 逐块解析一个 .data.js：返回 [{adcode, name, missing:[字段]}] */
function scanDataFile(abs) {
  const s = fs.readFileSync(abs, 'utf8');
  const keyRe = /^[ \t]*"(\d{6})"[ \t]*:[ \t]*\{/gm;
  const starts = [];
  let m;
  while ((m = keyRe.exec(s)) !== null) starts.push({ idx: m.index, adcode: m[1] });

  return starts.map((k, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].idx : s.length;
    const block = s.slice(k.idx, end);
    // 行尾注释里的中文名："}, // 市中区"
    const nm = /\},[ \t]*\/\/[ \t]*(\S+)/.exec(block);
    const missing = FIELDS.filter((f) => {
      const r = new RegExp(f + ":[ \\t]*'([^']*)'");
      const v = r.exec(block);
      return !v || v[1].includes('📖');
    });
    return { adcode: k.adcode, name: nm ? nm[1] : '?', missing };
  }).filter((x) => x.missing.length > 0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scan = tree.scanMaps();

  const perMap = [];
  Object.keys(scan.maps).forEach((id) => {
    const m = scan.maps[id];
    const base = m.dir ? path.join(tree.MAPS_DIR, m.dir, id) : path.join(tree.MAPS_DIR, id);
    const file = base + '.data.js';
    if (!fs.existsSync(file)) return;
    const todo = scanDataFile(file);
    if (!todo.length) return;
    perMap.push({ id, name: m.name || id, adcode: m.adcode, todo, file: path.relative(tree.ROOT, file) });
  });
  perMap.sort((a, b) => b.todo.length - a.todo.length);

  const filtered = args.values.map ? perMap.filter((p) => p.id === args.values.map) : perMap;
  const totalEntries = filtered.reduce((n, p) => n + p.todo.length, 0);
  const totalFields = filtered.reduce((n, p) => n + p.todo.reduce((k, t) => k + t.missing.length, 0), 0);

  /* ---------- 终端摘要 ---------- */
  console.log('══════════ 资料缺口清单 ══════════');
  console.log('  待补 ' + totalEntries + ' 条 / ' + totalFields + ' 个字段，涉及 ' + filtered.length + ' 个地图包\n');
  filtered.forEach((p) => {
    const onlyFun = p.todo.filter((t) => t.missing.length === 1 && t.missing[0] === 'funFact').length;
    const onlyTag = p.todo.filter((t) => t.missing.length === 1 && t.missing[0] === 'tagline').length;
    const note = [];
    if (onlyFun) note.push('仅缺冷知识 ' + onlyFun);
    if (onlyTag) note.push('仅缺介绍 ' + onlyTag);
    console.log('  ' + String(p.todo.length).padStart(3) + ' 条  ' + p.id.padEnd(11)
      + '(' + p.name + ')'
      + (note.length ? '　' + note.join('，') : ''));
  });

  if (args.values.map) {
    const p = filtered[0];
    if (p) {
      console.log('\n  ── ' + p.id + ' 明细 ──');
      p.todo.forEach((t) => console.log('    ' + t.adcode + '  ' + t.name.padEnd(12) + '缺：' + t.missing.join('、')));
    }
  } else {
    console.log('\n  看某个市的明细：node tools/todo-report.js --map=<id>');
  }

  /* ---------- 落盘存档 ---------- */
  if (args.flags.has('write')) {
    const outFile = path.join(tree.ROOT, 'docs', '资料缺口清单.md');
    const L = [];
    L.push('# 资料缺口清单（自动生成，勿手改）\n');
    L.push('> 生成：`node tools/todo-report.js --write`　·　' + new Date().toISOString().slice(0, 10));
    L.push('> 待补 **' + totalEntries + '** 条 / **' + totalFields + '** 个字段，涉及 ' + filtered.length + ' 个地图包。\n');
    L.push('> ⚠️ **"缺 funFact / tagline"往往是有意留空**（素材里没有可核实内容，按"宁缺毋假"留空），');
    L.push('> 不一定是漏做。补的时候要能追到可靠来源，否则继续保持占位。\n');
    L.push('| 地图包 | 待补条数 | 其中仅缺冷知识 | 其中仅缺介绍 |');
    L.push('| --- | --- | --- | --- |');
    filtered.forEach((p) => {
      const onlyFun = p.todo.filter((t) => t.missing.length === 1 && t.missing[0] === 'funFact').length;
      const onlyTag = p.todo.filter((t) => t.missing.length === 1 && t.missing[0] === 'tagline').length;
      L.push('| `' + p.id + '`（' + p.name + '） | ' + p.todo.length + ' | ' + onlyFun + ' | ' + onlyTag + ' |');
    });
    L.push('');
    filtered.forEach((p) => {
      L.push('## ' + p.id + ' · ' + p.name + '（待补 ' + p.todo.length + ' 条）\n');
      L.push('文件：`' + p.file + '`\n');
      L.push('| adcode | 名称 | 缺什么 |');
      L.push('| --- | --- | --- |');
      p.todo.forEach((t) => L.push('| ' + t.adcode + ' | ' + t.name + ' | ' + t.missing.join('、') + ' |'));
      L.push('');
    });
    fs.mkdirSync(path.join(tree.ROOT, 'docs'), { recursive: true });
    fs.writeFileSync(outFile, L.join('\n'), 'utf8');
    console.log('\n  已写入 ' + path.relative(tree.ROOT, outFile) + '（' + (fs.statSync(outFile).size / 1024).toFixed(0) + ' KB）');
  }
}

main();
