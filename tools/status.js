#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 项目状态 · 一行命令拿到"现在到哪了、还剩什么"
 * ---------------------------------------------------------------------
 * 路径：tools/status.js
 * 用法：node tools/status.js
 *
 * 为什么要有它：新开一个对话（或换个人接手）时，最贵的是"摸清现状"。
 * 与其让 AI 去读十几个文件、翻 1900 行的 SOP，不如让它跑这一条命令 ——
 * 输出控制在 ~20 行，信息量却覆盖：地图清单、资料缺口、数据源、下一步该敲什么。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tree = require('./lib/map-tree');

const run = (cmd) => {
  try { return execSync(cmd, { cwd: tree.ROOT, encoding: 'utf8' }).trim(); }
  catch (e) { return ''; }
};

const scan = tree.scanMaps();
const maps = Object.values(scan.maps).sort((a, b) => (a.adcode || 0) - (b.adcode || 0));

/* 资料卡缺口：直接走注册表拿文件列表（**不要用 shell 的 `**`**，
 * /bin/sh 下它等价于 `*`，会漏掉 20 个文件 —— 这个 bug 实测踩过）。 */
const dataRel = maps
  .map((m) => (m.dir ? m.dir + '/' : '') + m.id + '.data.js')
  .filter((f) => fs.existsSync(path.join(tree.MAPS_DIR, f)));

const realFiles = [];
let placeholderFiles = 0;
let placeholderEntries = 0;
dataRel.forEach((f) => {
  const t = fs.readFileSync(path.join(tree.MAPS_DIR, f), 'utf8');
  if (t.includes('欢迎参与共建')) {
    placeholderFiles++;
    placeholderEntries += (t.match(/^\s*"\d{6}":/gm) || []).length; // 每条资料卡 = 一个 adcode 键
  } else {
    realFiles.push(f);
  }
});

/* 数据源与合规 */
let manifest = null;
const mf = path.join(tree.ROOT, 'data', 'tianditu-official', 'manifest.json');
if (fs.existsSync(mf)) manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));

/* 官方行政树（缓存）用来算剩余规模 */
let scope = null;
if (fs.existsSync('/tmp/menu.json')) {
  try {
    const portal = require('./lib/tianditu-portal');
    const flat = portal.flattenMenu(JSON.parse(fs.readFileSync('/tmp/menu.json', 'utf8')).data);
    const byDepth = {};
    Object.values(flat).forEach((n) => { byDepth[n.depth] = (byDepth[n.depth] || 0) + 1; });
    const doneAd = new Set(maps.map((m) => m.adcode));
    const cities = Object.values(flat).filter((n) => n.adcode % 100 === 0 && n.adcode % 10000 !== 0);
    scope = {
      total: Object.keys(flat).length,
      province: byDepth[2] || 0,
      city: byDepth[3] || 0,
      county: byDepth[4] || 0,
      cityLeft: cities.filter((n) => !doneAd.has(n.adcode)).length,
    };
  } catch (e) { scope = null; }
}

const line = (k, v) => console.log('  ' + k.padEnd(18) + v);

console.log('══════════ 项目状态 · 地图拼图 v1.0.0 ══════════');
line('版本', run("git describe --tags --always 2>/dev/null") || '（未打 tag）');
line('工作区', (run('git status --porcelain') === '' ? '干净 ✅' : '⚠ 有未提交改动'));
console.log('');
line('已接入地图', maps.length + ' 张');
line('层级', '中国（34 省级）→ 四川省（21 市州）→ 各自区县');
line('地图清单', maps.map((m) => m.id).join(', '));
console.log('');
line('真实资料卡', realFiles.length + ' 个文件：' + (realFiles.map((f) => path.basename(f, '.data.js')).join(', ') || '无'));
line('待补资料卡', placeholderEntries + ' 条（分布在 ' + placeholderFiles + ' 个文件）');
line('资料缺口怎么看', "node tools/soften-placeholders.js --check");
console.log('');
if (manifest) {
  line('数据源', manifest.providerLabel);
  line('审图号', manifest.approval);
  line('官方副本', manifest.summary.downloaded + '/' + manifest.summary.total + ' 张（' +
    String(manifest.generatedAt).slice(0, 10) + '）');
} else {
  line('数据源', '⚠ 缺 data/tianditu-official/manifest.json');
}
if (scope) {
  console.log('');
  line('官方树节点', scope.total + '（省 ' + scope.province + ' / 地级 ' + scope.city + ' / 县级 ' + scope.county + '）');
  line('地级待接入', scope.cityLeft + ' 个');
} else {
  console.log('');
  line('剩余规模', '（缓存 /tmp/menu.json 不在，跑一次 tianditu-download 就有了）');
}
console.log('');
console.log('══════════ 下一步（选一条） ══════════');
console.log('  基线自检      node tools/e2e-test.js 2>&1 | tail -6        （应为 884 通过 / 0 失败）');
console.log('  地图包自检    node tools/test-maps.js 2>&1 | tail -4');
console.log('  P0 补资料卡   编辑 js/maps/china/sichuan/<市>.data.js，填完跑 test-maps.js');
console.log('  P1 接入一个省 先在 tools/lib/slugs.js 补该省地级市拼音，再：');
console.log('                node tools/batch-add-maps.js --parent=<省 adcode>');
console.log('  换一张图的数据 node tools/replace-geo-source.js --source=file --dir=data/tianditu-official --only=<id>');
console.log('');
console.log('  ⚠ 省 token 铁律：跑测试/脚本一律 | tail -N；');
console.log('     js/maps/**/*.geo.js 是单行 100KB+，禁止 cat/head/tail，要用 node 脚本摘要。');
