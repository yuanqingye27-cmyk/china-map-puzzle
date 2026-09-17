#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 分享图 · 纯逻辑自测（不碰 Canvas）
 * ---------------------------------------------------------------------
 * 路径：tools/test-share.js（接入 e2e-test.js 的"离线检查"套件）
 *
 * 【测什么、不测什么】
 * 只测"卡片上写什么"（buildCardData / buildShareText / fmtTime / collectInput）——
 * 这部分是纯函数，能在 Node 里测透。
 * "怎么画"（drawCard）依赖 Canvas，只能在浏览器里看，交给人工/截图验证。
 * 这样切的理由：文案错了用户会立刻看到（很尴尬），而文案逻辑恰好最容易测。
 * ===================================================================== */

const path = require('path');

require(path.join(__dirname, '..', 'js', 'share.js'));
const S = globalThis.MapShare;

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

console.log('══════════ 分享图 · 纯逻辑自测 ══════════');

/* ---------- 时间格式 ---------- */
check('fmtTime(0) = 00:00', S.fmtTime(0) === '00:00', S.fmtTime(0));
check('fmtTime(95000) = 01:35', S.fmtTime(95000) === '01:35', S.fmtTime(95000));
check('fmtTime(负数) 不出现负号', S.fmtTime(-5000) === '00:00', S.fmtTime(-5000));
check('fmtTime(3600000) = 60:00（不转小时，保持简单）', S.fmtTime(3600000) === '60:00', S.fmtTime(3600000));

/* ---------- 卡片数据 ---------- */
{
  const d = S.buildCardData({
    mapName: '成都市', provinceName: '四川省',
    levelName: '中心城区', levelIndex: 0, levelTotal: 3,
    elapsed: 95000, tries: 4, hints: 0,
    solvedMaps: 12, totalMaps: 363, percent: 3,
    badges: [{ name: '第一步' }, { name: '一省全通' }],
  });
  check('标题取地图名', d.title === '成都市', d.title);
  check('副标题取省名', d.subtitle === '四川省', d.subtitle);
  check('关卡文案含"第 1 / 3 关"与关卡名',
    d.levelText.indexOf('第 1 / 3 关') >= 0 && d.levelText.indexOf('中心城区') >= 0, d.levelText);
  check('统计三项齐全（用时/尝试/提示）', d.stats.length === 3, JSON.stringify(d.stats));
  check('用时格式化为 01:35',
    d.stats.some((s) => s.k === '用时' && s.v === '01:35'), JSON.stringify(d.stats));
  check('进度文案含 12 / 363', d.progress.indexOf('12 / 363') >= 0, d.progress);
  check('成就最多取 3 个', S.buildCardData({ badges: [1, 2, 3, 4, 5].map((n) => ({ name: 'b' + n })) }).badges.length === 3);
}

/* ---------- 评语只依据可数事实 ---------- */
{
  const zero = S.buildCardData({ levelTotal: 3, tries: 3, hints: 0 }).verdict;
  check('零提示且尝试少 → 一气呵成', zero === '一气呵成', zero);

  const noHint = S.buildCardData({ levelTotal: 3, tries: 20, hints: 0 }).verdict;
  check('零提示但尝试多 → 零提示通关', noHint === '零提示通关', noHint);

  const hard = S.buildCardData({ levelTotal: 1, tries: 30, hints: 2 }).verdict;
  check('尝试远超关卡数 → 历尽波折', hard === '历尽波折', hard);

  const plain = S.buildCardData({ levelTotal: 2, tries: 3, hints: 1 }).verdict;
  check('普通情况 → 拼完了', plain === '拼完了', plain);
}

/* ---------- 单关地图不写"第 1 / 1 关" ---------- */
{
  const d = S.buildCardData({ mapName: '北京市', levelName: '市辖区', levelTotal: 1, levelIndex: 0 });
  check('单关地图：不出现"第 1 / 1 关"', d.levelText.indexOf('第 1 / 1') < 0, d.levelText);
  check('单关地图：直接用关卡名', d.levelText === '市辖区', d.levelText);
}

/* ---------- 缺字段不崩 ---------- */
{
  const d = S.buildCardData({});
  check('空输入不崩且给出兜底标题', d.title === '地图拼图', d.title);
  check('空输入 stats 为空数组', Array.isArray(d.stats) && d.stats.length === 0);
  check('空输入没有 progress 文案', d.progress === '', JSON.stringify(d.progress));
}

/* ---------- 分享文案 ---------- */
{
  const d = S.buildCardData({
    mapName: '成都市', levelName: '中心城区', levelIndex: 0, levelTotal: 3,
    elapsed: 95000, tries: 4, hints: 0, solvedMaps: 12, totalMaps: 363, percent: 3,
  });
  const t = S.buildShareText(d);
  check('分享文案含游戏名与地图名',
    t.indexOf('中国地图拼图') >= 0 && t.indexOf('成都市') >= 0, t);
  check('分享文案含用时与进度',
    t.indexOf('01:35') >= 0 && t.indexOf('12 / 363') >= 0, t);
  check('分享文案不含 undefined', t.indexOf('undefined') < 0, t);
}

/* ---------- collectInput：从页面状态采集 ---------- */
{
  const input = S.collectInput(
    { levelName: '县', levelIndex: 1, levelTotal: 2, elapsed: 60000, tries: 5, hints: 1 },
    { solvedMaps: 7, totalMaps: 363, percent: 2 },
    { name: '邢台市', provinceName: '河北省' },
    { badges: ['first'] }
  );
  check('collectInput：地图名与省名来自 entry',
    input.mapName === '邢台市' && input.provinceName === '河北省', JSON.stringify(input));
  check('collectInput：数字来自引擎状态',
    input.elapsed === 60000 && input.tries === 5 && input.hints === 1);
  check('collectInput：进度来自 summary',
    input.solvedMaps === 7 && input.totalMaps === 363);
  check('collectInput：空输入不崩', !!S.collectInput());
}

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
