#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 计分规则 · 离线自测
 * ---------------------------------------------------------------------
 * 路径：tools/test-score.js（接入 e2e-test.js 的"离线检查"套件）
 *
 * 【为什么必须测】
 * 计分是"游戏平衡"的落点：改一个常量就会改变玩家行为
 * （比如把连击上限调高，玩家就会为了刷分故意拖时间）。
 * 公式抽成纯函数以后可以被断言钉住，改平衡时能立刻看出影响。
 * ===================================================================== */

const path = require('path');

require(path.join(__dirname, '..', 'js', 'score.js'));
const S = globalThis.MapScore;

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

console.log('══════════ 计分规则 · 离线自测 ══════════');

/* ---------- 连击倍率：递增、封顶 ---------- */
check('第 1 块 = 100 分', S.forPlacement(1) === 100, String(S.forPlacement(1)));
check('第 2 块 = 200 分（×2）', S.forPlacement(2) === 200, String(S.forPlacement(2)));
check('第 5 块 = 500 分（×5）', S.forPlacement(5) === 500, String(S.forPlacement(5)));
check('第 6 块仍 = 500 分（封顶 ×5，防止刷分）', S.forPlacement(6) === 500, String(S.forPlacement(6)));
check('第 99 块仍 = 500 分', S.forPlacement(99) === 500, String(S.forPlacement(99)));

/* ---------- 异常输入不崩、不出现负分 ---------- */
check('combo=0 按 1 算（不会得 0 分）', S.forPlacement(0) === 100, String(S.forPlacement(0)));
check('combo=undefined 按 1 算', S.forPlacement(undefined) === 100, String(S.forPlacement(undefined)));
check('combo 为负按 1 算', S.forPlacement(-5) === 100, String(S.forPlacement(-5)));

/* ---------- 时间奖励：有上限、不会为负 ---------- */
// 时间奖励按关卡规模缩放：8 块关卡的连击满分 = 100+200+300+400+500*4 = 3000，奖励上限 = 1500
check('0 秒 → 拿满时间奖励', S.timeBonus(0, 8) === 1500, String(S.timeBonus(0, 8)));
check('60 秒 → 拿到一半', S.timeBonus(60000, 8) === 750, String(S.timeBonus(60000, 8)));
check('120 秒以上 → 0（衰减到底）', S.timeBonus(120000, 8) === 0, String(S.timeBonus(120000, 8)));
check('极慢也不会扣成负数', S.timeBonus(99999999, 8) === 0, String(S.timeBonus(99999999, 8)));
/* 核心平衡断言：任何规模的关卡，时间奖励都不超过连击分的一半 ——
 * 这条就是被它抓出来的 bug（原本定死 2000，5 块关卡连击满分只有 1500）。 */
{
  let ok = true;
  const bad = [];
  for (let n = 1; n <= 30; n++) {
    const t = S.timeBonus(0, n);
    const c = S.maxPlacementScore(n);
    if (t > c * 0.5 + 1) { ok = false; bad.push(n + '块:奖励' + t + '>连击' + c); }
  }
  check('时间奖励永远 <= 连击分的一半（"准"稳定压过"快"）', ok, bad.join('; '));
}

/* ---------- 提示扣分 ---------- */
check('提示扣 150', S.applyHintCost(1000) === 850, String(S.applyHintCost(1000)));
check('分不够时扣到 0，不为负', S.applyHintCost(100) === 0, String(S.applyHintCost(100)));
check('分数为空按 0 处理', S.applyHintCost(undefined) === 0, String(S.applyHintCost(undefined)));

/* ---------- 满分的量级要合理 ---------- */
{
  // 5 块的关卡：连击满分 100+200+300+400+500 = 1500，加时间奖励（50%）= 2250
  check('5 块关卡满分 = 2250', S.maxForLevel(5) === 2250, String(S.maxForLevel(5)));
  check('0 块关卡满分为 0（没有块就没有分）', S.maxForLevel(0) === 0, String(S.maxForLevel(0)));
  check('连击满分本身正确（5 块 = 1500）', S.maxPlacementScore(5) === 1500, String(S.maxPlacementScore(5)));
  check('块数越多满分越高', S.maxForLevel(10) > S.maxForLevel(5));
}

/* ---------- 评级：按比例，对新老关卡都公平 ---------- */
{
  check('满分 → 完美', S.rankOf(1000, 1000).id === 's', JSON.stringify(S.rankOf(1000, 1000)));
  check('90% → 完美', S.rankOf(900, 1000).id === 's');
  check('75% → 出色', S.rankOf(750, 1000).id === 'a');
  check('55% → 不错', S.rankOf(550, 1000).id === 'b');
  check('35% → 及格', S.rankOf(350, 1000).id === 'c');
  check('低于 35% → 加油', S.rankOf(100, 1000).id === 'd');
  check('满分为 0 时不崩、不误判完美', S.rankOf(0, 0).id === 'd', JSON.stringify(S.rankOf(0, 0)));
}

/* ---------- 一致性：一定块数的最优打法总分 == maxForLevel ---------- */
{
  // 全程不断连击 + 0 秒通关，应当正好等于满分
  let score = 0;
  for (let i = 1; i <= 8; i++) score += S.forPlacement(i);
  score += S.timeBonus(0, 8);
  check('不断连击 + 零耗时的总分 == maxForLevel(8)', score === S.maxForLevel(8), score + ' vs ' + S.maxForLevel(8));
}

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
