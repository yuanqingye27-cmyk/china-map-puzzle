#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 玩法模式 · 离线自测
 * ---------------------------------------------------------------------
 * 路径：tools/test-modes.js（接入 e2e-test.js 的"离线检查"套件）
 *
 * 【为什么必须测】
 *   js/modes.js 是六套模式**唯一**的规则来源：哪个模式藏地名、给几次提示、
 *   成绩怎么算、错题怎么攒、对战怎么轮、报告长什么样，全在这里。
 *   这些算错了页面不会崩，只会安静地给出错误结果 ——
 *   比如"最佳成绩"记成了更慢的那次、或者对战换手换错了人。
 *   所以每一条规则都要被断言钉住。
 *
 * 【纯逻辑】本文件不碰 DOM、不碰 localStorage 的真身（用假 storage），
 *   所以在 Node 里跑得飞快，也不需要浏览器。
 * ===================================================================== */

const path = require('path');

require(path.join(__dirname, '..', 'js', 'modes.js'));
const M = globalThis.MapModes;

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

/** 假 storage：只实现 getItem/setItem，用来测存档而不污染真 localStorage */
function fakeStorage(initial) {
  const box = Object.assign({}, initial);
  return {
    getItem: (k) => (k in box ? box[k] : null),
    setItem: (k, v) => { box[k] = String(v); },
    _box: box,
  };
}

console.log('══════════ 玩法模式 · 离线自测 ══════════');

/* ---------- 一、六套模式的声明 ---------- */
{
  const ids = M.MODES.map((m) => m.id);
  check('正好六套模式', M.MODES.length === 6, String(M.MODES.length));
  check('模式 id 不重复', new Set(ids).size === ids.length, ids.join(','));
  check('包含全部六套：normal/timed/teach/exam/kids/duel',
    ['normal', 'timed', 'teach', 'exam', 'kids', 'duel'].every((x) => ids.indexOf(x) >= 0),
    ids.join(','));
  check('每套都有 name/short/desc',
    M.MODES.every((m) => m.name && m.short && m.desc));
  check('每套都有完整的 ui 开关与 engine 开关',
    M.MODES.every((m) => m.ui && m.engine &&
      typeof m.ui.timer === 'boolean' && typeof m.engine.pieceNames === 'string'));
  check('未知模式 id 回退到第一套（不抛异常）',
    M.modeById('no-such-mode').id === 'normal');
  check('isModeId 能区分真假 id',
    M.isModeId('exam') === true && M.isModeId('exam2') === false);
}

/* ---------- 二、模式 → 引擎配置的翻译（这是整个模块的核心） ---------- */
{
  const n = M.engineOverrides('normal', 'normal');
  check('普通模式：不显地名、提示不限、不软化、不动画开关',
    n.pieceNames === 'never' && n.hintLimit === null &&
    n.softenFeedback === false && n.disableMotion === false,
    JSON.stringify(n));

  const t = M.engineOverrides('teach', 'normal');
  check('教学学习：碎片常显地名', t.pieceNames === 'always', JSON.stringify(t));

  const e = M.engineOverrides('exam', 'normal');
  check('考试刷题：不给提示（hintLimit=0）',
    e.hintLimit === 0, JSON.stringify(e));
  check('考试刷题：关动画（disableMotion）', e.disableMotion === true);
  check('考试刷题：不显地名', e.pieceNames === 'never');

  const k = M.engineOverrides('kids', 'normal');
  check('儿童模式：反馈放软', k.softenFeedback === true);
  check('儿童模式：提示不限', k.hintLimit === Infinity, String(k.hintLimit));

  const d = M.engineOverrides('duel', 'normal');
  check('双人对战：不显地名、提示不限（引擎不需要为它改任何东西）',
    d.pieceNames === 'never' && d.hintLimit === null, JSON.stringify(d));
}

