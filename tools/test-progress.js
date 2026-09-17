#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 进度与成就模块 · 离线自测
 * ---------------------------------------------------------------------
 * 路径：tools/test-progress.js（接入 e2e-test.js 的"离线检查"套件）
 *
 * 【为什么必须测】
 * `js/progress.js` 是"跨地图的总账"：它算错了，玩家看到的进度、
 * 拿到的成就就都是假的 —— 而这类错误**不会让任何东西崩**，
 * 只会安静地给出错误数字（比崩溃更难发现）。
 * 所以这里用**假的 storage** 把纯逻辑测透，不需要浏览器、不碰 localStorage。
 * ===================================================================== */

const path = require('path');

/* 在 Node 里加载浏览器模块：它挂到 globalThis 上，且能接受注入的 storage */
require(path.join(__dirname, '..', 'js', 'progress.js'));
const P = globalThis.MapProgress;

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

/** 假 storage：只提供 getItem/setItem，用来验证"存储可替换" */
function fakeStorage() {
  const box = {};
  return {
    getItem: (k) => (k in box ? box[k] : null),
    setItem: (k, v) => { box[k] = String(v); },
    _box: box,
  };
}

console.log('══════════ 进度与成就 · 离线自测 ══════════');

/* ---------- ① 空状态 ---------- */
{
  const doc = P.emptyDoc();
  const s = P.summary(doc, new Array(363));
  check('空文档：已拼 0 张、总图 363、百分比 0',
    s.solvedMaps === 0 && s.totalMaps === 363 && s.percent === 0,
    JSON.stringify({ solved: s.solvedMaps, total: s.totalMaps, pct: s.percent }));
  check('空文档：没有任何成就', P.evaluate(s, doc).length === 0);
}

/* ---------- ② 记录一张：通关后统计正确 ---------- */
{
  const st = fakeStorage();
  const doc = P.load(st);
  P.record(doc, { mapId: 'chengdu', mapName: '成都市', province: 'sichuan', provinceName: '四川省',
    solved: true, levels: 3, levelsTotal: 3, elapsed: 120000, tries: 3, hints: 0, stars: 9 });
  const s = P.summary(doc, new Array(363));
  check('记录一张通关：solvedMaps=1', s.solvedMaps === 1, String(s.solvedMaps));
  check('记录一张通关：星数=9', s.totalStars === 9, String(s.totalStars));
  check('记录一张通关：无提示通关数=1', s.noHintMaps === 1, String(s.noHintMaps));
  check('记录一张通关：该省 total=1 / solved=1',
    s.provinces.sichuan && s.provinces.sichuan.total === 1 && s.provinces.sichuan.solved === 1,
    JSON.stringify(s.provinces.sichuan || null));
  check('拿到"第一步"成就', P.evaluate(s, doc).indexOf('first') >= 0);
}

/* ---------- ③ 幂等 + 只保留更好成绩 ---------- */
{
  const doc = P.emptyDoc();
  P.record(doc, { mapId: 'x', solved: true, elapsed: 100000, hints: 5, stars: 3, levels: 1, levelsTotal: 1 });
  P.record(doc, { mapId: 'x', solved: true, elapsed: 200000, hints: 9, stars: 1, levels: 1, levelsTotal: 1 });
  check('更差的成绩不会覆盖更好的（hints 保持 5）', doc.maps.x.hints === 5, String(doc.maps.x.hints));
  check('更差的成绩不会覆盖更好的（stars 保持 3）', doc.maps.x.stars === 3, String(doc.maps.x.stars));

  P.record(doc, { mapId: 'x', solved: true, elapsed: 50000, hints: 0, stars: 3, levels: 1, levelsTotal: 1 });
  check('更好的成绩会覆盖（elapsed 变 50000）', doc.maps.x.elapsed === 50000, String(doc.maps.x.elapsed));
  check('重复记录不增加地图数', Object.keys(doc.maps).length === 1, String(Object.keys(doc.maps).length));
}

/* ---------- ④ 未通关的地图也记账（用于"玩过但没拼完"）---------- */
{
  const doc = P.emptyDoc();
  P.record(doc, { mapId: 'y', solved: false, levels: 1, levelsTotal: 3, elapsed: 30000, hints: 0, stars: 0 });
  const s = P.summary(doc, new Array(10));
  check('未通关：算进"玩过"但不算进 solved', s.solvedMaps === 0 && Object.keys(doc.maps).length === 1);
  check('未通关：不会误发"第一步"', P.evaluate(s, doc).indexOf('first') < 0);
}

/* ---------- ⑤ 省级全通 ---------- */
{
  const doc = P.emptyDoc();
  ['a', 'b'].forEach((id) => P.record(doc, { mapId: id, province: 'sc', provinceName: '四川省', solved: true, levels: 1, levelsTotal: 1, stars: 3 }));
  let s = P.summary(doc, new Array(10));
  check('省级全通：1 个省全通', s.solvedProvinces === 1, String(s.solvedProvinces));
  check('拿到"一省全通"', P.evaluate(s, doc).indexOf('province') >= 0);

  ['c', 'd', 'e', 'f'].forEach((id) => P.record(doc, { mapId: id, province: 'gd', provinceName: '广东省', solved: true, levels: 1, levelsTotal: 1, stars: 3 }));
  P.record(doc, { mapId: 'g', province: 'gd', solved: false, levels: 1, levelsTotal: 2 });
  s = P.summary(doc, new Array(10));
  check('省级全通：未拼完的省不算全通（仍为 1）', s.solvedProvinces === 1, String(s.solvedProvinces));
}

/* ---------- ⑥ 成就只发一次 ---------- */
{
  const doc = P.emptyDoc();
  P.record(doc, { mapId: 'a', solved: true, levels: 1, levelsTotal: 1, stars: 3 });
  let s = P.summary(doc, new Array(10));
  const first = P.claimBadges(doc, s);
  const second = P.claimBadges(doc, s);
  check('首次发放有"第一步"', first.some((b) => b.id === 'first'), JSON.stringify(first.map((b) => b.id)));
  check('再次调用不再重复发放', second.length === 0, JSON.stringify(second.map((b) => b.id)));
}

/* ---------- ⑦ 存储：写入后能读回；版本不符则重置 ---------- */
{
  const st = fakeStorage();
  const doc = P.load(st);
  P.record(doc, { mapId: 'z', solved: true, levels: 1, levelsTotal: 1, stars: 3 });
  P.save(doc, st);
  const back = P.load(st);
  check('存盘后能读回（maps 不为空）', Object.keys(back.maps).length === 1, JSON.stringify(Object.keys(back.maps)));

  st.setItem(P.STORE_KEY, JSON.stringify({ v: 999, maps: { evil: { solved: true } } }));
  const reset = P.load(st);
  check('版本不符 → 安全重置为空（不读出脏数据）', Object.keys(reset.maps).length === 0);
  check('  → 重置后是合法文档', reset.v === P.SCHEMA_VERSION && Array.isArray(reset.badges));
}

/* ---------- ⑧ 没有 storage 时不能崩（隐私模式）---------- */
{
  const doc = P.load({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  check('storage 抛异常 → 退回空文档，不崩', doc && doc.v === P.SCHEMA_VERSION);
  check('save 失败返回 false 而不抛', P.save(doc, { setItem() { throw new Error('x'); } }) === false);
}

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
