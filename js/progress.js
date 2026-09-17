/* =====================================================================
 * 进度与成就 · 纯逻辑层（零 DOM、零引擎依赖）
 * ---------------------------------------------------------------------
 * 路径：js/progress.js
 *
 * 【为什么单独一层】
 * "玩家拼了多少、拿到了什么徽章"这件事与"怎么画一块拼图"完全无关。
 * 把它做成**纯函数 + 一个存储接口**，好处有三：
 *   ① 可移植：换到 React Native / SwiftUI / Flutter 都能原样复用（不碰 document）
 *   ② 可测试：纯逻辑可以在 Node 里跑断言，不需要起浏览器
 *   ③ 职责清楚：引擎只管"拼这一张"，这一层只管"拼过的所有地图的账"
 *
 * 【分类原则】这里只存**可数的事实**（哪张图拼完了、用了多久、有没有用提示），
 * 不存"等级/经验/货币"这类需要平衡设计的数值 —— 那种东西一旦引入就再也拿不掉，
 * 而本项目要的是"认识中国地理"的成就感，不是数值养成。
 *
 * 【存储】只读写两个键，且**各自独立**：
 *   - `map-puzzle-progress`：本模块的总账（跨地图）
 *   - 引擎每张地图自己的 `<id>-map-puzzle`：不变，读写仍归引擎
 * 两者不互相覆盖，所以引入这一层**不会破坏任何已有存档**。
 * ===================================================================== */

