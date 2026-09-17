#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 子代理产出校验 · 离线自测
 * ---------------------------------------------------------------------
 * 路径：tools/test-facts-verify.js（接入 e2e-test.js 的"离线检查"套件）
 *
 * 【为什么必须有这个测试】
 * `facts-verify.js` 的职责是"用脚本核对子代理有没有编"。
 * 如果这个校验器自己失效（比如原文比对写松了、漏检查面积），
 * 那么整条"委派给子代理"的省 token 方案就会**静默地把编造内容放进项目**。
 * 这类"守门人自己坏掉"的风险必须用测试钉住：这里造三种输入，
 * 要求校验器**该拦的必须拦住**（假证据、错面积、撞车条目进正文）。
 *
 * 全部离线：素材用 tools/fixtures/facts-zigong.sample.json（合成数据），几何用真实 geo。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FIXTURE = 'tools/fixtures/facts-zigong.sample.json';

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

/** 跑校验器，返回 { code, out } */
function runVerify(payload) {
  const tmp = path.join('/tmp', 'verify-case-' + Math.random().toString(36).slice(2) + '.json');
  fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8');
  try {
    const out = execFileSync('node', [
      'tools/facts-verify.js', '--map=zigong', '--in=' + tmp, '--facts=' + FIXTURE,
    ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? 1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

console.log('══════════ 子代理产出校验 · 离线自测 ══════════');

/* ---------- 用例 1：完全合规 → 必须通过 ---------- */
const good = {
  map: 'zigong',
  verifiedAt: '2026-09-17',
  districts: [
    {
      adcode: 510302, name: '自流井区', area: 155,
      landmark: '自贡盐业历史博物馆、西秦会馆',
      tagline: '自贡的主城区，也是盐业文化的核心地带。',
      funFact: '自流井区因境内有一口自流盐井而得名。',
      evidence: {
        landmark: '区内有自贡盐业历史博物馆、西秦会馆等文物古迹。',
        tagline: '自流井区是自贡市的政治、经济、文化中心。',
        funFact: '自流井区因境内有一口自流盐井而得名。',
      },
    },
    {
      adcode: 510322, name: '富顺县', area: 1343,
      landmark: '富顺文庙',
      tagline: '建县于北周的川南古县。',
      evidence: {
        landmark: '富顺文庙是全国重点文物保护单位。',
        tagline: '富顺县建县于北周天和二年（公元567年）。',
      },
    },
  ],
  rejected: [
    { adcode: 510303, name: '贡井区', reason: '本用例故意不填，便于验证覆盖度提醒' },
    { adcode: 510304, name: '大安区', reason: '素材面积校验异常，保守跳过' },
    { adcode: 510399, name: '市中区', reason: '同名词条撞车（内江市），不可用' },
    { adcode: 510321, name: '荣县', reason: '抓取被限流，无素材' },
  ],
};
const r1 = runVerify(good);
check('合规产出 → 校验通过（exit 0）', r1.code === 0, '实际 exit=' + r1.code);

/* ---------- 用例 2：编造证据 → 必须拦下 ---------- */
const fabricated = JSON.parse(JSON.stringify(good));
fabricated.districts[0].evidence.landmark = '区内有恐龙博物馆和燊海井等著名景点。';
const r2 = runVerify(fabricated);
check('编造 evidence → 拦下（exit 1）', r2.code === 1);
check('  且报出"疑似编造"', /疑似编造/.test(r2.out));
check('  且指出是 landmark 字段', /landmark/.test(r2.out));

/* ---------- 用例 3：面积与几何不一致 → 必须拦下 ---------- */
const badArea = JSON.parse(JSON.stringify(good));
badArea.districts[0].area = 999;
const r3 = runVerify(badArea);
check('面积与几何不一致 → 拦下（exit 1）', r3.code === 1);
check('  且指出不一致', /与几何面积/.test(r3.out));

/* ---------- 用例 4：collision 是弱信号 → 只提醒，不再拦 ----------
 * 【为什么规则改了】实测误报：凉山的西昌市/会理市/会东县/喜德县，
 * 条目正文里压根没写"凉山"二字（很多条目不写上级市名），但面积与几何一致、地名也对。
 * 按旧规则这 4 条会被整条拒掉 —— 而真正的撞车由**面积比值**抓得住
 * （内江市市中区 0.05 倍那种）。所以 collision 降级为提醒。
 * 这条用例锁住"降级后不会静默通过、仍会给出提醒"。 */
const collided = JSON.parse(JSON.stringify(good));
collided.districts.push({
  adcode: 510399, name: '市中区', area: 840,
  landmark: '黄鹤湖旅游区',
  evidence: { landmark: '市中区有黄鹤湖旅游区。' },
});
const r4 = runVerify(collided);
check('collision（弱信号）不拦下', r4.code === 0, '实际 exit=' + r4.code);
check('  但会给出提醒', /所属市名/.test(r4.out));

/* ---------- 用例 4b：真正的撞车靠面积比值拦（素材 mismatch）---------- */
/* 夹具里 510304 大安区的 check.status 是 mismatch —— 把它写进正文必须被拦。 */
const realCollision = JSON.parse(JSON.stringify(good));
realCollision.districts.push({
  adcode: 510304, name: '大安区', area: 401,
  landmark: '燊海井',
  evidence: { landmark: '大安区有燊海井。' },
});
const r4b = runVerify(realCollision);
check('面积 mismatch 的条目进正文 → 拦下（exit 1）', r4b.code === 1, '实际 exit=' + r4b.code);
check('  且指出面积对不上', /面积与几何对不上/.test(r4b.out));

/* ---------- 用例 5：素材抓取失败的条目写进正文 → 必须拦下 ---------- */
const throttledInBody = JSON.parse(JSON.stringify(good));
throttledInBody.districts.push({
  adcode: 510321, name: '荣县', area: 1607, landmark: '荣县大佛',
  evidence: { landmark: '荣县大佛是全国重点文物保护单位。' },
});
const r5 = runVerify(throttledInBody);
check('限流条目进正文 → 拦下（exit 1）', r5.code === 1, '实际 exit=' + r5.code);
check('  且指出素材抓取失败', /抓取失败/.test(r5.out));

/* ---------- 用例 6：用占位文案凑数 → 必须拦下 ---------- */
const placeholder = JSON.parse(JSON.stringify(good));
placeholder.districts[0].landmark = '📖 资料收录中，欢迎参与共建';
placeholder.districts[0].evidence.landmark = '区内有自贡盐业历史博物馆、西秦会馆等文物古迹。';
const r6 = runVerify(placeholder);
check('用占位文案凑数 → 拦下（exit 1）', r6.code === 1, '实际 exit=' + r6.code);
check('  且指出用了占位', /占位/.test(r6.out));

/* ---------- 用例 7：填了内容但没给 evidence → 必须拦下 ---------- */
const noEvidence = JSON.parse(JSON.stringify(good));
delete noEvidence.districts[0].evidence.landmark;
const r7 = runVerify(noEvidence);
check('缺 evidence → 拦下（exit 1）', r7.code === 1, '实际 exit=' + r7.code);
check('  且指出无法追溯', /无法追溯/.test(r7.out));

/* ---------- 用例 8：landmark 用记忆补充（素材里没有这个名字）→ 必须拦下 ---------- */
/* 真实案例：子代理给恩阳区写 landmark='恩阳古镇'，evidence 却是"古镇内既有…米仓古道…"。
 * evidence 是真的，但"恩阳古镇"这五个字素材里从没出现 —— 只查 evidence 查不出来。 */
const memoryLandmark = JSON.parse(JSON.stringify(good));
memoryLandmark.districts[1].landmark = '富顺文庙、赵化古镇';
memoryLandmark.districts[1].evidence.landmark = '富顺文庙是全国重点文物保护单位。';
const r8 = runVerify(memoryLandmark);
check('landmark 用记忆补充 → 拦下（exit 1）', r8.code === 1, '实际 exit=' + r8.code);
check('  且指出疑似用记忆补充', /疑似用记忆补充/.test(r8.out));
check('  且点名到具体成分', /赵化古镇/.test(r8.out));

/* ---------- 用例 9：landmark 全部能在素材中找到 → 通过 ---------- */
const corpusLandmark = JSON.parse(JSON.stringify(good));
corpusLandmark.districts[1].landmark = '富顺文庙';
corpusLandmark.districts[1].evidence.landmark = '富顺文庙是全国重点文物保护单位。';
const r9 = runVerify(corpusLandmark);
check('landmark 全部有素材依据 → 通过（exit 0）', r9.code === 0, '实际 exit=' + r9.code);

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
