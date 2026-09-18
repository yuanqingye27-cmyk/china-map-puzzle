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

/* 资料卡缺口：**按"条"统计，而不是按"文件"**
 * 早期版本把"含共建文案的文件"整份算成占位、其余算成真实，
 * 于是**混合文件（同一个市里有的区县补了、有的没补）会被两边都漏掉**，
 * 已补的条目数被低估。现在改成逐条判断：
 *   每条资料卡 = 一个 adcode 键；每条 3 个文案字段（landmark/tagline/funFact）
 *   占位条数 = 共建文案出现次数 / 3；真实条数 = 总条数 − 占位条数。
 * （注意：找文件列表时**不要用 shell 的 `**`** —— /bin/sh 下它等价于 `*`，
 *   会漏掉 20 个子目录里的文件，这个 bug 实测踩过。） */
const dataRel = maps
  .map((m) => (m.dir ? m.dir + '/' : '') + m.id + '.data.js')
  .filter((f) => fs.existsSync(path.join(tree.MAPS_DIR, f)));

const BUILD_TEXT = '📖 资料收录中，欢迎参与共建';
let placeholderEntries = 0;   // 三段文案里只要还有占位，就算"待补"
let placeholderFiles = 0;     // 整份文件一条都没补
let realEntries = 0;          // 四要素全部有值
let areaFilled = 0;           // area 有值（含脚本算的）
let textPlaceholder = 0;      // 文案字段里还有占位的字段数（landmark/tagline/funFact 合计）
const realFiles = [];
const mixedFiles = [];
dataRel.forEach((f) => {
  const t = fs.readFileSync(path.join(tree.MAPS_DIR, f), 'utf8');

  /* 逐块精确统计，而不是把全文出现次数除以 3 估算 ——
   * 面积补完后，一个文件里"area 有值、文案还是占位"是常态，
   * 估算会把它算成占位整块，看不出面积进度。 */
  const blocks = [];
  const keyRe = /^[ \t]*(?:"(\d{6})"|(\d{6}))[ \t]*:[ \t]*\{/gm;
  let km;
  while ((km = keyRe.exec(t)) !== null) {
    const start = km.index + km[0].length;
    let depth = 1;
    let i = start;
    while (i < t.length && depth > 0) {
      if (t[i] === '{') depth++;
      else if (t[i] === '}') depth--;
      i++;
    }
    blocks.push(t.slice(start, i));
  }
  if (!blocks.length) return;

  let phBlocks = 0;
  let phFields = 0;
  blocks.forEach((b) => {
    const phHere = b.split(BUILD_TEXT).length - 1;
    phFields += phHere;
    if (phHere > 0) phBlocks++;
    if (!/^[ \t]*area[ \t]*:[ \t]*null/m.test(b)) areaFilled++;
  });
  placeholderEntries += phBlocks;
  realEntries += blocks.length - phBlocks;
  textPlaceholder += phFields;
  if (phBlocks === 0) realFiles.push(f);
  else if (phBlocks < blocks.length) mixedFiles.push(f + '（已补 ' + (blocks.length - phBlocks) + '/' + blocks.length + '）');
  else if (areaFilled) mixedFiles.push(f + '（面积已补，文案待补 ' + blocks.length + '）');
  else placeholderFiles++;
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
    /* "有下级"的判定：有任何一个节点的 parentAdcode 指向它。
     * 【为什么要这一条】官方树里有 7 个"没有下级"的地级单位
     * （东莞/中山/儋州/嘉峪关 + 甘肃 3 个保护区）—— 它们按项目规则
     * **不单独建地图**，而是作为上级地图里的一块碎片存在。
     * 如果照"adcode 没出现过就算待接入"来数，这 7 个会永远挂着，
     * 让人以为还有活没干完（这个误报我自己看了两天才反应过来）。 */
    const hasChild = new Set();
    Object.values(flat).forEach((n) => {
      if (n.parentAdcode) hasChild.add(n.parentAdcode);
    });
    const cities = Object.values(flat).filter((n) => n.adcode % 100 === 0 && n.adcode % 10000 !== 0);
    const notDone = cities.filter((n) => !doneAd.has(n.adcode));
    scope = {
      total: Object.keys(flat).length,
      province: byDepth[2] || 0,
      city: byDepth[3] || 0,
      county: byDepth[4] || 0,
      cityLeft: notDone.filter((n) => hasChild.has(n.adcode)).length,
      cityNoChild: notDone.filter((n) => !hasChild.has(n.adcode)).length,
    };
  } catch (e) { scope = null; }
}

const line = (k, v) => console.log('  ' + k.padEnd(18) + v);

/* 版本从 git tag 读，不写死 —— 写死的版本号必然会过期（这份横幅就过期过一次） */
console.log('══════════ 项目状态 · 地图拼图 ' +
  (run("git describe --tags --abbrev=0 2>/dev/null") || '（未打 tag）') + ' ══════════');
line('版本', run("git describe --tags --abbrev=0 2>/dev/null") || '（未打 tag）');
line('工作区', (run('git status --porcelain') === '' ? '干净 ✅' : '⚠ 有未提交改动'));
console.log('');
line('已接入地图', maps.length + ' 张');
line('层级', '中国（34 省级）→ 四川省（21 市州）→ 各自区县');
line('地图清单', maps.map((m) => m.id).join(', '));
console.log('');
const TOTAL = realEntries + placeholderEntries;
line('面积覆盖', areaFilled + ' / ' + TOTAL + ' 条'
  + (areaFilled === TOTAL ? '（全覆盖 ✅，由 tools/area-from-geo.js 依官方边界几何算出）'
                          : '（脚本可批量：node tools/area-from-geo.js --parent=<省 adcode> --write）'));
line('文案完整', realEntries + ' / ' + TOTAL + ' 条（landmark + tagline + funFact 都不再是占位）'
  + (realFiles.length ? '；整份完成：' + realFiles.map((f) => path.basename(f, '.data.js')).join(', ') : ''));
if (mixedFiles.length) {
  // 默认只报数量，避免几十个文件把"20 行内"的设计撑破；详情用 --verbose
  line('待补文案', placeholderEntries + ' 条 / ' + textPlaceholder + ' 个字段'
    + (process.argv.includes('--verbose') ? '\n                   ' + mixedFiles.join(' ') : '　（' + mixedFiles.length + ' 个文件，加 --verbose 看清单）'));
}
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
  line('地级待接入', scope.cityLeft + ' 个' +
    (scope.cityNoChild
      ? '（另有 ' + scope.cityNoChild + ' 个地级单位官方树里没有下级，按规则并入上级地图，不算待接入）'
      : ''));
} else {
  console.log('');
  line('剩余规模', '（缓存 /tmp/menu.json 不在，跑一次 tianditu-download 就有了）');
}
console.log('');
console.log('══════════ 下一步（选一条） ══════════');
console.log('  基线自检      node tools/e2e-test.js --only-suite=offline 2>&1 | tail -12   （应为 2053 通过 / 0 失败）');
console.log('  地图包自检    node tools/test-maps.js 2>&1 | tail -4');
console.log('  P0 补资料卡   面积：node tools/area-from-geo.js --parent=<省 adcode> --write');
console.log('                文字：编辑 js/maps/china/sichuan/<市>.data.js 的 landmark/tagline/funFact');
console.log('  P1 接入一个省 先在 tools/lib/slugs.js 补该省地级市拼音，再：');
console.log('                node tools/batch-add-maps.js --parent=<省 adcode>');
console.log('  换一张图的数据 node tools/replace-geo-source.js --source=file --dir=data/tianditu-official --only=<id>');
console.log('');
console.log('  ⚠ 省 token 铁律：跑测试/脚本一律 | tail -N；');
console.log('     js/maps/**/*.geo.js 是单行 100KB+，禁止 cat/head/tail，要用 node 脚本摘要。');