(function (global) {
  'use strict';

  const STORE_KEY = 'map-puzzle-progress';
  const SCHEMA_VERSION = 1;

  /* ---------------- 存储：可替换 ---------------- */
  /* 默认用 localStorage；移植时传一个实现了 getItem/setItem 的对象即可。 */
  function defaultStorage() {
    try {
      if (global.localStorage) return global.localStorage;
    } catch (e) { /* 隐私模式等：当作没有存储 */ }
    return null;
  }

  /* ---------------- 每日一图 ----------------
   * 【机制】用**当天日期**当种子，从全部地图里选一张，所有人同一天抽到同一张。
   *   为什么有效：不需要内容团队、不需要服务端，天然制造"大家都玩过"的话题；
   *   连续打卡（streak）是回访的最强钩子之一，而且不靠推送施压 —— 玩家自己惦记。
   * 【关键设计】当天选定后**锁定**（写进存档的 daily.mapId）。
   *   否则地图清单一变（接了一个新省）当天的题就换了，玩家会觉得在耍他。
   * ============================================ */

  /** 当天日期键（YYYYMMDD）。做成纯函数便于单测；按本地时间算，符合"今天"的直觉 */
  function dayKey(now) {
    const d = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return String(y) + m + day;
  }

  /** 把字符串稳定地散列成一个非负整数（同样的输入永远同样的输出） */
  function hashString(s) {
    let h = 2166136261;                     // FNV-1a：短字符串上分布够好，且实现只有几行
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
  }

  /**
   * 今天该玩哪张地图。
   * @param {object} doc       进度文档（会被写入 daily 字段；传 null 则只计算不记录）
   * @param {string[]} mapIds  候选地图（只放"适合单独玩"的，由调用方筛）
   * @param {number} now       时间戳（测试用）
   * @returns {string|null}
   */
  function pickDaily(doc, mapIds, now) {
    if (!Array.isArray(mapIds) || !mapIds.length) return null;
    // 候选要先排序，保证"同一份清单"在任何机器上算出同样的结果
    const sorted = mapIds.slice().sort();
    const key = dayKey(now);

    // 已有当天的记录就直接用（锁定）；但如果那张图已不在候选里（被删/改了），重抽
    if (doc && doc.daily && doc.daily.day === key && sorted.indexOf(doc.daily.mapId) >= 0) {
      return doc.daily.mapId;
    }
    const idx = hashString(key) % sorted.length;
    const mapId = sorted[idx];
    if (doc) {
      doc.daily = { day: key, mapId: mapId, count: (doc.daily && doc.daily.count) || 0 };
    }
    return mapId;
  }

  /** 每日打卡：当天拼完了就记一次，返回连续天数 */
  function checkIn(doc, now) {
    if (!doc) return 0;
    const key = dayKey(now);
    if (doc.daily && doc.daily.checkedDay === key) {
      return doc.daily.streak || 1;          // 今天已经打过卡
    }
    // 昨天打过 → streak+1；否则从 1 重新开始
    const y = new Date(now == null ? Date.now() : now);
    y.setDate(y.getDate() - 1);
    const yKey = dayKey(y.getTime());
    const prevStreak = (doc.daily && doc.daily.checkedDay === yKey) ? (doc.daily.streak || 0) : 0;

    doc.daily = Object.assign({}, doc.daily, {
      checkedDay: key,
      streak: prevStreak + 1,
      best: Math.max((doc.daily && doc.daily.best) || 0, prevStreak + 1),
    });
    return doc.daily.streak;
  }

  /** 今天是否已打卡（界面用） */
  function checkedInToday(doc, now) {
    return !!(doc && doc.daily && doc.daily.checkedDay === dayKey(now));
  }

  /* ---------------- 我的家乡 ----------------
   * 【机制】玩家选一次自己的家乡（省/市/县都行），界面上就有一个直达入口，
   *   拼完那张图时分享卡会带家乡的名字。
   * 【为什么值得做】地域认同是最廉价的分享理由 ——
   *   人会为"我是宜春人"转发，不会为"我玩了个游戏"转发。
   * 【纯逻辑部分】设置/读取/匹配（搜索）都在这里，UI 只负责画。
   * ============================================ */

  /** 设置家乡（把 mapId 记进文档）。传 null 表示清除 */
  function setHometown(doc, mapId) {
    if (!doc) return doc;
    doc.hometown = mapId ? { mapId: mapId, at: Date.now() } : null;
    return doc;
  }

  function getHometown(doc) {
    return (doc && doc.hometown && doc.hometown.mapId) || null;
  }

  /** 这张图是不是我的家乡 */
  function isHometown(doc, mapId) {
    return getHometown(doc) === mapId;
  }

  /**
   * 按关键词搜索家乡候选（纯函数：输入地图清单与关键词，输出匹配项）。
   * 匹配规则刻意做得宽松（包含即可），因为玩家会输入"宜春""江西""袁州"各种写法。
   * @param {Array<{id,name,parentName}>} maps  全部候选（由宿主层组装）
   * @param {string} kw
   */
  function searchPlaces(maps, kw) {
    const q = String(kw || '').trim();
    if (!q) return [];
    const out = [];
    for (let i = 0; i < maps.length; i++) {
      const m = maps[i];
      if (!m || !m.name) continue;
      if (m.name.indexOf(q) >= 0 || (m.parentName && m.parentName.indexOf(q) >= 0)) out.push(m);
      if (out.length >= 12) break;      // 够用了，不做分页
    }
    return out;
  }

  function emptyDoc() {
    return { v: SCHEMA_VERSION, maps: {}, badges: [], daily: null, hometown: null, updatedAt: 0 };
  }

  function load(storage) {
    const st = storage || defaultStorage();
    if (!st) return emptyDoc();
    try {
      const raw = st.getItem(STORE_KEY);
      if (!raw) return emptyDoc();
      const doc = JSON.parse(raw);
      if (!doc || doc.v !== SCHEMA_VERSION) return emptyDoc();  // 版本不符就重来
      if (!doc.maps || typeof doc.maps !== 'object') return emptyDoc();
      if (!Array.isArray(doc.badges)) doc.badges = [];
      return doc;
    } catch (e) { return emptyDoc(); }
  }

  function save(doc, storage) {
    const st = storage || defaultStorage();
    if (!st) return false;
    try {
      doc.updatedAt = Date.now();
      st.setItem(STORE_KEY, JSON.stringify(doc));
      return true;
    } catch (e) { return false; }   // 写不进去不影响游戏
  }

  /* ---------------- 记账：记录一张地图的成绩 ---------------- */
  /**
   * 记录一张地图的通关情况。**同样的数据重复记录是幂等的**，
   * 只保留更好的成绩（更少尝试/更少提示/更快）。
   * @param {object} doc      load() 得到的文档
   * @param {object} result   { mapId, mapName, province, provinceName,
   *                            solved, levels, levelsTotal, elapsed, tries, hints, stars }
   */
  function record(doc, result) {
    if (!doc || !result || !result.mapId) return doc;
    const id = result.mapId;
    const prev = doc.maps[id] || null;
    const solved = !!result.solved;

    // 只有更好的成绩才覆盖：先看是否通关，再比星级/用时/提示
    const better = (a, b) => {
      if (!b) return true;
      if (a.solved !== b.solved) return a.solved;              // 通关优先
      const sa = a.stars || 0, sb = b.stars || 0;
      if (sa !== sb) return sa > sb;                            // 星级高的
      const ha = a.hints || 0, hb = b.hints || 0;
      if (ha !== hb) return ha < hb;                            // 提示少的
      return (a.elapsed || 1e9) < (b.elapsed || 1e9);           // 用时短的
    };

    const next = {
      mapId: id,
      mapName: result.mapName || (prev && prev.mapName) || id,
      province: result.province || (prev && prev.province) || null,
      provinceName: result.provinceName || (prev && prev.provinceName) || null,
      solved: solved || (prev ? prev.solved : false),
      levels: result.levels || (prev && prev.levels) || 0,
      levelsTotal: result.levelsTotal || (prev && prev.levelsTotal) || 0,
      elapsed: result.elapsed != null ? result.elapsed : (prev && prev.elapsed) || 0,
      tries: result.tries != null ? result.tries : (prev && prev.tries) || 0,
      hints: result.hints != null ? result.hints : (prev && prev.hints) || 0,
      stars: result.stars != null ? result.stars : (prev && prev.stars) || 0,
      at: Date.now(),
    };

    if (!prev || better(next, prev)) doc.maps[id] = next;
    doc.maps[id].at = Date.now();   // 最近一次触碰时间总是更新（用于"最近玩的"）
    return doc;
  }

  /* ---------------- 统计：给界面用的汇总 ---------------- */
  function summary(doc, allMaps) {
    const list = Object.keys(doc.maps).map((k) => doc.maps[k]);
    const solvedMaps = list.filter((m) => m.solved);
    const totalMaps = Array.isArray(allMaps) && allMaps.length ? allMaps.length : list.length;

    // 按省汇总（用于"省级全通"和进度条）
    const provinces = {};
    list.forEach((m) => {
      const key = m.province || 'unknown';
      provinces[key] = provinces[key] || { id: key, name: m.provinceName || key, total: 0, solved: 0 };
      provinces[key].total++;
      if (m.solved) provinces[key].solved++;
    });

    const totalElapsed = solvedMaps.reduce((n, m) => n + (m.elapsed || 0), 0);
    const totalStars = solvedMaps.reduce((n, m) => n + (m.stars || 0), 0);
    const noHintMaps = solvedMaps.filter((m) => (m.hints || 0) === 0).length;

    return {
      solvedMaps: solvedMaps.length,
      totalMaps: totalMaps,
      percent: totalMaps ? Math.round((solvedMaps.length / totalMaps) * 100) : 0,
      totalElapsed: totalElapsed,
      totalStars: totalStars,
      noHintMaps: noHintMaps,
      provinces: provinces,
      solvedProvinces: Object.values(provinces).filter((p) => p.total > 0 && p.solved >= p.total).length,
    };
  }

  /* ---------------- 成就：用纯函数判定，规则一目了然 ---------------- */
  /**
   * 每条成就 = { id, name, desc, test(summary, doc) }
   * 【为什么用"声明式规则"而不是散在各处的 if】
   * 成就规则会长、会变。集中成一张表以后：
   *   · 加一条成就 = 加一行，不动别处
   *   · 可以在 Node 里直接跑断言（见 tools/test-progress.js）
   * 阈值参考了常见的"最近可达成"设计：不要设得遥不可及，也不要一开始就给光。
   */
  const BADGES = [
    { id: 'first', name: '第一步', desc: '拼完你的第一张地图' },
    { id: 'ten', name: '十图达成', desc: '拼完 10 张地图' },
    { id: 'fifty', name: '五十图', desc: '拼完 50 张地图' },
    { id: 'century', name: '百图征服者', desc: '拼完 100 张地图' },
    { id: 'province', name: '一省全通', desc: '把一个省的下辖地图全部拼完' },
    { id: 'province3', name: '三省长', desc: '三个省全通' },
    { id: 'nohint', name: '过目不忘', desc: '不用提示拼完 10 张地图' },
    { id: 'speedster', name: '闪电手', desc: '单张地图在 60 秒内通关' },
    { id: 'stars', name: '完美主义者', desc: '累计获得 30 颗星' },
  ];

  /** 判定当前应得哪些成就（纯函数，不写存储） */
  function evaluate(summaryData, doc) {
    const s = summaryData;
    const best = Object.keys(doc.maps).map((k) => doc.maps[k]).filter((m) => m.solved);
    const has = {
      first: s.solvedMaps >= 1,
      ten: s.solvedMaps >= 10,
      fifty: s.solvedMaps >= 50,
      century: s.solvedMaps >= 100,
      province: s.solvedProvinces >= 1,
      province3: s.solvedProvinces >= 3,
      nohint: s.noHintMaps >= 10,
      speedster: best.some((m) => (m.elapsed || 1e9) <= 60000),
      stars: s.totalStars >= 30,
    };
    return BADGES.filter((b) => has[b.id]).map((b) => b.id);
  }

  /**
   * 把新达成的成就并进文档，返回**本次新获得**的成就列表（用于弹提示）。
   * 幂等：重复调用不会重复返回。
   */
  function claimBadges(doc, summaryData) {
    const earned = evaluate(summaryData, doc);
    const before = new Set(doc.badges || []);
    const fresh = earned.filter((id) => !before.has(id));
    doc.badges = Array.from(new Set((doc.badges || []).concat(earned)));
    return fresh.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);
  }

  /** 给界面用：每条成就 + 是否已获得 */
  function badgeList(doc) {
    const got = new Set(doc.badges || []);
    return BADGES.map((b) => ({ id: b.id, name: b.name, desc: b.desc, earned: got.has(b.id) }));
  }

  global.MapProgress = {
    STORE_KEY,
    SCHEMA_VERSION,
    BADGES,
    load,
    save,
    record,
    summary,
    evaluate,
    claimBadges,
    badgeList,
    emptyDoc,
    /* 每日一图 */
    dayKey,
    hashString,
    pickDaily,
    checkIn,
    checkedInToday,
    /* 我的家乡 */
    setHometown,
    getHometown,
    isHometown,
    searchPlaces,
  };
})(typeof window !== 'undefined' ? window : globalThis);