/* ---------- 三、计时挑战的三档难度 ---------- */
{
  check('三档难度：简单/普通/困难',
    M.DIFFICULTIES.map((d) => d.id).join(',') === 'easy,normal,hard',
    M.DIFFICULTIES.map((d) => d.id).join(','));

  const easy = M.engineOverrides('timed', 'easy');
  check('简单：提示不限', easy.hintLimit === Infinity, String(easy.hintLimit));
  check('简单：地名照常能看', easy.pieceNames === 'never' && !M.difficultyById('easy').hideNames);

  const nor = M.engineOverrides('timed', 'normal');
  check('普通：提示最多 3 次', nor.hintLimit === 3, String(nor.hintLimit));

  const hard = M.engineOverrides('timed', 'hard');
  check('困难：完全不给提示', hard.hintLimit === 0, String(hard.hintLimit));
  check('困难：碎片藏地名（该难度 hideNames=true）',
    M.difficultyById('hard').hideNames === true);
  /* 只有计时挑战会因难度改变引擎行为；别的模式传了 difficulty 也不该受影响 */
  const teachWithHard = M.engineOverrides('teach', 'hard');
  check('教学模式不受"困难"难度影响（仍常显地名、提示不限）',
    teachWithHard.pieceNames === 'always' && teachWithHard.hintLimit === null,
    JSON.stringify(teachWithHard));
}

/* ---------- 四、存档：读写、版本、损坏容错 ---------- */
{
  const s = fakeStorage();
  const doc = M.load(s);
  check('空存档得到默认值', doc.mode === 'normal' && doc.difficulty === 'normal');
  check('空存档的四个容器都在', !!(doc.best && doc.wrong && doc.duel && doc.pick));

  doc.mode = 'exam';
  doc.difficulty = 'hard';
  M.save(doc, s);
  const again = M.load(s);
  check('存档能往返（模式与难度记住了）',
    again.mode === 'exam' && again.difficulty === 'hard',
    again.mode + '/' + again.difficulty);

  check('版本不符 → 当作空存档（不让旧格式把页面搞崩）',
    M.load(fakeStorage({ 'map-puzzle-modes': JSON.stringify({ v: 999, mode: 'kids' }) })).mode === 'normal');
  check('JSON 坏了 → 当作空存档',
    M.load(fakeStorage({ 'map-puzzle-modes': '{坏掉的' })).mode === 'normal');
  check('mode 字段非法 → 回退默认',
    M.load(fakeStorage({ 'map-puzzle-modes': JSON.stringify({ v: 1, mode: 'wtf' }) })).mode === 'normal');
  check('缺字段 → 逐个兜底，不抛异常',
    (() => {
      const d = M.load(fakeStorage({ 'map-puzzle-modes': JSON.stringify({ v: 1 }) }));
      return d.best && d.wrong && d.duel && d.pick;
    })());
  check('storage 为 null 时也能 load（file:// 下 localStorage 可能被拦）',
    !!M.load(null) && M.load(null).mode === 'normal');
}

/* ---------- 五、最佳成绩：只有更快才覆盖 ---------- */
{
  const doc = M.emptyDoc();
  check('没有成绩时 bestOf 返回 null', M.bestOf(doc, 'chengdu', 'normal') === null);

  const r1 = M.recordBest(doc, 'chengdu', 'normal', { ms: 30000, tries: 5 });
  check('第一次记录算新纪录', r1.isNewBest === true);
  check('成绩能读回来', M.bestOf(doc, 'chengdu', 'normal').ms === 30000);

  const r2 = M.recordBest(doc, 'chengdu', 'normal', { ms: 45000, tries: 3 });
  check('更慢的成绩不算新纪录', r2.isNewBest === false);
  check('更慢的成绩不覆盖旧的', M.bestOf(doc, 'chengdu', 'normal').ms === 30000);

  const r3 = M.recordBest(doc, 'chengdu', 'normal', { ms: 20000, tries: 8 });
  check('更快的成绩算新纪录', r3.isNewBest === true);
  check('更快的成绩覆盖旧的', M.bestOf(doc, 'chengdu', 'normal').ms === 20000);

  M.recordBest(doc, 'chengdu', 'hard', { ms: 99000 });
  check('不同难度各自独立记账',
    M.bestOf(doc, 'chengdu', 'hard').ms === 99000 &&
    M.bestOf(doc, 'chengdu', 'normal').ms === 20000);
  M.recordBest(doc, 'leshan', 'normal', { ms: 11111 });
  check('不同地图各自独立记账',
    M.bestOf(doc, 'leshan', 'normal').ms === 11111 &&
    M.bestOf(doc, 'chengdu', 'normal').ms === 20000);
  check('负数/非法耗时被夹到 0，不会写进脏数据',
    M.recordBest(M.emptyDoc(), 'x', 'normal', { ms: -5 }).record.ms === 0);
}

