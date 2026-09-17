#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 生成行政地名表 —— adcode → 官方中文名
 * ---------------------------------------------------------------------
 * 用法：node tools/gen-name-map.js
 * 产出：tools/lib/name-map.json
 *
 * 【为什么需要它】
 * 地图包的显示名（`cityName` / `name`）本该是中文（"石家庄市"），
 * 但生成器原先只有一条取得路径：**向父级的 geo 借**。
 * 而省级地图是单独接入的，批处理到它时"父级 features 缓存"是空的 ——
 * 借不到就**静默兜底成 slug**，于是菜单里全是拼音（hebei / shijiazhuang / xingtai…）。
 * 这个 bug 从"接第二个省"起就存在，但直到看到界面才被发现。
 *
 * 官方行政树（/tmp/menu.json，由 tianditu-download 抓取）里本来就有全部中文名，
 * 所以这里把它固化成一张表，让生成器**有一条可靠的兜底路径**，
 * 不再依赖"父级的缓存恰好还在"。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MENU = '/tmp/menu.json';
const OUT = path.join(__dirname, 'lib', 'name-map.json');

if (!fs.existsSync(MENU)) {
  console.error('✘ 缺 ' + MENU + '（官方行政树缓存）。');
  console.error('  它由 tools/tianditu-download.js 抓取时写入；没有它就无法生成名称表。');
  console.error('  临时办法：手工维护 tools/lib/name-map.json，至少把省级 34 个补齐。');
  process.exit(1);
}

const portal = require('./lib/tianditu-portal');
const flat = portal.flattenMenu(JSON.parse(fs.readFileSync(MENU, 'utf8')).data);

const map = {};
Object.values(flat).forEach((n) => {
  if (n && n.adcode && n.name) map[String(n.adcode)] = n.name;
});

fs.writeFileSync(OUT, JSON.stringify(map, null, 0) + '\n', 'utf8');
const bytes = fs.statSync(OUT).size;
console.log('✔ 已写入 ' + path.relative(ROOT, OUT));
console.log('  条目 ' + Object.keys(map).length + ' 个（' + (bytes / 1024).toFixed(0) + ' KB）');
console.log('  抽查：' + ['130000', '130100', '110000', '510100', '513400']
  .map((a) => a + '=' + (map[a] || '?')).join('  '));
