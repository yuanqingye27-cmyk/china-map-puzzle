#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 面积抽取器 · 离线自测
 * ---------------------------------------------------------------------
 * 路径：tools/test-area-pick.js（接入 e2e-test.js 的"离线检查"套件）
 *
 * 【为什么必须有这个测试】
 * 面积是资料卡里**最容易抓错**的字段，而 `pickArea` 是纯函数、改起来很频繁。
 * 实测它前后出过四次问题，每次都是"某个区县被填成错的面积"：
 *   ① 分布面积（"中丘中谷…分布面积仅 0.01 平方千米"）排在正确答案前面
 *   ② 集雨面积（米易县"响水河…集雨面积 284"被当成县域面积）
 *   ③ 流域面积（盐边县"该河…流城面积 616"；原文还有错别字"流城"）
 *   ④ 子区域面积（德阳旌阳区"东部丘陵区，面积 263.4，占全区幅员面积的 40.65%"）
 * 所以这里把**真实踩过的句子**固定成用例，要求分类必须正确。
 * 全部离线，不依赖网络。
 * ===================================================================== */

const facts = require('./lib/facts-source');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

/** 对单句分类，返回 kind（找不到则 null） */
function kindOf(sentence) {
  const picked = facts.pickArea(sentence);
  const hit = picked.find((x) => x.text === sentence || x.text.includes(sentence) || sentence.includes(x.text));
  return hit ? hit.kind : null;
}

console.log('══════════ 面积抽取器 · 离线自测 ══════════');

/* ---------- 应该判为 region（本行政区面积）---------- */
const SHOULD_BE_REGION = [
  ['辖区总面积', '截至2022年末，辖区总面积159.9平方千米，东西长20.54千米。'],
  ['政区面积', '年末，政区面积1342平方千米。'],
  ['全区辖区面积', '全区辖区面积410.2平方千米。'],
  ['总面积', '全市幅员面积为1.27万平方公里，占全省总面积的2.64%。'],
  ['截至年份+面积', '截至2025年6月，辖区总面积为466.71平方千米。'],
];
SHOULD_BE_REGION.forEach(([label, s]) => {
  check('region · ' + label, kindOf(s) === 'region', '实际 ' + kindOf(s));
});

/* ---------- 应该判为 other（不是本行政区面积）---------- */
const SHOULD_BE_OTHER = [
  // ① 分布面积（片区/地貌）
  ['分布面积', '中丘中谷地貌海拔高度在350米~430米，地面切深度为50米~80米面91.69平方千米，占全区总面积的59.40%。'],
  // ② 集雨面积（河流）—— 米易县真实案例
  ['集雨面积', '县境内雅砻江支流响水河，发源于云峰乡，其主要支流有牛马河、普威河、李名久河等，全长20千米，集雨面积284平方千米，流经南坝乡注入雅砻江。'],
  // ③ 流域面积（含原文错别字"流城"）—— 盐边县真实案例
  ['流域面积', '该河干流长38千米，流域面积616平方千米，平均径流量25.70立方米/秒。'],
  ['流城面积(错别字)', '该河干流长38千米，流城面积616平方千米，平均径流量25.70立方米/秒。'],
  // ④ 子区域面积 —— 德阳旌阳区真实案例
  ['子区域(东部丘陵区)', '东部丘陵区，面积263.4平方千米，占全区幅员面积的40.65%。'],
  ['子区域(平坝)', '平坝区，面积120平方千米，占全县总面积的15%。'],
  // 其他常见误命中
  ['灌溉面积', '设计灌溉面积7.2平方千米，总干渠长12千米。'],
  ['建成区面积', '市区建成区面积40平方千米。'],
  ['网格覆盖面积', '城市区域环境噪声有效监测113个网格，网格总覆盖面积1.91平方千米。'],
  ['耕地灌溉面积', '全县耕地灌溉面积120平方千米。'],
];
SHOULD_BE_OTHER.forEach(([label, s]) => {
  check('other · ' + label, kindOf(s) === 'other', '实际 ' + kindOf(s));
});

/* ---------- 边界：同一段文字里两种都有，region 必须排前面 ---------- */
const mixed = '全区辖区面积465.68平方千米。境内河流纵横，流域面积96平方千米。';
const pickedMixed = facts.pickArea(mixed);
check('混合文本：region 排在 other 前面',
  pickedMixed.length >= 2 && pickedMixed[0].kind === 'region' && pickedMixed.some((x) => x.kind === 'other'),
  JSON.stringify(pickedMixed.map((x) => x.kind)));

/* ---------- 兜底：全都不是 region 时，仍然返回（标 other）而不是空数组 ---------- */
const onlyOther = '该河干流长38千米，流域面积616平方千米。';
const pickedOnly = facts.pickArea(onlyOther);
check('全是 other 时仍返回结果（不静默丢弃）',
  pickedOnly.length > 0 && pickedOnly.every((x) => x.kind === 'other'),
  '实际 ' + JSON.stringify(pickedOnly));

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
