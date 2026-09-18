/* =====================================================================
 * 玩法模式 · 纯逻辑层（零 DOM、零引擎依赖）
 * ---------------------------------------------------------------------
 * 路径：js/modes.js
 *
 * 【设计原则：模式是"配置的组合"，不是"分支的堆叠"】
 *   六套模式听起来要做六套玩法，但拆开看，它们全部由**少数几个开关**组合而成：
 *     要不要显示碎片上的地名 · 提示够不够用 · 计不计时 · 要不要把错误记下来 ·
 *     反馈要不要放软 · 一局是一个人还是两个人轮
 *   所以这里只做两件事：
 *     ① 把每个模式**声明**成一组开关（`MODES` 数组，纯数据）
 *     ② 提供这些开关要用的纯函数（最佳成绩、错题集、正确率、回合、报告、文案）
 *   真正的渲染仍然只有一套 —— js/engine.js 完全不知道"模式"这个概念，
 *   它只认 `pieceNames` / `hintLimit` / `softenFeedback` / `onPlacement` 这几个
 *   通用配置项。这样加第七套模式不需要碰引擎。
 *
 * 【为什么全放 localStorage】
 *   项目底线是纯静态、file:// 双击即玩、零后端。所以"个人最佳""错题集""对战比分"
 *   全部只存在本机浏览器里。代价是换设备/清缓存会丢 —— 这是刻意的取舍，
 *   换来的是"永远不花钱、永远打得开"。
 *
 * 【存储】只用一个键，与 progress.js 互不干扰：
 *   `map-puzzle-modes`：模式偏好 + 各图最佳成绩 + 错题集 + 对战记录
 *   （引擎自己的 `<id>-map-puzzle` 和 progress.js 的 `map-puzzle-progress` 都不动）
 * ===================================================================== */