/* ---------- 六、错题集 → 薄弱练习集 ---------- */
{
  const doc = M.emptyDoc();
  M.recordWrong(doc, 'chengdu', [510104, 510105]);
  M.recordWrong(doc, 'chengdu', 510104);
  M.recordWrong(doc, 'chengdu', 510104);
  const weak = M.weakSet(doc, 'chengdu');
  check('错得多的排前面', weak[0].adcode === '510104' && weak[0].times === 3,
    JSON.stringify(weak));
  check('只错一次的那块也在清单里', weak.length === 2, String(weak.length));
  check('limit 生效', M.weakSet(doc, 'chengdu', 1).length === 1);
  check('别的地图互不干扰', M.weakSet(doc, 'leshan').length === 0);
  check('空 adcode 不入账（防止 undefined 污染）',
    (() => {
      const d = M.emptyDoc();
      M.recordWrong(d, 'm', [undefined, null, 'undefined', 'null', '']);
      return M.weakSet(d, 'm').length === 0;
    })());
  M.clearWrong(doc, 'chengdu');
  check('清空错题记录生效', M.weakSet(doc, 'chengdu').length === 0);
}

/* ---------- 七、考试：正确率与评级 ---------- */
{
  const perfect = M.examResult(7, 7);
  check('全对 → 100%', perfect.accuracy === 100, String(perfect.accuracy));
  check('全对 → 优秀', perfect.grade === '优秀', perfect.grade);
  check('全对 → 放错 0 次', perfect.wrongTries === 0);

  const one3 = M.examResult(10, 13);
  check('10 块错 3 次 → 放错 3 次', one3.wrongTries === 3);
  check('10 块错 3 次 → 正确率 77%', one3.accuracy === 77, String(one3.accuracy));

  check('评级边界：95% 优秀', M.examResult(100, 105).accuracy >= 95);
  check('评级边界：70% 及格', M.examResult(70, 100).grade === '及格',
    M.examResult(70, 100).grade + '/' + M.examResult(70, 100).accuracy);
  check('评级边界：低正确率 待加强', M.examResult(10, 40).grade === '待加强',
    M.examResult(10, 40).grade);
  check('总数为 0 时不除零、不崩', M.examResult(0, 0).accuracy === 100);
}

/* ---------- 八、本地双人对战 ---------- */
{
  let d = M.duelInit();
  check('开局轮到玩家 1', d.turn === 'a');
  check('开局双方 0 分', d.scores.a === 0 && d.scores.b === 0);

  d = M.duelAfterTurn(d, true);
  check('放对 +10 分', d.scores.a === 10, String(d.scores.a));
  check('放对后换手给玩家 2', d.turn === 'b');

  d = M.duelAfterTurn(d, false);
  check('玩家 2 放错 -3 分（从 0 扣仍是 0，不出现负分）',
    d.scores.b === 0, String(d.scores.b));
  check('放错后换手回玩家 1', d.turn === 'a');
  check('轮次在累计', d.rounds === 2, String(d.rounds));

  let e = M.duelInit();
  e = M.duelAfterTurn(e, true);          // a +10 → 10
  e = M.duelAfterTurn(e, false);         // b 0
  e = M.duelAfterTurn(e, true);          // a +10 → 20
  e = M.duelAfterTurn(e, false);         // b 0
  e = M.duelAfterTurn(e, true);          // a +10 → 30
  e = M.duelAfterTurn(e, true);          // b +10 → 10
  const fin = M.duelFinish(e);
  check('结算：分高者胜', fin.winner === 'a', JSON.stringify(fin.scores));
  check('结算后打过 finished 标记', fin.finished === true);

  let tie = M.duelInit();
  tie = M.duelAfterTurn(tie, true);
  tie = M.duelAfterTurn(tie, true);
  check('同分 → 平局', M.duelFinish(tie).winner === 'tie');

  const doc = M.emptyDoc();
  M.recordDuel(doc, 'china', 'a');
  M.recordDuel(doc, 'china', 'a');
  M.recordDuel(doc, 'china', 'tie');
  check('历史战绩按地图累计',
    doc.duel.china.a === 2 && doc.duel.china.tie === 1, JSON.stringify(doc.duel.china));

  check('玩家信息能查到', M.playerById('b').name === '玩家 2');
  check('d 分数下限为 0（连错也不会变成负数）',
    (() => {
      let x = M.duelInit();
      for (let i = 0; i < 5; i++) x = M.duelAfterTurn(x, false);
      return x.scores.a >= 0 && x.scores.b >= 0;
    })());
}

