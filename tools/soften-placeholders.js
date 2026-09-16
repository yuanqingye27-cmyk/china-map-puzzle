#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 占位文案优雅降级 —— 把"待补充"换成社区共建口吻
 * ---------------------------------------------------------------------
 * 路径：tools/soften-placeholders.js
 * 用法：node tools/soften-placeholders.js [--check]
 *
 * 背景：批量接入时，脚本生成的资料卡长这样（**这是刻意的，不能编造内容**）：
 *     area: null,
 *     landmark: '【待补充：雁江区地标】',
 *     tagline:  '【待补充：雁江区一句话介绍】',
 *     funFact:  '【待补充：雁江区冷知识】',
 * 直接给玩家看"【待补充：雁江区地标】"像是在看施工工地；
 * 换成"📖 资料收录中，欢迎参与共建"就成了"社区共建型产品"的口径 ——
 * **注意：这只是换措辞，不是填内容，绝不伪造任何资料。**
 *
 * 它只动两类东西：
 *   1. `'【待补充：…】'` 这样的占位字符串 → 统一的共建文案
 *   2. 关卡 blurb 里的 `'【待补充：第N关的分组依据…】'` → 同一口径
 * `area: null` 保持不动（页面会显示"—"，这是"未知值"的通用表达，不是施工痕迹）。
 *
 * 已经写好真实资料的地图（如成都）一个字符都不会被碰。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');

/** 统一的降级文案 —— 数据层与页面口径的唯一出处 */
const BUILD_TEXT = '📖 资料收录中，欢迎参与共建';
const LEVEL_TEXT = '📖 本关资料收录中，欢迎参与共建';

/* 两种历史格式都要吃：
 *   新版：'【待补充：雁江区地标】'
 *   老版：'（待补充）' / '（待补充：说明…）'   ← zigong 那批就是老版，容易漏掉
 * 只匹配【带引号】的字符串字面量，避免误伤文件里的注释文字。 */
const PLACEHOLDER = /'(?:【待补充：[^'】]*】|（待补充[^'）]*）)'/g;

function parseArgs(argv) {
  const out = { flags: new Set() };
  argv.forEach((a) => {
    const m = /^--([^=]+)$/.exec(a);
    if (m) out.flags.add(m[1]);
  });
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const checkOnly = args.flags.has('check');

  const scan = tree.scanMaps();
  const files = Object.values(scan.maps)
    .map((m) => tree.absOf((m.dir ? m.dir + '/' : '') + m.id + '.data.js'))
    .filter((f) => fs.existsSync(f))
    .sort();

  let touched = 0;
  let replaced = 0;
  const rows = [];

  files.forEach((file) => {
    const rel = file.replace(tree.ROOT + '/', '');
    const src = fs.readFileSync(file, 'utf8');
    if (!PLACEHOLDER.test(src)) {
      PLACEHOLDER.lastIndex = 0;
      rows.push('  · ' + rel.padEnd(46) + '（真实资料，未改动）');
      return;
    }
    PLACEHOLDER.lastIndex = 0;

    const count = (src.match(PLACEHOLDER) || []).length;
    // blurb 单独换一种口径（它是关卡说明，不是资料卡字段）
    const out = src.replace(PLACEHOLDER, (m) =>
      /分组依据|分组/.test(m) ? "'" + LEVEL_TEXT + "'" : "'" + BUILD_TEXT + "'");

    if (out !== src) {
      touched++;
      replaced += count;
      if (!checkOnly) fs.writeFileSync(file, out, 'utf8');
      rows.push('  ' + (checkOnly ? '?' : '✔') + ' ' + rel.padEnd(46) + count + ' 处');
    }
  });

  console.log('══════════ 占位文案降级' + (checkOnly ? '（--check 只看不改）' : '') + ' ══════════');
  rows.forEach((r) => console.log(r));
  console.log('\n  涉及 ' + touched + ' 个文件、共 ' + replaced + ' 处占位');
  console.log('  统一口径：' + BUILD_TEXT);
  if (checkOnly && touched) {
    console.log('\n  ⚠ 还有 ' + touched + ' 个文件没降级，跑一遍：node tools/soften-placeholders.js');
  }
}

main();