(function (global) {
  'use strict';

  const STORE_KEY = 'map-puzzle-modes';
  const SCHEMA_VERSION = 1;

  /* ==================================================================
   * 一、六套模式（纯数据）
   * ================================================================== */

  /**
   * 每套模式 = 一组开关。字段含义：
   *   ui     —— 宿主页要显示哪些界面块（引擎完全不知道这些）
   *   engine —— 要传给引擎的配置项（引擎只认这几项）
   */
  const MODES = [
    {
      id: 'normal',
      name: '普通模式',
      short: '普通',
      desc: '默认玩法：把碎片拖回地图上正确的位置。',
      /* 普通模式的界面刻意保持**和以前一模一样**：一条信息条都不加。
       * 计时本来就有（右侧"用时"那一格），没必要在模式条里再显示一遍。
       * 这里全 false ⇒ 模式条不产生任何内容 ⇒ 整条隐藏。 */
      ui: {
        timer: false, best: false, difficulty: false,
        teachTools: false, accuracy: false, duel: false, simpleStats: false,
      },
      engine: { pieceNames: 'never', hintLimit: null, softenFeedback: false, disableMotion: false },
    },
    {
      id: 'timed',
      name: '计时挑战',
      short: '计时',
      desc: '计时通关，记录本机每张地图的最佳成绩；自动收集易错行政区。',
      ui: {
        timer: true, best: true, difficulty: true,
        teachTools: false, accuracy: false, duel: false, simpleStats: false,
      },
      engine: { pieceNames: 'never', hintLimit: null, softenFeedback: false, disableMotion: false },
    },
    {
      id: 'teach',
      name: '教学学习',
      short: '教学',
      desc: '碎片永久显示地名，可只挑部分行政区练习，支持导出练习报告。',
      ui: {
        timer: false, best: false, difficulty: false,
        teachTools: true, accuracy: false, duel: false, simpleStats: false,
      },
      engine: { pieceNames: 'always', hintLimit: null, softenFeedback: false, disableMotion: false },
    },
    {
      id: 'exam',
      name: '考试刷题',
      short: '考试',
      desc: '隐藏地名、关闭动画、计时测验，结束后给出正确率与错题清单。',
      ui: {
        timer: true, best: true, difficulty: false,
        teachTools: false, accuracy: true, duel: false, simpleStats: false,
      },
      engine: { pieceNames: 'never', hintLimit: 0, softenFeedback: false, disableMotion: true },
    },
    {
      id: 'kids',
      name: '儿童模式',
      short: '儿童',
      desc: '面向小学生：统计信息更简单、提示更宽松、只用鼓励的说法。',
      ui: {
        timer: false, best: false, difficulty: false,
        teachTools: false, accuracy: false, duel: false, simpleStats: true,
      },
      engine: { pieceNames: 'never', hintLimit: Infinity, softenFeedback: true, disableMotion: false },
    },
    {
      id: 'duel',
      name: '本地双人对战',
      short: '双人',
      desc: '同一台设备上两人轮流拼，一块一轮，最后比分高者胜。不需要联网。',
      ui: {
        timer: false, best: false, difficulty: false,
        teachTools: false, accuracy: false, duel: true, simpleStats: false,
      },
      engine: { pieceNames: 'never', hintLimit: null, softenFeedback: false, disableMotion: false },
    },
  ];

  const DEFAULT_MODE = 'normal';

  function modeById(id) {
    for (let i = 0; i < MODES.length; i++) {
      if (MODES[i].id === id) return MODES[i];
    }
    return MODES[0];
  }

  function isModeId(id) {
    return MODES.some((m) => m.id === id);
  }

  /* ==================================================================
   * 二、计时挑战的三档难度
   * ================================================================== */

  const DIFFICULTIES = [
    {
      id: 'easy', name: '简单', short: '简单',
      desc: '提示不限次数，地名照常能看。',
      hintLimit: Infinity, hideNames: false,
    },
    {
      id: 'normal', name: '普通', short: '普通',
      desc: '提示最多 3 次，地名照常能看。',
      hintLimit: 3, hideNames: false,
    },
    {
      id: 'hard', name: '困难', short: '困难',
      desc: '完全不给提示，碎片上也不显示地名。',
      hintLimit: 0, hideNames: true,
    },
  ];

  const DEFAULT_DIFFICULTY = 'normal';

  function difficultyById(id) {
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      if (DIFFICULTIES[i].id === id) return DIFFICULTIES[i];
    }
    return DIFFICULTIES[1];
  }

  /* ==================================================================
   * 三、把「模式 + 难度」翻译成引擎配置
   * ------------------------------------------------------------------
   * 这是整个模块的核心：**引擎只拿到这几个通用开关**，
   * 它不知道自己在跑哪套模式。加新模式只要在这里加一个分支。
   * ================================================================== */

  function engineOverrides(modeId, difficultyId) {
    const m = modeById(modeId);
    const out = {
      pieceNames: m.engine.pieceNames,
      hintLimit: m.engine.hintLimit,
      softenFeedback: m.engine.softenFeedback,
      disableMotion: m.engine.disableMotion,
    };
    /* 只有计时挑战的难度会改引擎行为（提示额度 + 是否藏地名）。
     * 其它模式即使传了 difficulty 也不受影响 —— 难度是计时挑战专有的。 */
    if (m.id === 'timed') {
      const d = difficultyById(difficultyId);
      out.hintLimit = d.hintLimit;
      if (d.hideNames) out.pieceNames = 'never';
    }
    return out;
  }

  /** 教学模式的"碎片永久显示地名"要能压过难度设置 —— 它是这个模式的全部意义 */
  function effectivePieceNames(modeId, difficultyId) {
    return engineOverrides(modeId, difficultyId).pieceNames;
  }

  /* ==================================================================
   * 四、存储（可替换接口，便于移植与测试）
   * ================================================================== */

  function defaultStorage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* file:// 下某些浏览器会拦，退回内存 */ }
    return null;
  }

  function emptyDoc() {
    return {
      v: SCHEMA_VERSION,
      mode: DEFAULT_MODE,
      difficulty: DEFAULT_DIFFICULTY,
      /* 每张图各自记录：{ [mapId]: { [diffId]: {ms, tries, hints, score, at} } } */
      best: {},
      /* 易错行政区：{ [mapId]: { [adcode]: 次数 } } */
      wrong: {},
      /* 对战战绩：{ [mapId]: { a: 胜场, b: 胜场 } } */
      duel: {},
      /* 教学模式的自定义选区：{ [mapId]: [adcode, ...] } */
      pick: {},
      updatedAt: 0,
    };
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function load(storage) {
    const s = storage || defaultStorage();
    if (!s || typeof s.getItem !== 'function') return emptyDoc();
    try {
      const raw = s.getItem(STORE_KEY);
      if (!raw) return emptyDoc();
      const doc = JSON.parse(raw);
      if (!doc || doc.v !== SCHEMA_VERSION) return emptyDoc();
      const base = emptyDoc();
      /* 逐字段兜底：存档可能来自旧版本，缺字段不该让页面崩 */
      return {
        v: SCHEMA_VERSION,
        mode: isModeId(doc.mode) ? doc.mode : base.mode,
        difficulty: DIFFICULTIES.some((d) => d.id === doc.difficulty) ? doc.difficulty : base.difficulty,
        best: doc.best && typeof doc.best === 'object' ? doc.best : {},
        wrong: doc.wrong && typeof doc.wrong === 'object' ? doc.wrong : {},
        duel: doc.duel && typeof doc.duel === 'object' ? doc.duel : {},
        pick: doc.pick && typeof doc.pick === 'object' ? doc.pick : {},
        updatedAt: Number(doc.updatedAt) || 0,
      };
    } catch (e) {
      return emptyDoc();
    }
  }

  function save(doc, storage) {
    const s = storage || defaultStorage();
    if (!s || typeof s.setItem !== 'function') return false;
    try {
      doc.updatedAt = Date.now();
      s.setItem(STORE_KEY, JSON.stringify(doc));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ==================================================================
   * 五、最佳成绩
   * ================================================================== */

  function bestKey(diffId) {
    return difficultyById(diffId).id;
  }

  /** 取某张图某难度下的个人最佳；没有就返回 null */
  function bestOf(doc, mapId, diffId) {
    const perMap = (doc && doc.best && doc.best[mapId]) || null;
    if (!perMap) return null;
    const rec = perMap[bestKey(diffId)];
    return rec && typeof rec.ms === 'number' ? rec : null;
  }

  /**
   * 记录一次成绩，只有更快才覆盖。
   * @returns {{record:object, isNewBest:boolean, prev:object|null}}
   */
  function recordBest(doc, mapId, diffId, result) {
    const k = bestKey(diffId);
    if (!doc.best[mapId]) doc.best[mapId] = {};
    const prev = doc.best[mapId][k] || null;
    const rec = {
      ms: Math.max(0, Number(result && result.ms) || 0),
      tries: Math.max(0, Number(result && result.tries) || 0),
      hints: Math.max(0, Number(result && result.hints) || 0),
      score: Math.max(0, Number(result && result.score) || 0),
      at: Date.now(),
    };
    const isNewBest = !prev || rec.ms < prev.ms;
    if (isNewBest) doc.best[mapId][k] = rec;
    return { record: rec, isNewBest, prev };
  }

  /* ==================================================================
   * 六、易错行政区 → 薄弱练习集
   * ================================================================== */

  /** 记一次"放错了"。wrongTarget 是玩家误放到的那个行政区（如果有） */
  function recordWrong(doc, mapId, adcodes) {
    const list = Array.isArray(adcodes) ? adcodes : [adcodes];
    if (!doc.wrong[mapId]) doc.wrong[mapId] = {};
    list.forEach((a) => {
      const k = String(a);
      if (!k || k === 'undefined' || k === 'null') return;
      doc.wrong[mapId][k] = (Number(doc.wrong[mapId][k]) || 0) + 1;
    });
    return doc.wrong[mapId];
  }

  /**
   * 薄弱练习集：按出错次数从高到低取前 limit 个。
   * @returns {Array<{adcode:string, times:number}>}
   */
  function weakSet(doc, mapId, limit) {
    const per = (doc && doc.wrong && doc.wrong[mapId]) || {};
    const arr = Object.keys(per).map((a) => ({ adcode: a, times: Number(per[a]) || 0 }));
    arr.sort((x, y) => (y.times - x.times) || (Number(x.adcode) - Number(y.adcode)));
    return typeof limit === 'number' ? arr.slice(0, limit) : arr;
  }

  function clearWrong(doc, mapId) {
    if (doc.wrong) delete doc.wrong[mapId];
    return doc;
  }

  /* ==================================================================
   * 七、考试刷题：正确率与错题清单
   * ================================================================== */

  /**
   * @param {number} total 本关总块数
   * @param {number} tries 总尝试次数（含放错）
   * @returns {{total:number, tries:number, wrongTries:number, accuracy:number, grade:string}}
   */
  function examResult(total, tries) {
    const t = Math.max(0, Number(total) || 0);
    const n = Math.max(0, Number(tries) || 0);
    /* 放错次数 = 总尝试 - 成功次数（成功次数就是块数）。
     * 全对时 accuracy = 100%；每多错一次就摊薄一次。 */
    const wrongTries = Math.max(0, n - t);
    const denom = t + wrongTries;
    const accuracy = denom > 0 ? Math.round((t / denom) * 100) : 100;
    let grade = '待加强';
    if (accuracy >= 95) grade = '优秀';
    else if (accuracy >= 85) grade = '良好';
    else if (accuracy >= 70) grade = '及格';
    return { total: t, tries: n, wrongTries, accuracy, grade };
  }

  /* ==================================================================
   * 八、本地双人对战（同一台设备，轮流操作）
   * ================================================================== */

  const PLAYERS = [
    { id: 'a', name: '玩家 1', color: '#3fb08a' },
    { id: 'b', name: '玩家 2', color: '#d0703f' },
  ];

  function duelInit() {
    return {
      turn: 'a',
      rounds: 0,
      scores: { a: 0, b: 0 },
      hits: { a: 0, b: 0 },
      misses: { a: 0, b: 0 },
      finished: false,
      winner: null,
    };
  }

  /** 得分规则：放对 +10，放错 -3（不低于 0，避免挫败感过强） */
  const DUEL_HIT = 10;
  const DUEL_MISS = 3;

  /**
   * 走一轮。每放一块算一轮，不管对错都换手。
   * @returns {object} 新的对战状态（不修改传入对象）
   */
  function duelAfterTurn(state, correct) {
    const next = clone(state);
    const me = next.turn;
    const other = me === 'a' ? 'b' : 'a';
    if (correct) {
      next.scores[me] += DUEL_HIT;
      next.hits[me] += 1;
    } else {
      next.scores[me] = Math.max(0, next.scores[me] - DUEL_MISS);
      next.misses[me] += 1;
    }
    next.rounds += 1;
    next.turn = other;
    return next;
  }

  /** 结算：分高者胜，同分算平局 */
  function duelFinish(state) {
    const next = clone(state);
    next.finished = true;
    const { a, b } = next.scores;
    next.winner = a > b ? 'a' : (b > a ? 'b' : 'tie');
    return next;
  }

  function playerById(id) {
    return PLAYERS.filter((p) => p.id === id)[0] || PLAYERS[0];
  }

  /** 累计两人的历史胜负（跨局），写进 doc.duel[mapId] */
  function recordDuel(doc, mapId, winner) {
    if (!doc.duel[mapId]) doc.duel[mapId] = { a: 0, b: 0, tie: 0 };
    if (doc.duel[mapId][winner] === undefined) doc.duel[mapId][winner] = 0;
    doc.duel[mapId][winner] += 1;
    return doc.duel[mapId];
  }

  /* ==================================================================
   * 九、教学模式的练习报告（Markdown）
   * ================================================================== */

  const fmtMs = (ms) => {
    const t = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    const m = Math.floor(t / 60);
    const s = t % 60;
    return m > 0 ? m + ' 分 ' + s + ' 秒' : s + ' 秒';
  };

  /**
   * 生成一份可直接贴进备课文档的 Markdown 报告。
   * @param {object} ctx {mapName, scopeLabel, total, tries, hints, elapsed, items:[{name, area, correct, tries}]}
   */
  function markdownReport(ctx) {
    const c = ctx || {};
    const items = Array.isArray(c.items) ? c.items : [];
    const res = examResult(c.total || items.length, c.tries || 0);
    const lines = [];
    lines.push('# 地图拼图练习报告');
    lines.push('');
    lines.push('- 地图：**' + (c.mapName || '') + '**');
    if (c.scopeLabel) lines.push('- 范围：' + c.scopeLabel);
    lines.push('- 行政区数量：' + (c.total || items.length) + ' 个');
    lines.push('- 用时：' + fmtMs(c.elapsed));
    lines.push('- 尝试次数：' + (c.tries || 0) + '（放错 ' + res.wrongTries + ' 次）');
    lines.push('- 正确率：**' + res.accuracy + '%**（' + res.grade + '）');
    lines.push('- 提示使用：' + (c.hints || 0) + ' 次');
    lines.push('');
    lines.push('## 逐项明细');
    lines.push('');
    lines.push('| 行政区 | 面积 | 结果 | 尝试 |');
    lines.push('| --- | --- | --- | --- |');
    items.forEach((it) => {
      const area = (typeof it.area === 'number' && isFinite(it.area)) ? it.area + ' km²' : '—';
      lines.push('| ' + (it.name || '') + ' | ' + area + ' | ' +
        (it.correct === false ? '❌ 放错' : '✅ 拼对') + ' | ' + (it.tries || 0) + ' |');
    });
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('_由「地图拼图」教学学习模式导出。想要全班数据请逐台导出后汇总。_');
    return lines.join('\n');
  }

  /* ==================================================================
   * 十、儿童模式的鼓励文案
   * ================================================================== */

  const PRAISE = {
    perfect: ['太棒啦！全部拼对了！', '真厉害，一个都没错！', '满分！你把它们都送回家啦！'],
    great: ['很厉害！只差一点点就全对了。', '做得很好，继续加油！', '你已经记住大部分啦！'],
    good: ['不错哦，再试一次会更好！', '有进步！慢慢来，不着急。', '你已经拼对好几块啦！'],
    tryAgain: ['没关系，再找找看，你可以的！', '慢慢来，地图会告诉你答案。', '别着急，我们再来一次！'],
  };

  /**
   * 按正确率挑一句鼓励的话。
   * @param {number} ratio 0~1
   * @param {number} seed 用来在同一档里"换一句"，避免每次都是同一句
   */
  function kidPraise(ratio, seed) {
    const r = Math.max(0, Math.min(1, Number(ratio) || 0));
    const tier = r >= 1 ? 'perfect' : r >= 0.85 ? 'great' : r >= 0.6 ? 'good' : 'tryAgain';
    const list = PRAISE[tier];
    const i = Math.abs(Math.floor(Number(seed) || 0)) % list.length;
    return list[i];
  }

  /** 儿童模式：放错时的话（不出现"错/失败/连击中断"这类词） */
  function kidSoftMiss(name) {
    return name ? '这块不是' + name + '哦，再找找看～' : '再找找看～';
  }

  /* ==================================================================
   * 十一、百科参考按钮
   * ================================================================== */

  /**
   * 生成一个"去查参考"的外链。
   * 【注意】这里**只生成链接**，站点本身不联网、不调用任何接口 ——
   * 用户点了才会离开页面。所以"纯静态、可离线"这条底线不受影响。
   */
  function wikiUrl(name) {
    const q = String(name || '').trim();
    if (!q) return '';
    /* 用中文站的搜索页：不依赖具体条目名，找不到也能给出搜索结果。
     * 路径刻意用英文别名 `Special:Search` 而不是 `Special:搜索` ——
     * 中文路径在 URL 里是裸的，容易被某些环境/复制粘贴环节弄坏。 */
    return 'https://zh.wikipedia.org/wiki/Special:Search?search=' + encodeURIComponent(q);
  }

  /** 教学模式的选区标签，用在报告和界面上 */
  function scopeLabel(picked, all) {
    const n = Array.isArray(picked) ? picked.length : 0;
    if (!n) return '全部 ' + (Array.isArray(all) ? all.length : 0) + ' 个行政区';
    return '自选 ' + n + ' 个行政区';
  }

  /* ==================================================================
   * 十二、教学模式的自定义选区
   * ================================================================== */

  function setPick(doc, mapId, adcodes) {
    doc.pick[mapId] = (Array.isArray(adcodes) ? adcodes : []).map(String);
    return doc.pick[mapId];
  }

  function getPick(doc, mapId) {
    const p = (doc && doc.pick && doc.pick[mapId]) || [];
    return Array.isArray(p) ? p : [];
  }

  /* ==================================================================
   * 十三、界面开关（宿主页用）
   * ================================================================== */

  /** 把模式的 ui 开关取出来，带默认值兜底 */
  function uiFlags(modeId) {
    const m = modeById(modeId);
    return Object.assign({
      timer: true, best: false, difficulty: false,
      teachTools: false, accuracy: false, duel: false, simpleStats: false,
    }, m.ui);
  }

  /** 模式是否计分。儿童模式不计分（避免挫败向反馈），教学也不计 */
  function scoringEnabled(modeId) {
    const id = modeById(modeId).id;
    return id === 'normal' || id === 'timed' || id === 'exam' || id === 'duel';
  }

  /** 连击/扣分这类"挫败向"反馈是否显示 */
  function penaltyVisible(modeId) {
    const id = modeById(modeId).id;
    return id !== 'kids';
  }

  global.MapModes = {
    STORE_KEY,
    SCHEMA_VERSION,
    MODES,
    DEFAULT_MODE,
    DIFFICULTIES,
    DEFAULT_DIFFICULTY,
    PLAYERS,
    DUEL_HIT,
    DUEL_MISS,
    modeById,
    isModeId,
    difficultyById,
    engineOverrides,
    effectivePieceNames,
    emptyDoc,
    load,
    save,
    bestOf,
    recordBest,
    recordWrong,
    weakSet,
    clearWrong,
    examResult,
    duelInit,
    duelAfterTurn,
    duelFinish,
    playerById,
    recordDuel,
    markdownReport,
    kidPraise,
    kidSoftMiss,
    wikiUrl,
    scopeLabel,
    setPick,
    getPick,
    uiFlags,
    scoringEnabled,
    penaltyVisible,
    fmtMs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
