#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 修补地图包显示名（slug → 官方中文名）
 * ---------------------------------------------------------------------
 * 用法：
 *   node tools/repair-map-names.js          # 只看（列出会改哪些）
 *   node tools/repair-map-names.js --write  # 真改
 *
 * 【背景】生成器原先只有一条取显示名的路径：向父级的 geo 借。
 * 而省级地图是**单独**接入的，批处理到它时"父级 features 缓存"是空的 ——
 * 借不到就静默用了 slug（`hebei` / `shijiazhuang`…），
 * 于是整个地图选择器里全是拼音。这个 bug 从"接第二个省"就存在，
 * 直到看界面才发现（见 docs/ 与 SOP）。
 *
 * 【为什么不用 add-map.js --force 重刷】
 * `--force` 会**连 .data.js 一起覆盖**，把已补的资料文案清成占位。
 * 这里只做**外科式修补**：改 .js 配置里的两个名字字段，资料文件一个字不碰。
 *
 * 改的是两处（都只影响显示）：
 *   CONFIG.name        → 面包屑 / 标题栏 / 欢迎动画
 *   texts.cityName     → 引擎内部文案
 * 关卡与资料里不含名字，不需要动。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');
const NAME_MAP = require('./lib/name-map.json');

const doWrite = process.argv.includes('--write');

const scan = tree.scanMaps();
const changes = [];
const skipped = [];

Object.keys(scan.maps).sort().forEach((id) => {
  const m = scan.maps[id];
  const base = m.dir ? path.join(tree.MAPS_DIR, m.dir, id) : path.join(tree.MAPS_DIR, id);
  const cfgFile = base + '.js';
  if (!fs.existsSync(cfgFile)) return;

  const want = NAME_MAP[String(m.adcode)];
  if (!want) { skipped.push(id + '（地名表里没有 ' + m.adcode + '）'); return; }

  const src = fs.readFileSync(cfgFile, 'utf8');
  // 两个字段的字面量：name: 'xxx',  /  cityName: 'xxx',
  const reName = /(\n\s*name:\s*')([^']*)(')/;
  const reCity = /(\n\s*cityName:\s*')([^']*)(')/;
  const mName = reName.exec(src);
  const mCity = reCity.exec(src);
  if (!mName || !mCity) { skipped.push(id + '（配置里找不到 name/cityName 字段）'); return; }

  const cur = mName[2];
  if (cur === want && mCity[2] === want) return;   // 已经对了

  changes.push({ id, file: cfgFile, from: cur, to: want, src, mName, mCity });
});

console.log('══════════ 修补地图显示名 ══════════');
console.log('  需要修 ' + changes.length + ' 张，已正确 ' +
  (Object.keys(scan.maps).length - changes.length - skipped.length) + ' 张\n');

changes.slice(0, 20).forEach((c) => console.log('  ' + c.id.padEnd(16) + c.from + ' → ' + c.to));
if (changes.length > 20) console.log('  …还有 ' + (changes.length - 20) + ' 张');

if (skipped.length) {
  console.log('\n  ⚠ 跳过 ' + skipped.length + ' 张：');
  skipped.slice(0, 10).forEach((s) => console.log('    · ' + s));
  console.log('    （新地区先跑 node tools/gen-name-map.js 补地名表）');
}

if (!doWrite) { console.log('\n  （预览模式，加 --write 真改）'); process.exit(0); }

let done = 0;
changes.forEach((c) => {
  // 逐个替换：只动那两个字段的值，其余字节原样保留
  let out = c.src
    .replace(c.mName[0], c.mName[1] + c.to + c.mName[3])
    .replace(c.mCity[0], c.mCity[1] + c.to + c.mCity[3]);
  fs.writeFileSync(c.file, out, 'utf8');
  done++;
});
console.log('\n  ✔ 已修 ' + done + ' 张地图包的显示名');
console.log('  下一步：node tools/build-registry.js（登记册要跟着更新）');