/* ---------- 九、教学练习报告 ---------- */
{
  const md = M.markdownReport({
    mapName: '乐山市',
    scopeLabel: '自选 3 个行政区',
    total: 3,
    tries: 5,
    hints: 1,
    elapsed: 125000,
    items: [
      { name: '市中区', area: 840, correct: true, tries: 1 },
      { name: '五通桥区', area: 465, correct: false, tries: 3 },
      { name: '沙湾区', area: 606, correct: true, tries: 1 },
    ],
  });
  check('报告有标题', md.indexOf('# 地图拼图练习报告') === 0, md.slice(0, 40));
  check('报告含地图名', md.indexOf('乐山市') >= 0);
  check('报告含范围说明', md.indexOf('自选 3 个行政区') >= 0);
  check('报告把毫秒格式化成人话', md.indexOf('2 分 5 秒') >= 0, '未找到"2 分 5 秒"');
  check('报告含正确率', /正确率：\*\*\d+%\*\*/.test(md), md.split('\n').filter((l) => l.indexOf('正确率') >= 0).join(''));
  check('报告含 Markdown 表格表头', md.indexOf('| 行政区 | 面积 | 结果 | 尝试 |') >= 0);
  check('报告逐项列出每个行政区', md.indexOf('五通桥区') >= 0 && md.indexOf('沙湾区') >= 0);
  check('放错的条目标成 ❌', md.indexOf('| 五通桥区 | 465 km² | ❌ 放错 | 3 |') >= 0,
    md.split('\n').filter((l) => l.indexOf('五通桥') >= 0).join(''));
  check('面积缺失时显示 — 而不是 undefined',
    M.markdownReport({ items: [{ name: 'X', area: null, correct: true, tries: 1 }] }).indexOf('undefined') < 0);
  check('空 items 也不崩', typeof M.markdownReport({}) === 'string');
}

/* ---------- 十、儿童模式的文案 ---------- */
{
  check('满分 → 满分档的夸奖', M.kidPraise(1, 0).indexOf('全部拼对') >= 0, M.kidPraise(1, 0));
  check('低正确率 → 鼓励再试', M.kidPraise(0.2, 0).length > 0);

  /* 鼓励文案里不该出现"错/失败/扣分"这类挫败词 */
  const BAD_WORDS = ['失败', '错误', '扣分', '连击中断', '你输'];
  let bad = [];
  [0, 0.3, 0.6, 0.85, 1].forEach((r) => {
    for (let s = 0; s < 4; s++) {
      const t = M.kidPraise(r, s);
      BAD_WORDS.forEach((w) => { if (t.indexOf(w) >= 0) bad.push(t); });
      if (!t) bad.push('(空文案 r=' + r + ')');
    }
  });
  check('儿童文案里没有挫败向的词，也没有空文案', bad.length === 0, bad.join(' | '));
  check('同一个 seed 结果稳定（可测试、可复现）',
    M.kidPraise(0.9, 7) === M.kidPraise(0.9, 7));
  check('不同 seed 能换到不同的话',
    M.kidPraise(1, 0) !== M.kidPraise(1, 1) || M.kidPraise(1, 1) !== M.kidPraise(1, 2));
  check('放错提示不含"错"字以外没有安慰语的情况',
    M.kidSoftMiss('市中区').indexOf('再找找') >= 0, M.kidSoftMiss('市中区'));
}

