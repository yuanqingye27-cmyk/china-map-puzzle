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

/* ---------- ⑨ 每日一图：日期种子 + 锁定 + 打卡 ---------- */
{
  // dayKey：本地日期，格式 YYYYMMDD
  const k = P.dayKey(new Date(2026, 8, 17).getTime());   // 月份 0-based → 9 月 17 日
  check('dayKey 格式为 YYYYMMDD', /^\d{8}$/.test(k), k);
  check('dayKey 与本地日期一致', k === '20260917', k);

  // hashString：同输入同输出、不同输入基本不同
  check('hashString 稳定', P.hashString('20260917') === P.hashString('20260917'));
  check('hashString 非负整数', P.hashString('x') >= 0 && Number.isInteger(P.hashString('x')));

  // pickDaily：候选顺序不影响结果（先排序再算）
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const t = new Date(2026, 8, 17).getTime();
  const d1 = P.emptyDoc();
  const pick1 = P.pickDaily(d1, ids, t);
  const d2 = P.emptyDoc();
  const pick2 = P.pickDaily(d2, ids.slice().reverse(), t);
  check('pickDaily 结果与候选顺序无关', pick1 === pick2, pick1 + ' vs ' + pick2);
  check('pickDaily 选出的确实在候选里', ids.indexOf(pick1) >= 0, pick1);

  // 锁定：当天再调用（甚至清单变了）也还是同一张
  const same = P.pickDaily(d1, ids.concat(['newmap']), t);
  check('当天已选定 → 清单变化也不换题', same === pick1, same + ' vs ' + pick1);

  // 换一天会换题（至少不是永远同一张）
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dd = P.emptyDoc();
    days.push(P.pickDaily(dd, ids, new Date(2026, 8, 17 + i).getTime()));
  }
  check('不同日期会抽到不同地图（7 天里不止 1 种）', new Set(days).size > 1, days.join(','));

  // 连续打卡
  const doc = P.emptyDoc();
  const day1 = new Date(2026, 8, 17).getTime();
  const day2 = new Date(2026, 8, 18).getTime();
  const day3 = new Date(2026, 8, 19).getTime();
  check('首次打卡 streak=1', P.checkIn(doc, day1) === 1, String(P.checkIn(doc, day1)));
  check('  同一天重复打卡不加数', P.checkIn(doc, day1) === 1, String(doc.daily.streak));
  check('  次日打卡 streak=2', P.checkIn(doc, day2) === 2, String(doc.daily.streak));
  check('  今日已打卡标记正确', P.checkedInToday(doc, day2) === true);
  check('  昨天不算今天已打卡', P.checkedInToday(doc, day3) === false);

  // 断签：隔一天再打，重新从 1 开始
  const gap = P.emptyDoc();
  P.checkIn(gap, day1);
  const after = P.checkIn(gap, day3);   // 跳过 day2
  check('断签后重新从 1 开始', after === 1, String(after));
  check('  但最佳连续天数被保留（best>=1）', gap.daily.best >= 1, String(gap.daily.best));
}

/* ---------- ⑩ 我的家乡 ---------- */
{
  const doc = P.emptyDoc();
  check('初始没有家乡', P.getHometown(doc) === null, String(P.getHometown(doc)));

  P.setHometown(doc, 'yichun');
  check('设置后能读回', P.getHometown(doc) === 'yichun', String(P.getHometown(doc)));
  check('isHometown 命中', P.isHometown(doc, 'yichun') === true);
  check('isHometown 不误报', P.isHometown(doc, 'chengdu') === false);
  check('设置会记录时间戳', doc.hometown && typeof doc.hometown.at === 'number');

  P.setHometown(doc, null);
  check('传 null 可清除家乡', P.getHometown(doc) === null, String(P.getHometown(doc)));

  /* 搜索：按市名、按省名都能搜到；空关键词返回空；结果有上限。
   * 【注意语义】搜"宜春"会同时命中「宜春市」和它下辖的「袁州区」——
   * 这是**有意的**：玩家的家乡可能是个区/县，只给他一个市级选项不够用。 */
  const maps = [
    { id: 'yichun', name: '宜春市', parentName: '江西省' },
    { id: 'nanchang', name: '南昌市', parentName: '江西省' },
    { id: 'chengdu', name: '成都市', parentName: '四川省' },
    { id: 'yuanzhou', name: '袁州区', parentName: '宜春市' },
  ];
  {
    const hit = P.searchPlaces(maps, '宜春').map((m) => m.id).sort();
    check('按市名搜到该市及其下辖区县', hit.join() === 'yichun,yuanzhou', JSON.stringify(hit));
  }
  check('按省名搜到全省的市', P.searchPlaces(maps, '江西').length === 2, JSON.stringify(P.searchPlaces(maps, '江西').map((m) => m.id)));
  check('按区名搜到', P.searchPlaces(maps, '袁州').map((m) => m.id).join() === 'yuanzhou');
  check('空关键词 → 空结果（不返回全部）', P.searchPlaces(maps, '').length === 0);
  check('纯空格关键词 → 空结果', P.searchPlaces(maps, '   ').length === 0);
  check('搜不到 → 空数组', P.searchPlaces(maps, '不存在的地名').length === 0);
  check('结果有上限（<=12）',
    P.searchPlaces(new Array(50).fill(0).map((_, i) => ({ id: 'm' + i, name: '测试市' + i })), '测试').length <= 12);
  check('输入 undefined 不崩', P.searchPlaces(maps, undefined).length === 0);
}

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