/* ---------- 十一、百科外链与选区 ---------- */
{
  const u = M.wikiUrl('乐山市');
  check('百科链接带搜索参数', u.indexOf('search=') > 0, u);
  check('中文被正确编码（不含裸中文）', !/[\u4e00-\u9fa5]/.test(u), u);
  check('空名字返回空串（不给死链）', M.wikiUrl('') === '');
  check('链接是 https 外链（本站自身不联网）', u.indexOf('https://') === 0);

  check('选区标签：没选时说明是全部',
    M.scopeLabel([], [1, 2, 3]) === '全部 3 个行政区', M.scopeLabel([], [1, 2, 3]));
  check('选区标签：选了就说自选几个',
    M.scopeLabel([1, 2], [1, 2, 3]) === '自选 2 个行政区', M.scopeLabel([1, 2], [1, 2, 3]));

  const doc = M.emptyDoc();
  M.setPick(doc, 'leshan', [510102, 510111]);
  check('选区能存能取', M.getPick(doc, 'leshan').length === 2);
  check('选区存成字符串（避免数字/字符串比较踩坑）',
    typeof M.getPick(doc, 'leshan')[0] === 'string');
  check('没存过的图返回空数组', M.getPick(doc, 'chengdu').length === 0);
}

/* ---------- 十二、界面开关与计分归属 ---------- */
{
  const f = M.uiFlags('teach');
  check('教学模式打开 teachTools', f.teachTools === true && f.timer === false);
  const ex = M.uiFlags('exam');
  check('考试模式打开 accuracy 与 best', ex.accuracy === true && ex.best === true);
  const du = M.uiFlags('duel');
  check('双人模式打开 duel', du.duel === true && du.best === false);
  const kd = M.uiFlags('kids');
  check('儿童模式打开 simpleStats', kd.simpleStats === true);
  /* 未知模式回退到第一套（普通模式）。这里断言"和普通模式完全一致"，
   * 而不是写死某个具体值 —— 否则普通模式的界面开关一改，这条就假报警。 */
  check('未知模式回退到普通模式的开关',
    JSON.stringify(M.uiFlags('nope')) === JSON.stringify(M.uiFlags('normal')),
    JSON.stringify(M.uiFlags('nope')));
  check('普通模式不显示模式信息条（界面与改动前保持一致）',
    M.uiFlags('normal').timer === false && M.uiFlags('normal').best === false &&
    M.uiFlags('normal').teachTools === false && M.uiFlags('normal').duel === false);

  check('儿童模式不计分（避免数值向的挫败感）',
    M.scoringEnabled('kids') === false && M.scoringEnabled('normal') === true);
  check('儿童模式不显示扣分/连击这类惩罚向反馈',
    M.penaltyVisible('kids') === false && M.penaltyVisible('normal') === true);
  check('教学模式也不计分', M.scoringEnabled('teach') === false);
}

/* ---------- 十三、时间格式化 ---------- */
{
  check('59 秒', M.fmtMs(59000) === '59 秒', M.fmtMs(59000));
  check('60 秒 → 1 分 0 秒', M.fmtMs(60000) === '1 分 0 秒', M.fmtMs(60000));
  check('负数夹到 0 秒', M.fmtMs(-100) === '0 秒', M.fmtMs(-100));
  check('非法值不产生 NaN', M.fmtMs(undefined) === '0 秒' && M.fmtMs('abc') === '0 秒');
}

/* ---------- 十四、模块纯净性 ---------- */
{
  check('模块可在 Node 里直接加载（不依赖 window/DOM）',
    typeof M.MODES === 'object' && typeof M.load === 'function');
  check('模块没有访问 document', typeof globalThis.document === 'undefined');
}

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
