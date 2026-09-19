/* =====================================================================
 * 启动引导 · 地图拼图
 * ---------------------------------------------------------------------
 * 路径：js/game.js
 *
 * 这个文件刻意做得很薄：只负责"挑一张地图 → 交给引擎 → 启动"。
 * 所有游戏逻辑都在 js/engine.js 里，所以换地图不需要动引擎。
 *
 * 【启动流程】
 *   1. 从 URL 读 ?map=<id>（没有就用默认地图）
 *   2. MapLoader.load(id) —— 按 registry 动态注入该地图的三个脚本
 *      （只注入这一张，别的地图一行代码都不会下载）
 *   3. 拿到配置交给 MapPuzzleEngine.create(config).start()
 *   4. 在 <html data-map-ready="<id>"> 上打标记 + 派发 map-ready 事件，
 *      好让宿主页 / 自动化测试知道"地图真的就绪了"，不必靠 sleep 猜
 *
 * 【为什么宿主页要自己发就绪信号】引擎不自动启动、也不认识 URL，
 * 它是被这个文件拉起来的；那么"什么时候算启动完成"自然由这里宣布。
 * 测试里 load 之后还要等引擎建 DOM，所以干脆以这里的标记为准。
 * ===================================================================== */

(function (global) {
  'use strict';

  /** 没有 ?map= 参数时默认启动哪张地图。
   *
   *  【为什么是中国图而不是成都】中国图是这套东西的"门面"：
   *  它一眼说清这是什么产品（认识中国的省市区县），而成都只是它下面的一张子图 ——
   *  拿一张市级图当默认入口，会把"全国 363 张"这个规模感完全藏起来。
   *  默认入口曾经是 chengdu，2026-09 改为 china。
   *
   *  【改这里的前提已经满足】中国图第 5 关（华南）含澳门这种极小目标，
   *  早年改默认图会让新用户第一眼就卡在"看不见的碎片"上。
   *  现在引擎有"按下即推近镜头"的自动放大兜着，这个前提才成立 ——
   *  所以这次改动不是随手换一个常量，而是等拖拽体验稳了才做。 */
  const DEFAULT_MAP = 'china';

  /** 当前地图 id。boot() 里赋值；分享/进度等跨函数逻辑要用到它 */
  let CURRENT_ID = DEFAULT_MAP;
  /* 玩法模式（js/modes.js 是纯逻辑层）。MODE_DOC 是整份本机存档：
   * 模式偏好 + 各图最佳成绩 + 错题集 + 对战战绩 + 教学选区。 */
  let MODE_DOC = null;
  let CURRENT_MODE = 'normal';
  let CURRENT_DIFF = 'normal';
  /* 本局的临时统计（不进存档，换关就重来）：
   * perTry 用来生成练习报告的"逐项明细"，duel 是双人回合状态。 */
  let SESSION = null;
  /* 教学模式裁剪前的完整关卡列表（"选要练的行政区"面板要按它列全部） */
  let FULL_LEVELS = null;

  function showFatal(message) {
    /* 出错时也要把骨架屏摘掉，否则它会盖住错误提示 */
    try { hideBootSkeleton(); } catch (e) { /* 骨架屏还没解析出来就算了 */ }
    document.body.innerHTML =
      '<p style="padding:40px;color:#e7f2ec;font-family:sans-serif">' + message + '</p>';
  }

  /** URL 里指定的地图 id，没有就用默认值 */
  /* ==================================================================
   * 地图包校验（错误边界加固）
   * ------------------------------------------------------------------
   * 地图是按需注入脚本加载的：脚本 404、geo 文件被截断、关卡字段写错，
   * 都可能让引擎拿着半成品配置去画图，然后**静默卡死**（白屏、控制台只有
   * 一句看不懂的类型错误）。这里在交给引擎之前先验一遍必填项，
   * 不合法就给出"哪张图、缺什么、怎么修"的人话提示。
   * ================================================================ */
  function validateConfig(config, id) {
    const where = '地图「' + id + '」';
    const pkg = global.MAP_PACKAGES && global.MAP_PACKAGES[id];

    if (!config) {
      return { ok: false, reason: where + '的脚本没有登记到 window.MAP_PACKAGES。' +
        '检查 js/maps/' + id + '.js 末尾是否执行了 PACKAGES["' + id + '"] = CONFIG；' +
        '以及 js/maps/registry.js 里这张图的 dir 是否正确。' };
    }
    const geo = config.geo;
    if (!geo || !Array.isArray(geo.features)) {
      return { ok: false, reason: where + '的边界数据（geo）缺失或格式不对：' +
        '期望 { type:"FeatureCollection", features:[…] }，实际拿到 ' +
        (geo === undefined ? 'undefined' : typeof geo) + '。' +
        '重新生成：node tools/add-map.js --adcode=<6位> --name=' + id + ' --parent=<父id>' };
    }
    if (!geo.features.length) {
      return { ok: false, reason: where + '的边界数据是空的（features 长度 0）。' +
        '多半是 .geo.js 生成到一半失败或文件被截断，重新生成一次即可。' };
    }
    if (!Array.isArray(config.levels) || !config.levels.length) {
      return { ok: false, reason: where + '没有关卡（levels 为空）。' +
        '检查 js/maps/' + (id === 'china' ? 'china' : id) + '.data.js 里的 LEVELS 是否有 adcodes。' };
    }
    const emptyLevel = config.levels.filter((l) => !Array.isArray(l.adcodes) || !l.adcodes.length);
    if (emptyLevel.length) {
      return { ok: false, reason: where + '有 ' + emptyLevel.length + ' 个关卡是空的（adcodes 长度 0）：' +
        emptyLevel.map((l) => l.id || '(无 id)').join('、') + '。' };
    }
    /* 关卡里的 adcode 必须在 geo 里存在，否则那块永远拼不上（静默卡住） */
    const have = new Set(geo.features.map((f) => Number(f.properties.adcode)));
    const ghost = [];
    config.levels.forEach((l) => (l.adcodes || []).forEach((a) => {
      if (!have.has(Number(a))) ghost.push(l.id + ':' + a);
    }));
    if (ghost.length) {
      return { ok: false, reason: where + '的关卡里出现了 geo 里不存在的 adcode（' +
        ghost.slice(0, 6).join('、') + '）—— 这些块永远拼不上。' +
        '多半是 .data.js 的 LEVELS 与 .geo.js 不同源，两边对不上。' };
    }
    if (!pkg) {
      return { ok: false, reason: where + '注册到了 MAP_PACKAGES 但取不到，可能被别的脚本覆盖了。' };
    }
    return { ok: true };
  }

  function pickMapId() {
    let fromUrl = null;
    try {
      fromUrl = new URLSearchParams(global.location.search).get('map');
    } catch (e) {
      fromUrl = null; // 极老的浏览器：退回默认地图，不影响游戏
    }
    if (fromUrl) return fromUrl;

    // 默认地图万一不在 registry 里（被改名/删掉了），退回第一张，别把页面搞白
    const maps = global.MAP_REGISTRY && global.MAP_REGISTRY.maps;
    if (maps && !maps[DEFAULT_MAP]) {
      const first = Object.keys(maps)[0];
      if (first) return first;
    }
    return DEFAULT_MAP;
  }

  /** 宣布"这张地图已经就绪"：给宿主页和测试一个确定的信号 */
  /** 摘掉加载骨架屏。
   *  两个时机都要摘：地图就绪（markReady）、以及**出错**（showFatal）——
   *  只摘成功的那个，出错时骨架屏会一直转下去，比没有骨架屏更糟。 */
  function hideBootSkeleton() {
    const el = document.getElementById('bootSkeleton');
    if (!el || el.hidden) return;
    el.classList.add('is-gone');
    /* 先淡出再 hidden：直接 hidden 会"啪"地消失。
     * 用 setTimeout 而不是 transitionend —— 动画被系统设置禁用时不会有 transitionend 事件。 */
    setTimeout(() => { el.hidden = true; }, 260);
  }

  function markReady(id) {
    hideBootSkeleton();
    document.documentElement.setAttribute('data-map-ready', id);
    try {
      document.dispatchEvent(new global.CustomEvent('map-ready', { detail: { id } }));
    } catch (e) {
      /* CustomEvent 不可用时忽略：属性标记已经足够 */
    }
  }

  /* ==================================================================
   * 玩法模式（宿主层）· 逻辑全在 js/modes.js，这里只负责接线
   * ------------------------------------------------------------------
   * 六套模式：普通 / 计时挑战 / 教学学习 / 考试刷题 / 儿童模式 / 本地双人对战。
   * 它们共用同一套引擎，区别只是 js/modes.js 翻译出来的几个开关。
   * ================================================================ */

  const M = () => global.MapModes;

  function initModes() {
    if (!M()) return;
    MODE_DOC = M().load();
    /* URL 参数优先于存档：?mode=exam 方便老师直接把某套模式的链接发给学生。
     * 这也是"零成本传播"的一部分 —— 老师不用口头教学生怎么点。 */
    const q = new URLSearchParams(global.location.search);
    const mq = q.get('mode');
    if (mq && M().isModeId(mq)) CURRENT_MODE = mq;
    else CURRENT_MODE = MODE_DOC.mode;
    const dq = q.get('diff');
    CURRENT_DIFF = (dq && M().DIFFICULTIES.some((d) => d.id === dq)) ? dq : MODE_DOC.difficulty;

    /* 大屏适配（教学用）也能从 URL 直接开：?big=1 */
    if (q.get('big') === '1') document.documentElement.setAttribute('data-bigscreen', '1');

    SESSION = newSession();
    renderModeSelect();
    bindModeUI();
    applyModeChrome();
  }

  /** 教学模式：按 ?pick= 裁剪本张图的关卡（只影响本次会话，不改源数据文件） */
  function applyTeachPick(cfg) {
    if (!cfg || !Array.isArray(cfg.levels)) return;
    /* 完整列表只有教学模式要用（选择面板）；其它模式不必留 */
    if (CURRENT_MODE !== 'teach') return;
    FULL_LEVELS = cfg.levels.map((l) => ({ id: l.id, name: l.name, adcodes: l.adcodes.slice() }));

    const raw = new URLSearchParams(global.location.search).get('pick');
    if (!raw) return;
    const want = raw.split(',').map((x) => Number(x.trim())).filter((x) => x > 0);
    if (!want.length) return;

    /* 把选中的行政区重新编成"一关"。刻意只留一关：
     * 自选练习的意图就是"把这一批练熟"，再分关反而添乱。 */
    const picked = cfg.levels
      .reduce((acc, l) => acc.concat(l.adcodes), [])
      .filter((a) => want.indexOf(Number(a)) >= 0);
    if (!picked.length) return;
    cfg.levels = [{
      id: 'pick',
      name: '自选练习 · ' + picked.length + ' 个行政区',
      short: '自选',
      color: (cfg.levels[0] && cfg.levels[0].color) || '#3fb08a',
      blurb: '这是老师/自己挑出来的一组行政区。想换一批，点上面的「选要练的行政区」。',
      adcodes: picked,
    }];
  }

  function newSession() {
    return { perTry: {}, duel: M().duelInit(), startedAt: Date.now() };
  }

  /** 把当前模式写回存档（切模式/切难度时调） */
  function persistModes() {
    if (!MODE_DOC) return;
    MODE_DOC.mode = CURRENT_MODE;
    MODE_DOC.difficulty = CURRENT_DIFF;
    M().save(MODE_DOC);
  }

  function renderModeSelect() {
    const sel = document.getElementById('modeSelect');
    if (sel) {
      sel.innerHTML = M().MODES.map((m) =>
        '<option value="' + m.id + '">' + m.name + '</option>').join('');
      sel.value = CURRENT_MODE;
    }
    const dsel = document.getElementById('diffSelect');
    if (dsel) {
      dsel.innerHTML = M().DIFFICULTIES.map((d) =>
        '<option value="' + d.id + '">' + d.name + ' · ' + d.desc + '</option>').join('');
      dsel.value = CURRENT_DIFF;
    }
  }

  function bindModeUI() {
    const sel = document.getElementById('modeSelect');
    if (sel && !sel.dataset.bound) {
      sel.dataset.bound = '1';
      sel.addEventListener('change', () => {
        CURRENT_MODE = sel.value;
        persistModes();
        /* 模式会影响引擎配置（藏不藏地名、给不给提示、关不关动画），
         * 而引擎配置是创建时读一次的。所以**换模式 = 重新加载这一页**，
         * 而不是运行时改配置 —— 这样引擎不必支持"热切换"，
         * 也不会出现"改了一半、状态不一致"的中间态。 */
        const u = new URL(global.location.href);
        u.searchParams.set('mode', CURRENT_MODE);
        u.searchParams.set('diff', CURRENT_DIFF);
        global.location.href = u.toString();
      });
    }
    const dsel = document.getElementById('diffSelect');
    if (dsel && !dsel.dataset.bound) {
      dsel.dataset.bound = '1';
      dsel.addEventListener('change', () => {
        CURRENT_DIFF = dsel.value;
        persistModes();
        const u = new URL(global.location.href);
        u.searchParams.set('mode', CURRENT_MODE);
        u.searchParams.set('diff', CURRENT_DIFF);
        global.location.href = u.toString();
      });
    }
  }

  /** 模式带来的"页面级"变化：难度选择器显隐、body 上的模式标记 */
  function applyModeChrome() {
    const flags = M().uiFlags(CURRENT_MODE);
    const dp = document.getElementById('diffPicker');
    if (dp) dp.hidden = !flags.difficulty;
    /* 模式标记挂到 <html> 上，CSS 就能按模式微调（儿童模式简化统计、
     * 考试模式去动画、教学大屏放大字号）—— 不改 JS 结构。 */
    document.documentElement.setAttribute('data-mode', CURRENT_MODE);
    if (flags.simpleStats) document.documentElement.setAttribute('data-simple-stats', '1');
    else document.documentElement.removeAttribute('data-simple-stats');
  }

  /* ---------------- 放置回调：回合 / 错题集 / 练习明细 ---------------- */

  /** 引擎每放一块都会调这里（正确与否都会）。引擎只报"发生了什么"。 */
  function onPlacement(p) {
    if (!M()) return;
    const flags = M().uiFlags(CURRENT_MODE);
    const rec = SESSION.perTry[p.adcode] || (SESSION.perTry[p.adcode] = { tries: 0, correct: false });
    rec.tries += 1;
    if (p.correct) rec.correct = true;

    /* 错题集：记的是"玩家没能放对的那一块"（p.adcode 是碎片本身，
     * 也就是正确位置还没被认出来的那个行政区）。这正是要重点练的。 */
    if (!p.correct) {
      M().recordWrong(MODE_DOC, CURRENT_ID, [p.adcode]);
      M().save(MODE_DOC);
    }

    /* 双人对战：每放一块算一轮，不管对错都换手 */
    if (flags.duel) {
      SESSION.duel = M().duelAfterTurn(SESSION.duel, !!p.correct);
      renderModeBar();
      flashTurnOwner(p.correct);
    } else {
      renderModeBar();
    }
  }

  /** 换手时给个视觉提示：谁刚动过手 */
  function flashTurnOwner(correct) {
    const bar = document.getElementById('modeBar');
    if (!bar) return;
    bar.classList.remove('is-hit', 'is-miss');
    void bar.offsetWidth;                 // 强制重排，让动画能重播
    bar.classList.add(correct ? 'is-hit' : 'is-miss');
  }

  /* ---------------- 模式信息条 ---------------- */

  function renderModeBar() {
    const bar = document.getElementById('modeBar');
    if (!bar || !M()) return;
    const flags = M().uiFlags(CURRENT_MODE);
    const eng = global.__ENGINE__;
    const st = eng && eng.getState ? eng.getState() : {};
    const parts = [];

    if (flags.timer) {
      parts.push('<span class="mb-item"><b>⏱</b> <span id="mbTimer">' +
        M().fmtMs(st.elapsed || 0) + '</span></span>');
    }
    if (flags.best) {
      const best = M().bestOf(MODE_DOC, CURRENT_ID, CURRENT_DIFF);
      parts.push('<span class="mb-item">' +
        (best ? '<b>🏆</b> 最佳 ' + M().fmtMs(best.ms) + '（' + M().difficultyById(CURRENT_DIFF).short + '）'
              : '<b>🏆</b> 还没有最佳成绩') + '</span>');
    }
    if (flags.accuracy) {
      const r = M().examResult((st.piecesLeft || 0) + (st.placed || []).length, st.tries || 0);
      parts.push('<span class="mb-item"><b>🎯</b> 正确率 ' + r.accuracy + '%</span>');
    }
    if (flags.duel) {
      const d = SESSION.duel;
      const pa = M().playerById('a');
      const pb = M().playerById('b');
      parts.push('<span class="mb-item is-turn">轮到 <b>' +
        M().playerById(d.turn).name + '</b></span>');
      parts.push('<span class="mb-item">' + pa.name + ' <b>' + d.scores.a + '</b></span>');
      parts.push('<span class="mb-item">' + pb.name + ' <b>' + d.scores.b + '</b></span>');
    }
    if (flags.teachTools) {
      parts.push('<button type="button" class="mb-btn" id="mbPick">选要练的行政区</button>');
      parts.push('<button type="button" class="mb-btn" id="mbReport">导出练习报告</button>');
      parts.push('<button type="button" class="mb-btn" id="mbBig">' +
        (document.documentElement.getAttribute('data-bigscreen') === '1' ? '退出大屏' : '课堂大屏') +
        '</button>');
    }
    if (flags.simpleStats) {
      parts.push('<span class="mb-item">已经放好 <b>' + (st.placed || []).length +
        '</b> 块，还剩 <b>' + (st.piecesLeft || 0) + '</b> 块</span>');
    }
    if (flags.duel || flags.best || flags.accuracy || flags.teachTools) {
      parts.push('<button type="button" class="mb-btn" id="mbMore">' +
        (flags.duel ? '对战说明' : '看更多') + '</button>');
    }

    bar.hidden = parts.length === 0;
    bar.innerHTML = parts.join('');
    bindModeBarButtons();
  }

  function bindModeBarButtons() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el && !el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('click', fn); }
    };
    on('mbPick', openPickPanel);
    on('mbReport', openReportPanel);
    on('mbMore', openReportPanel);
    on('mbBig', toggleBigScreen);
  }

  function toggleBigScreen() {
    const cur = document.documentElement.getAttribute('data-bigscreen') === '1';
    if (cur) document.documentElement.removeAttribute('data-bigscreen');
    else document.documentElement.setAttribute('data-bigscreen', '1');
    renderModeBar();
  }

  /* ---------------- 模式面板（选区 / 报告 / 错题清单 / 对战说明） ---------------- */

  function openPanel(html) {
    const panel = document.getElementById('modePanel');
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = html;
    const close = panel.querySelector('.sp-close');
    if (close) close.addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', (ev) => { if (ev.target === panel) panel.hidden = true; });
    return panel;
  }

  const panelHead = (title) =>
    '<div class="sp-head"><h2>' + title + '</h2>' +
    '<button type="button" class="sp-close" aria-label="关闭">✕</button></div>';

  /** 当前这张图本关的全部行政区（教学选区用） */
  function currentDistricts() {
    const eng = global.__ENGINE__;
    const st = eng && eng.getState ? eng.getState() : {};
    const entry = global.MapLoader.entry(CURRENT_ID) || {};
    return { placed: st.placed || [], levelId: st.levelId };
  }

  /** 教学：勾选要练的行政区 */
  function openPickPanel() {
    const cfg = global.MAP_PACKAGES && global.MAP_PACKAGES[CURRENT_ID];
    if (!cfg) return;
    const all = [];
    (FULL_LEVELS || cfg.levels || []).forEach((lv) => (lv.adcodes || []).forEach((a) => {
      if (all.indexOf(a) < 0) all.push(a);
    }));
    const picked = M().getPick(MODE_DOC, CURRENT_ID).map(Number);
    const nameOf = (ad) => {
      const f = (cfg.geo && cfg.geo.features || []).filter((x) => Number(x.properties.adcode) === Number(ad))[0];
      return f ? f.properties.name : String(ad);
    };
    const panel = openPanel(
      panelHead('选要练的行政区') +
      '<p class="rp-tip">勾选后点「套用」会重新加载本页，只保留选中的行政区。' +
      '全不勾＝练全部（共 ' + all.length + ' 个）。</p>' +
      '<div class="pk-list">' +
      all.map((ad) =>
        '<label class="pk-item"><input type="checkbox" value="' + ad + '"' +
        (picked.indexOf(Number(ad)) >= 0 ? ' checked' : '') + '> ' + nameOf(ad) + '</label>'
      ).join('') +
      '</div>' +
      '<div class="sp-actions">' +
      '<button type="button" class="btn btn-primary" id="pkApply">套用</button>' +
      '<button type="button" class="btn btn-ghost" id="pkAll">全选</button>' +
      '<button type="button" class="btn btn-ghost" id="pkNone">全不选</button>' +
      '</div>');
    if (!panel) return;
    panel.querySelector('#pkAll').addEventListener('click', () => {
      panel.querySelectorAll('.pk-item input').forEach((i) => { i.checked = true; });
    });
    panel.querySelector('#pkNone').addEventListener('click', () => {
      panel.querySelectorAll('.pk-item input').forEach((i) => { i.checked = false; });
    });
    panel.querySelector('#pkApply').addEventListener('click', () => {
      const sel = [...panel.querySelectorAll('.pk-item input:checked')].map((i) => i.value);
      M().setPick(MODE_DOC, CURRENT_ID, sel);
      M().save(MODE_DOC);
      /* 选区是"关卡内容"级别的改动，同样用重新加载来避免中间态 */
      const u = new URL(global.location.href);
      if (sel.length) u.searchParams.set('pick', sel.join(','));
      else u.searchParams.delete('pick');
      global.location.href = u.toString();
    });
  }

  /** 计时/考试/双人：成绩、错题、说明 都在这一个面板里 */
  function openReportPanel() {
    const flags = M().uiFlags(CURRENT_MODE);
    if (flags.duel) {
      const d = SESSION.duel;
      const pa = M().playerById('a');
      const pb = M().playerById('b');
      const hist = MODE_DOC.duel[CURRENT_ID] || { a: 0, b: 0 };
      openPanel(
        panelHead('本地双人对战') +
        '<p class="rp-tip">同一台设备上两人轮流拼，每放一块换一次手。' +
        '放对 +' + M().DUEL_HIT + ' 分，放错 -' + M().DUEL_MISS + ' 分（不低于 0）。' +
        '<br>全程离线，不需要联网，也不需要账号。</p>' +
        '<dl class="mb-facts">' +
        '<div><dt>本局比分</dt><dd>' + pa.name + ' ' + d.scores.a + ' : ' + d.scores.b + ' ' + pb.name + '</dd></div>' +
        '<div><dt>已进行</dt><dd>' + d.rounds + ' 轮</dd></div>' +
        '<div><dt>这张图历史战绩</dt><dd>' + pa.name + ' ' + (hist.a || 0) + ' 胜 · ' +
        pb.name + ' ' + (hist.b || 0) + ' 胜 · 平 ' + (hist.tie || 0) + '</dd></div>' +
        '</dl>');
      return;
    }
    if (flags.teachTools) { openTeachReport(); return; }
    openBestPanel();
  }

  /** 教学：导出 Markdown 练习报告 */
  function openTeachReport() {
    const cfg = global.MAP_PACKAGES && global.MAP_PACKAGES[CURRENT_ID];
    if (!cfg) return;
    const eng = global.__ENGINE__;
    const st = eng && eng.getState ? eng.getState() : {};
    const entry = global.MapLoader.entry(CURRENT_ID) || {};
    const all = [];
    (cfg.levels || []).forEach((lv) => (lv.adcodes || []).forEach((a) => {
      if (all.indexOf(a) < 0) all.push(a);
    }));
    const picked = M().getPick(MODE_DOC, CURRENT_ID).map(Number);
    const scope = picked.length ? picked : all;
    const byAd = {};
    (cfg.geo && cfg.geo.features || []).forEach((f) => { byAd[Number(f.properties.adcode)] = f.properties.name; });
    const items = scope.map((ad) => ({
      name: byAd[Number(ad)] || String(ad),
      area: (cfg.districts && cfg.districts[ad] && cfg.districts[ad].area) || null,
      correct: !!(SESSION.perTry[ad] && SESSION.perTry[ad].correct),
      tries: (SESSION.perTry[ad] && SESSION.perTry[ad].tries) || 0,
    }));
    const md = M().markdownReport({
      mapName: entry.name || CURRENT_ID,
      scopeLabel: M().scopeLabel(picked, all),
      total: scope.length,
      tries: st.tries || 0,
      hints: st.hints || 0,
      elapsed: st.elapsed || 0,
      items: items,
    });
    const panel = openPanel(
      panelHead('练习报告（Markdown）') +
      '<p class="rp-tip">可以直接复制去备课，或下载成 .md 文件。</p>' +
      '<textarea class="rp-text" id="teachMd" readonly rows="12"></textarea>' +
      '<div class="sp-actions">' +
      '<button type="button" class="btn btn-primary" id="teachCopy">复制</button>' +
      '<button type="button" class="btn btn-ghost" id="teachDl">下载 .md</button>' +
      '</div>' +
      '<p class="sp-tip" id="teachTip">报告里含每个行政区的面积与作答结果</p>');
    if (!panel) return;
    panel.querySelector('#teachMd').value = md;
    const tip = panel.querySelector('#teachTip');
    panel.querySelector('#teachCopy').addEventListener('click', () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(
            () => { tip.textContent = '已复制到剪贴板'; },
            () => { tip.textContent = '浏览器不让自动复制，请手动选中上面的文本'; });
          return;
        }
      } catch (e) { /* 落到下面的兜底 */ }
      tip.textContent = '请手动选中上面的文本复制';
    });
    panel.querySelector('#teachDl').addEventListener('click', () => {
      const blob = new global.Blob([md], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = global.URL.createObjectURL(blob);
      a.download = '地图拼图-练习报告-' + (entry.name || CURRENT_ID) + '.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      tip.textContent = '已开始下载';
    });
  }

  /** 计时 / 考试：最佳成绩、易错行政区、错题清单 */
  function openBestPanel() {
    const flags = M().uiFlags(CURRENT_MODE);
    const eng = global.__ENGINE__;
    const st = eng && eng.getState ? eng.getState() : {};
    const entry = global.MapLoader.entry(CURRENT_ID) || {};
    const best = M().bestOf(MODE_DOC, CURRENT_ID, CURRENT_DIFF);
    const weak = M().weakSet(MODE_DOC, CURRENT_ID, 12);
    const cfg = global.MAP_PACKAGES && global.MAP_PACKAGES[CURRENT_ID];
    const byAd = {};
    if (cfg) (cfg.geo && cfg.geo.features || []).forEach((f) => { byAd[Number(f.properties.adcode)] = f.properties.name; });

    const rows = M().DIFFICULTIES.map((d) => {
      const b = M().bestOf(MODE_DOC, CURRENT_ID, d.id);
      return '<div><dt>' + d.name + '</dt><dd>' + (b ? M().fmtMs(b.ms) : '—') + '</dd></div>';
    }).join('');

    const res = M().examResult((st.piecesLeft || 0) + (st.placed || []).length, st.tries || 0);
    const panel = openPanel(
      panelHead(flags.accuracy ? '测验结果' : '个人最佳成绩') +
      (flags.accuracy
        ? '<dl class="mb-facts">' +
          '<div><dt>正确率</dt><dd><b>' + res.accuracy + '%</b>（' + res.grade + '）</dd></div>' +
          '<div><dt>放错次数</dt><dd>' + res.wrongTries + '</dd></div>' +
          '<div><dt>本关用时</dt><dd>' + M().fmtMs(st.elapsed || 0) + '</dd></div>' +
          '</dl>'
        : '<dl class="mb-facts">' + rows + '</dl>') +
      '<h3 class="mb-sub">易错行政区（薄弱练习集）</h3>' +
      (weak.length
        ? '<ol class="mb-weak">' + weak.map((w) =>
            '<li>' + (byAd[Number(w.adcode)] || w.adcode) + ' <span>错了 ' + w.times + ' 次</span></li>').join('') + '</ol>'
        : '<p class="rp-tip">还没有错题记录。这张图拼得不错。</p>') +
      '<div class="sp-actions">' +
      (weak.length ? '<button type="button" class="btn btn-ghost" id="mbClear">清空错题记录</button>' : '') +
      '</div>');
    if (!panel) return;
    const clr = panel.querySelector('#mbClear');
    if (clr) clr.addEventListener('click', () => {
      M().clearWrong(MODE_DOC, CURRENT_ID);
      M().save(MODE_DOC);
      panel.hidden = true;
      renderModeBar();
    });
  }

  /* ---------------- 结算时的模式附加动作 ---------------- */

  function onModeMapSolved(result) {
    if (!M()) return;
    const flags = M().uiFlags(CURRENT_MODE);

    if (flags.best) {
      const r = M().recordBest(MODE_DOC, CURRENT_ID, CURRENT_DIFF, {
        ms: result.elapsed, tries: result.tries, hints: result.hints,
      });
      if (r.isNewBest) {
        showBadgeToast([{ icon: '🏆', name: '新纪录', desc: '这张图的最佳成绩被刷新了' }]);
      }
      M().save(MODE_DOC);
    }
    if (flags.duel) {
      SESSION.duel = M().duelFinish(SESSION.duel);
      M().recordDuel(MODE_DOC, CURRENT_ID, SESSION.duel.winner);
      M().save(MODE_DOC);
      const w = SESSION.duel.winner;
      showBadgeToast([{
        icon: '🤝', name: w === 'tie' ? '平局！' : M().playerById(w).name + ' 获胜',
        desc: SESSION.duel.scores.a + ' : ' + SESSION.duel.scores.b,
      }]);
    }
    renderModeBar();
  }

  /* ================== 地图导航（宿主层） ==================
   * 引擎完全不认识 parent / children / adcode 这些层级字段，
   * "在一棵树里上下走"是宿主页的事，所以下面这些一行都不进 engine.js。
   * 数据全部来自 js/maps/registry.js（由 tools/build-registry.js 生成）。
   * ====================================================== */

  /** 切到某张地图的 URL：只换查询串，其余一概不动 */
  function urlForMap(id) {
    return '?map=' + encodeURIComponent(id);
  }

  /** 切换地图 = 换 URL 重新加载页面 */
  function goToMap(id) {
    global.location.href = urlForMap(id);
  }

  /**
   * 把页面文案换成当前这张地图的。
   *
   * 【为什么必须有这个函数】index.html 是**静态骨架**，里面的"成都"只是占位，
   * 真正的文案必须由当前地图驱动 —— 否则进河北也写着"成都地图拼图"。
   * 实测踩过的坑：早先只同步了标题栏（brandTitle / brandSub），
   * **漏了整屏欢迎动画**（intro-kicker / intro-title），
   * 于是每次进游戏开场都写"CHENGDU · 20 个区县"。
   * 所以这里统一处理三处：标题栏 + 欢迎动画 + 无障碍标签/文档标题。
   */
  function updateBrand(config, id) {
    const name = (config && config.name) || id;
    // 数量以配置里的 districtCount 为准：geo 里可能还混着非行政区 feature
    // （比如全国数据里的南海九段线），拿 features.length 会多说一个
    const count = (config && config.texts && config.texts.districtCount) ||
      (config && config.geo && config.geo.features.length) || 0;
    const unit = (config && config.texts && config.texts.districtUnit) || '个下级行政区';

    // ① 标题栏
    const title = document.getElementById('brandTitle');
    const sub = document.getElementById('brandSub');
    if (title) title.textContent = name + '地图拼图';
    if (sub) sub.textContent = '拖动碎片，拼出' + name + (count ? '的 ' + count + ' ' + unit : '');

    // ② 欢迎动画（整屏开场）—— 曾经漏掉的就是这里
    const kicker = document.getElementById('introKicker');
    const introTitle = document.getElementById('introTitle');
    const introSub = document.getElementById('introSub');
    if (kicker) kicker.textContent = count ? name + ' · ' + count + ' ' + unit : name;
    if (introTitle) introTitle.textContent = name + '地图拼图';
    if (introSub) introSub.textContent = '拖动碎片，把它们放回地图上本来的位置';

    // ③ 无障碍与文档标题
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.setAttribute('aria-label', name + '行政区划拼图板');
    const introEl = document.getElementById('intro');
    if (introEl) introEl.setAttribute('aria-label', '欢迎来到' + name + '地图拼图');
    document.title = name + '地图拼图';
  }

  /** 渲染面包屑：中国 › 四川省 › 自贡市（前几级可点，末级是当前） */
  function renderBreadcrumb(currentId) {
    const list = document.getElementById('breadcrumb');
    if (!list) return;
    const trail = global.MapLoader.trail(currentId);
    list.innerHTML = '';
    trail.forEach((m, i) => {
      const li = document.createElement('li');
      if (i === trail.length - 1) {
        li.className = 'crumb is-current';
        li.setAttribute('aria-current', 'page');
        li.textContent = m.name;
      } else {
        const a = document.createElement('a');
        a.className = 'crumb-link';
        a.href = urlForMap(m.id);
        a.textContent = m.name;
        // 上层地图就是"返回上一级"，所以不再单独做一个按钮
        a.title = '回到' + m.name;
        li.appendChild(a);
      }
      list.appendChild(li);
    });
  }

  /**
   * 渲染地图选择器。
   *
   * 【为什么按省分组】接入全国后这里有 363 个选项，平铺成一长条极难找。
   * 改成两层结构，让"层级"由分组表达，而不是靠缩进空格：
   *   · 每个省级地图 = 一个 <optgroup>（组标签就是省名）
   *   · 省级自己放在组内第一项（标注"全省"）= 看全省
   *   · 地级市放进所属省的组里，不再缩进（组已经表达了层级）
   * 父级还没接入的地图（registry.orphans）仍挂出来并注明，不藏起来 ——
   * 它是"父级空位还等着填"的信号，不该让用户在界面上找不到。
   */
  function renderSelect(currentId) {
    const sel = document.getElementById('mapSelect');
    if (!sel) return;
    const reg = global.MAP_REGISTRY || { roots: [], orphans: [], maps: {} };
    sel.innerHTML = '';

    const makeOption = (id, note) => {
      const m = global.MapLoader.entry(id);
      if (!m) return null;
      const o = document.createElement('option');
      o.value = id;
      o.textContent = m.name + (note ? '（' + note + '）' : '');
      if (id === currentId) o.selected = true;
      return o;
    };

    const roots = reg.roots || [];
    const placed = new Set();

    // ① 省级分组：每个根（中国）的直接子级就是一个省
    roots.forEach((rootId) => {
      global.MapLoader.childrenOf(rootId).forEach((pid) => {
        const p = global.MapLoader.entry(pid);
        if (!p) return;
        const group = document.createElement('optgroup');
        group.label = p.name;
        const self = makeOption(pid, '全省');
        if (self) group.appendChild(self);
        placed.add(pid);
        global.MapLoader.childrenOf(pid).forEach((c) => {
          const o = makeOption(c.id);
          if (o) { group.appendChild(o); placed.add(c.id); }
        });
        sel.appendChild(group);
      });
    });

    /* ② 兜底：任何没被上面覆盖的（根自身、孤儿、更深的层级）按缩进补上，
     * 保证任何形状的树都能完整显示，不会"某些地图在界面里找不到"。 */
    const walk = (id, depth, guard) => {
      if (guard > 16) return;         // 防止 parent 成环把自己递归死
      if (!placed.has(id)) {
        const o = makeOption(id);
        if (o) { o.textContent = '　'.repeat(depth) + o.textContent; sel.appendChild(o); placed.add(id); }
      }
      global.MapLoader.childrenOf(id).forEach((c) => walk(c.id, depth + 1, guard + 1));
    };
    roots.forEach((id) => walk(id, 0, 0));
    (reg.orphans || []).forEach((o) => {
      const opt = makeOption(o.id, '父级 ' + o.parent + ' 待接入');
      if (opt) sel.appendChild(opt);
    });

    sel.onchange = () => goToMap(sel.value);
  }

  /**
   * 渲染"数据来源 / 审图号"声明。
   *
   * 文案不是写死的，而是读 MAP_GEO_META[当前地图] —— 那份元信息由下载脚本
   * 跟边界数据写在同一个文件里（见 tools/lib/inline-geo.js）。
   * 这样"数据换了源、声明却没改"这类事故从结构上就不可能发生：
   * 声明永远等于数据自己的来历。合规这件事，口径必须和数据同生共死。
   */
  function renderSourceNotice(currentId) {
    const el = document.getElementById('mapSource');
    if (!el) return;
    const meta = (global.MAP_GEO_META && global.MAP_GEO_META[currentId]) || null;

    if (!meta) {
      // 旧数据（早于元信息机制生成的 .geo.js）：如实说明，别猜
      el.textContent = '地图数据来源：未标注（本地数据缺少来源元信息）';
      el.className = 'map-source is-unapproved';
      return;
    }

    if (meta.approval) {
      el.textContent = '地图数据来源：' + (meta.providerLabel || meta.provider) +
        '，审图号：' + meta.approval;
      el.className = 'map-source is-approved';
    } else {
      el.textContent = '地图数据来源：' + (meta.providerLabel || meta.provider) +
        '（' + (meta.note || '未取得审图号') + '）';
      el.className = 'map-source is-unapproved';
    }
  }

  /** 组装整条导航；没有可导航的内容、也没有声明要显示时才收起来 */
  function renderNav(currentId) {
    const bar = document.getElementById('mapbar');
    if (!bar || !global.MAP_REGISTRY || !global.MapLoader) return;

    const hasNotice = !!document.getElementById('mapSource');
    const total = global.MapLoader.list().length;
    const trail = global.MapLoader.trail(currentId);
    const noNav = total < 2 && trail.length < 2 && global.MapLoader.childrenOf(currentId).length === 0;

    // 合规声明必须始终可见，所以"没有导航内容"不再等于"整条收起来"
    if (noNav && !hasNotice) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    renderBreadcrumb(currentId);
    renderSelect(currentId);
    renderSourceNotice(currentId);
  }

  function boot() {
    // 引擎文件没加载出来（路径写错 / 被浏览器拦），给一句人话提示
    if (!global.MapPuzzleEngine) {
      showFatal('引擎没加载出来，请确认 js/engine.js 存在且没有被浏览器拦截。');
      return;
    }
    if (!global.MapLoader) {
      showFatal('地图加载器没加载出来，请确认 js/maps/loader.js 存在且没有被浏览器拦截。');
      return;
    }

    const id = pickMapId();
    CURRENT_ID = id;
    bindReportChip();
    initModes();

    /* 先把"这是哪张图"显示出来 —— 名字在 registry 里就有，不必等 geo 下载完。
     * 【为什么值得单独做】地图包是按需加载的，中国图的 geo 有 1.6MB；
     * 在它下载完之前，标题栏原本一直写着上一个占位文案（以前硬编码是"成都"）。
     * 这里先用 registry 的名字把标题/文档标题填上，等地图就绪后 updateBrand()
     * 再补上"多少块"这类只有拿到 geo 才知道的信息。 */
    {
      const e = global.MapLoader.entry && global.MapLoader.entry(id);
      if (e && e.name) {
        const t = document.getElementById('brandTitle');
        const sub = document.getElementById('brandSub');
        if (t) t.textContent = e.name + '地图拼图';
        if (sub) sub.textContent = '正在加载 ' + e.name + ' 的边界数据…';
        document.title = e.name + '地图拼图';
      }
    }

  /* ==================== 跨地图进度与成就 ====================
   * 账本逻辑全在 js/progress.js（纯函数，可移植、可单测）；
   * 这里只负责"把它接到界面上"：读文档 → 记账 → 发成就 → 刷新显示。
   * ========================================================== */

  /** 全部地图的 { mapId: provinceId } 映射：给 progress.summary 算"每省共几张图" */
  function mapProvinceIndex() {
    const reg = (global.MAP_REGISTRY || {}).maps || {};
    const out = {};
    Object.keys(reg).forEach((id) => {
      let cur = reg[id];
      // 往上找到省级（parent 链最多两级：市 → 省 → 中国）
      for (let i = 0; i < 3 && cur && cur.parent; i++) {
        const up = reg[cur.parent];
        if (!up) break;
        if (String(up.adcode || '').slice(2) === '0000' && up.adcode !== 100000) { out[id] = up.id; return; }
        cur = up;
      }
      out[id] = null;   // 找不到省级（比如中国本身）
    });
    return out;
  }

  /** 当前地图属于哪个省（用 registry 的 parent 链推，最多往上找两级） */
  function provinceOf(id) {
    let cur = global.MapLoader.entry(id);
    for (let i = 0; i < 2 && cur && cur.parent; i++) {
      cur = global.MapLoader.entry(cur.parent);
    }
    return cur ? { id: cur.id, name: cur.name } : { id: null, name: null };
  }

  function loadProgressDoc() {
    return global.MapProgress.load();
  }

  /** 拼完整张地图后的记账与成就提示 */
  function recordMapSolved(config, id, result) {
    const P = global.MapProgress;
    if (!P) return;
    const doc = P.load();
    const prov = provinceOf(id);
    const levelCount = result.levelCount || 1;
    // 单张地图的星：每关最多 3 星，这里用"没提示 + 少失误"粗算一个总星
    const stars = Math.max(0, levelCount * 3 - (result.hints || 0) * 2 - Math.max(0, (result.tries || 0) - levelCount));
    P.record(doc, {
      mapId: id,
      mapName: (config && config.name) || id,
      province: prov.id,
      provinceName: prov.name,
      solved: true,
      levels: levelCount,
      levelsTotal: levelCount,
      elapsed: result.elapsed || 0,
      tries: result.tries || 0,
      hints: result.hints || 0,
      stars: stars,
    });
    const s = P.summary(doc, Object.keys((global.MAP_REGISTRY || {}).maps || {}), mapProvinceIndex());
    const fresh = P.claimBadges(doc, s);

    /* 每日一图打卡：只有"今天这张图"拼完才算打卡。
     * 放在宿主层而不是引擎里 —— 引擎不知道"今天该玩哪张"，那是宿主的事。 */
    const daily = doc.daily && doc.daily.mapId;
    if (daily && daily === id) {
      const streak = P.checkIn(doc);
      if (streak > 0) {
        setTimeout(() => {
          const box = document.getElementById('badgeToast');
          if (!box) return;
          box.innerHTML = '<div class="bt-title">📅 每日一图完成</div>'
            + '<div class="bt-item"><b>连续 ' + streak + ' 天</b>'
            + '<span>明天还有一张新的</span></div>';
          box.hidden = false;
          clearTimeout(showBadgeToast._t);
          showBadgeToast._t = setTimeout(() => { box.hidden = true; }, 5200);
        }, 900);
      }
    }

    P.save(doc);
    renderProgressBar();
    renderDaily();
    renderHometown();
    if (fresh.length) showBadgeToast(fresh);
  }

  /** 顶部那条"已拼 N/总数"的进度显示 */
  function renderProgressBar() {
    const el = document.getElementById('progressChip');
    if (!el) return;
    const P = global.MapProgress;
    if (!P) { el.hidden = true; return; }
    const doc = P.load();
    const allIds = Object.keys((global.MAP_REGISTRY || {}).maps || {});
    const s = P.summary(doc, allIds, mapProvinceIndex());
    el.hidden = false;
    el.innerHTML = '<span class="pc-num">' + s.solvedMaps + '</span>'
      + '<span class="pc-total">/' + s.totalMaps + '</span>'
      + '<span class="pc-label">已拼地图</span>'
      + '<span class="pc-badges" title="已获成就">🏅 ' + (doc.badges || []).length + '</span>';
  }

  /** 新成就的提示：复用引擎那套 toast 样式（自己建一个，避免依赖引擎内部） */
  function showBadgeToast(badges) {
    const box = document.getElementById('badgeToast');
    if (!box) return;
    box.innerHTML = '<div class="bt-title">🏅 获得成就</div>'
      + badges.map((b) => '<div class="bt-item"><b>' + b.name + '</b><span>' + b.desc + '</span></div>').join('');
    box.hidden = false;
    clearTimeout(showBadgeToast._t);
    showBadgeToast._t = setTimeout(() => { box.hidden = true; }, 5200);
  }

  /**
   * 图鉴行：按省列出"已拼 / 共几张"。
   * 【为什么它重要】它同时是两件事：
   *   ① 玩家的收集进度（看得见的积累 → 动机）
   *   ② 众包任务的分配表（哪个省缺口大，一目了然）
   * 只显示"有图可拼的省"，空省不占位置。
   */
  function provinceRows(sum) {
    const provs = Object.keys(sum.provinces || {})
      .map((k) => sum.provinces[k])
      .filter((p) => p.total > 0);
    // 有进度的排前面，其次按缺口从大到小（让"还没动的省"也有存在感）
    provs.sort((a, b) => (b.solved - a.solved) || (b.total - a.total));
    if (!provs.length) return '<li class="bp-empty">还没有可拼的地图</li>';
    return provs.map((p) => {
      const pct = p.total ? Math.round((p.solved / p.total) * 100) : 0;
      const done = p.solved >= p.total;
      return '<li class="' + (done ? 'is-done' : '') + '">'
        + '<span class="bp-prov-name">' + p.name + '</span>'
        + '<span class="bp-prov-bar"><i style="width:' + pct + '%"></i></span>'
        + '<span class="bp-prov-num">' + p.solved + '/' + p.total + '</span>'
        + '</li>';
    }).join('');
  }

  /** 成就面板（点顶部的进度条打开） */
  function renderBadgePanel() {
    const panel = document.getElementById('badgePanel');
    if (!panel) return;
    const P = global.MapProgress;
    if (!P) return;
    const doc = P.load();
    const allIds = Object.keys((global.MAP_REGISTRY || {}).maps || {});
    const s = P.summary(doc, allIds, mapProvinceIndex());
    const list = P.badgeList(doc);

    const rows = list.map((b) => (
      '<li class="' + (b.earned ? 'is-earned' : '') + '">'
      + '<span class="bp-icon">' + (b.earned ? '🏅' : '🔒') + '</span>'
      + '<span class="bp-text"><b>' + b.name + '</b><em>' + b.desc + '</em></span>'
      + '</li>'
    )).join('');

    panel.innerHTML =
      '<div class="bp-head">'
      + '<h2>我的进度</h2>'
      + '<button type="button" class="bp-close" aria-label="关闭">✕</button>'
      + '</div>'
      + '<div class="bp-stats">'
      + '<div class="bp-stat"><b>' + s.solvedMaps + '</b><span>/' + s.totalMaps + ' 张地图</span></div>'
      + '<div class="bp-stat"><b>' + s.percent + '%</b><span>完成度</span></div>'
      + '<div class="bp-stat"><b>' + s.solvedProvinces + '</b><span>个省全通</span></div>'
      + '<div class="bp-stat"><b>' + s.noHintMaps + '</b><span>张未用提示</span></div>'
      + '</div>'
      + '<h3>图鉴 · 按省进度</h3>'
      + '<ul class="bp-provinces">' + provinceRows(s) + '</ul>'
      + '<h3>成就 ' + list.filter((b) => b.earned).length + '/' + list.length + '</h3>'
      + '<ul class="bp-badges">' + rows + '</ul>';

    panel.hidden = false;
    const close = panel.querySelector('.bp-close');
    if (close) close.addEventListener('click', () => { panel.hidden = true; });
  }

  /** 顶部进度条：点击打开成就面板（只绑一次） */
  function bindProgressChip() {
    const chip = document.getElementById('progressChip');
    if (!chip || chip.dataset.bound) return;
    chip.dataset.bound = '1';
    chip.addEventListener('click', renderBadgePanel);

    // 面板外点一下关闭（和开场动画同一套交互习惯）
    const panel = document.getElementById('badgePanel');
    if (panel) {
      panel.addEventListener('click', (ev) => {
        if (ev.target === panel) panel.hidden = true;
      });
    }
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && panel && !panel.hidden) panel.hidden = true;
    });
  }

  /* ==================== 分享成绩 ====================
   * 逻辑全在 js/share.js（纯函数部分有单测）。
   * 这里只负责：拼完一整张地图时弹一个面板，把 canvas 卡片给玩家。
   * 只在"整张图拼完"出现 —— 每关都弹会烦人，而且玩家最想分享的是"我拼完了成都"。
   * ============================================== */

  /** 生成并展示分享卡片 */
  function showShareCard() {
    const S = global.MapShare;
    const P = global.MapProgress;
    if (!S || !P) return;

    const eng = global.__ENGINE__;
    const state = eng && eng.getState ? eng.getState() : {};
    const entry = global.MapLoader.entry(CURRENT_ID);
    const doc = P.load();
    const prov = provinceOf(CURRENT_ID);
    const allIds = Object.keys((global.MAP_REGISTRY || {}).maps || {});
    const sum = P.summary(doc, allIds);

    const data = S.buildCardData(S.collectInput(
      {
        levelName: state.levelName || '',
        levelIndex: state.levelIndex || 0,
        levelTotal: state.levelTotal || 1,
        elapsed: state.elapsed || 0,
        tries: state.tries || 0,
        hints: state.hints || 0,
      },
      sum,
      { name: (entry && entry.name) || CURRENT_ID, provinceName: prov.name },
      doc
    ));

    const panel = document.getElementById('sharePanel');
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML =
      '<div class="sp-head"><h2>分享成绩</h2>'
      + '<button type="button" class="sp-close" aria-label="关闭">✕</button></div>'
      + '<canvas class="sp-canvas" id="shareCanvas"></canvas>'
      + '<div class="sp-actions">'
      + '<button type="button" class="btn btn-primary" id="shareSave">保存图片</button>'
      + '<button type="button" class="btn btn-ghost" id="shareCopy">复制文案</button>'
      + '</div>'
      + '<p class="sp-tip" id="shareTip">长按图片也能保存（手机端）</p>';

    const canvas = panel.querySelector('#shareCanvas');
    const ok = S.drawCard(canvas, data);

    const close = panel.querySelector('.sp-close');
    if (close) close.addEventListener('click', () => { panel.hidden = true; });

    const tip = panel.querySelector('#shareTip');
    const save = panel.querySelector('#shareSave');
    if (save) {
      save.addEventListener('click', () => {
        const url = S.toDataURL(canvas);
        if (!url) { if (tip) tip.textContent = '这个浏览器不支持导出图片，可用"复制文案"'; return; }
        const a = document.createElement('a');
        a.href = url;
        a.download = '地图拼图-' + ((entry && entry.name) || CURRENT_ID) + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (tip) tip.textContent = '已保存到下载目录';
      });
    }
    const copy = panel.querySelector('#shareCopy');
    if (copy) {
      copy.addEventListener('click', () => {
        const text = S.buildShareText(data);
        // 优先用异步剪贴板；失败就退回"选中提示"，不弹 alert 打断
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(
              () => { if (tip) tip.textContent = '文案已复制'; },
              () => { if (tip) tip.textContent = '复制失败，可手动选中：' + text; }
            );
            return;
          }
        } catch (e) { /* 落到下面的兜底 */ }
        if (tip) tip.textContent = text;
      });
    }
    if (!ok && tip) tip.textContent = '卡片绘制失败（浏览器不支持 Canvas 2D）';
  }

  /* ====================== 纠错 / 补资料（众包通道） ======================
   * 项目没有服务器，也永远不会为了"收一条反馈"去搭一个。
   * 这里只把用户手上的信息整理成一段可复制的结构化文本，
   * 再借用用户已经有的通道（GitHub / 邮箱 / 剪贴板）发出去。
   * 详见 js/contribute.js 顶部的设计说明。
   * ==================================================================== */
  function showReportPanel(ctx) {
    const C = global.MapContribute;
    const panel = document.getElementById('reportPanel');
    if (!C || !panel) return;

    /* 补上"这是第几关"，维护者才知道用户当时在看哪一批区县 */
    const eng = global.__ENGINE__;
    const st = eng && eng.getState ? eng.getState() : {};
    const full = Object.assign({}, ctx, {
      levelIndex: typeof st.levelIndex === 'number' ? st.levelIndex : -1,
      levelName: st.levelName || '',
    });

    const issue = C.issueUrl(full);
    const mail = C.mailtoUrl(full);
    const text = C.clipboardText(full);
    const missing = C.missingFields(full);

    panel.hidden = false;
    panel.innerHTML =
      '<div class="sp-head"><h2>纠错 / 补资料</h2>'
      + '<button type="button" class="sp-close" aria-label="关闭">✕</button></div>'
      + '<p class="rp-where">'
      + '<b>' + esc(full.mapName) + '</b> · ' + esc(full.districtName)
      + ' <code>' + esc(String(full.adcode)) + '</code></p>'
      + '<p class="rp-tip">'
      + (missing.length
        ? '这条资料还缺 <b>' + missing.length + '</b> 项。知道其中任意一项都可以单独补，不用全填。'
        : '这一条已经有内容了。如果发现哪里写错了，直接改在下面就好。')
      + '</p>'
      + '<textarea class="rp-text" id="reportText" readonly rows="9"></textarea>'
      + '<div class="sp-actions">'
      + (issue
        ? '<a class="btn btn-primary" id="reportIssue" target="_blank" rel="noopener noreferrer">去 GitHub 提交</a>'
        : '')
      + (mail ? '<a class="btn btn-ghost" id="reportMail">用邮件发</a>' : '')
      + '<button type="button" class="btn btn-ghost" id="reportCopy">复制全部</button>'
      + '</div>'
      + '<p class="sp-tip" id="reportTip">'
      + (issue
        ? '会打开 GitHub 的新建 Issue 页面，内容已填好，看一眼就能提交（需要一个免费账号）。'
        : '这台站点还没配提交地址，复制下面这段发给作者就行。')
      + '</p>';

    const area = panel.querySelector('#reportText');
    if (area) area.value = text;

    const tip = panel.querySelector('#reportTip');
    const close = panel.querySelector('.sp-close');
    if (close) close.addEventListener('click', () => { panel.hidden = true; });

    const issueBtn = panel.querySelector('#reportIssue');
    if (issueBtn) issueBtn.setAttribute('href', issue);

    const mailBtn = panel.querySelector('#reportMail');
    if (mailBtn) mailBtn.setAttribute('href', mail);

    const copy = panel.querySelector('#reportCopy');
    if (copy) {
      copy.addEventListener('click', () => {
        const done = () => { if (tip) tip.textContent = '已复制，粘到任意聊天窗口发给我就行'; };
        const fail = () => {
          if (area) { area.removeAttribute('readonly'); area.select(); }
          if (tip) tip.textContent = '浏览器不让自动复制，已经帮你选中了，按 Ctrl/⌘+C';
        };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, fail);
            return;
          }
        } catch (e) { /* 落到 fail */ }
        fail();
      });
    }
  }

  /** 极简转义：这里拼的都是来自地图包的自有字符串，
   *  仍然转义一次，免得将来有人把外部文本塞进 name 字段 */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  /** 地图级纠错入口：不知道（或懒得点）具体哪个区县时的总入口 */
  function bindReportChip() {
    const chip = document.getElementById('reportChip');
    if (!chip || chip.dataset.bound) return;
    chip.dataset.bound = '1';
    chip.addEventListener('click', () => {
      const entry = global.MapLoader.entry(CURRENT_ID) || {};
      showReportPanel({
        mapId: CURRENT_ID,
        mapName: entry.name || CURRENT_ID,
        adcode: entry.adcode || '',
        districtName: '（整张地图）',
        current: {},
      });
    });
  }

  /** 每日一图的候选：只挑"一关就能玩完"的小地图，保证每天几分钟能完成 */
  function dailyCandidates() {
    const reg = (global.MAP_REGISTRY || {}).maps || {};
    const out = [];
    Object.keys(reg).forEach((id) => {
      const e = reg[id];
      if (!e) return;
      /* 规模用登记册里的 `n`（下级行政区数）判断：
       * 3~12 个 = 一次玩得完又不太无聊；叶子地图（没有更下一级）才适合当"一天一图"。
       * 省级地图（如"四川省"）虽然 n 也在这个区间，但它下面是市，玩起来是另一回事，
       * 所以用 children.length === 0 排除掉。 */
      const n = e.n || 0;
      if (n >= 3 && n <= 12 && (e.children || []).length === 0) out.push(id);
    });
    return out;
  }

  /** 渲染每日一图入口（顶栏地图导航那一行） */
  function renderDaily() {
    const el = document.getElementById('dailyChip');
    if (!el) return;
    const P = global.MapProgress;
    if (!P) { el.hidden = true; return; }
    const doc = P.load();
    const cands = dailyCandidates();
    const today = P.pickDaily(doc, cands);
    P.save(doc);   // 把"今天抽到谁"落盘（锁定，避免中途换题）
    if (!today) { el.hidden = true; return; }

    const entry = global.MapLoader.entry(today);
    const done = P.checkedInToday(doc);
    const streak = (doc.daily && doc.daily.streak) || 0;
    el.hidden = false;
    el.innerHTML = '<span class="dc-label">每日一图</span>'
      + '<span class="dc-name">' + ((entry && entry.name) || today) + '</span>'
      + (done
        ? '<span class="dc-state is-done">✓ 今日已完成' + (streak > 1 ? ' · 连续 ' + streak + ' 天' : '') + '</span>'
        : '<span class="dc-state">' + (streak > 0 ? '连续 ' + streak + ' 天' : '今天还没玩') + '</span>');
    // 点它就去今天这张图（已经在的话不重复跳转）
    el.dataset.target = today;
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('click', () => {
        if (el.dataset.target && el.dataset.target !== CURRENT_ID) {
          global.location.href = urlForMap(el.dataset.target);
        }
      });
    }
  }

  /* ==================== 我的家乡 ====================
   * 纯逻辑在 js/progress.js（setHometown / getHometown / searchPlaces）。
   * 这里只负责：一个直达入口 + 一个带搜索的选择面板。
   * 【为什么值得】地域认同是最廉价的分享理由 —— 人会为"我是宜春人"转发。
   * ============================================== */

  /** 把 registry 组装成搜索用的候选清单（带上级名，便于"按省搜"） */
  function placeCandidates() {
    const reg = (global.MAP_REGISTRY || {}).maps || {};
    const out = [];
    Object.keys(reg).forEach((id) => {
      const e = reg[id];
      if (!e) return;
      const parent = e.parent ? reg[e.parent] : null;
      out.push({ id: id, name: e.name, parentName: parent ? parent.name : '', n: e.n || 0 });
    });
    return out;
  }

  function renderHometown() {
    const el = document.getElementById('hometownChip');
    if (!el) return;
    const P = global.MapProgress;
    if (!P) { el.hidden = true; return; }
    const doc = P.load();
    const home = P.getHometown(doc);
    const entry = home ? global.MapLoader.entry(home) : null;
    el.hidden = false;
    el.innerHTML = '<span class="ht-label">我的家乡</span>'
      + '<span class="ht-name">' + (entry ? entry.name : '点这里选') + '</span>'
      + (entry && home === CURRENT_ID ? '<span class="ht-here">正在拼</span>' : '');
    el.dataset.target = home || '';
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('click', (ev) => {
        const doc2 = P.load();
        const h = P.getHometown(doc2);
        // 已经设过：点一下直接去家乡；再按住 Shift 点可以重新选（不给普通玩家添负担）
        if (h && !ev.shiftKey) {
          if (h !== CURRENT_ID) global.location.href = urlForMap(h);
          return;
        }
        openHometownPicker();
      });
    }
  }

  /** 家乡选择面板：输入关键词 → 列出匹配 → 点选 */
  function openHometownPicker() {
    const P = global.MapProgress;
    const panel = document.getElementById('hometownPanel');
    if (!P || !panel) return;
    const cands = placeCandidates();
    panel.hidden = false;
    panel.innerHTML =
      '<div class="hp-head"><h2>选我的家乡</h2>'
      + '<button type="button" class="hp-close" aria-label="关闭">✕</button></div>'
      + '<p class="hp-tip">输入省 / 市 / 县的名字，例如"江西""宜春""袁州"</p>'
      + '<input class="hp-input" id="hometownInput" type="search" placeholder="搜索地名…" autocomplete="off">'
      + '<ul class="hp-list" id="hometownList"></ul>';

    const input = panel.querySelector('#hometownInput');
    const list = panel.querySelector('#hometownList');

    const paint = () => {
      const hits = P.searchPlaces(cands, input.value);
      if (!input.value.trim()) {
        list.innerHTML = '<li class="hp-empty">试试输入你家乡的名字</li>';
        return;
      }
      if (!hits.length) {
        list.innerHTML = '<li class="hp-empty">没找到，换个写法试试（可以只输入省名）</li>';
        return;
      }
      list.innerHTML = hits.map((h) => (
        '<li><button type="button" data-id="' + h.id + '">'
        + '<b>' + h.name + '</b><em>' + (h.parentName || '') + '</em></button></li>'
      )).join('');
    };
    paint();

    input.addEventListener('input', paint);
    list.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-id]');
      if (!btn) return;
      const doc = P.load();
      P.setHometown(doc, btn.getAttribute('data-id'));
      P.save(doc);
      panel.hidden = true;
      renderHometown();
      // 选定后直接送他去拼家乡（这才符合"我想拼我的家乡"的意图）
      const target = btn.getAttribute('data-id');
      if (target !== CURRENT_ID) global.location.href = urlForMap(target);
    });

    const close = panel.querySelector('.hp-close');
    if (close) close.addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', (ev) => { if (ev.target === panel) panel.hidden = true; });
    try { input.focus(); } catch (e) { /* 移动端可能不给焦点，忽略 */ }
  }

  /* 计时走一个轻量定时器，只更新信息条里那一格，
   * 不整条重渲染（否则每秒重建 DOM，按钮会掉焦点）。 */
  function startModeTicker() {
    if (global.__MODE_TICKER__) clearInterval(global.__MODE_TICKER__);
    global.__MODE_TICKER__ = setInterval(() => {
      const bar = document.getElementById('modeBar');
      const eng = global.__ENGINE__;
      if (!bar || bar.hidden || !eng || !eng.getState) return;
      const st = eng.getState();
      if (st.solved) return;
      const t = bar.querySelector('#mbTimer');
      if (t) t.textContent = global.MapModes.fmtMs(st.elapsed || 0);
    }, 1000);
  }

  global.MapLoader.load(id)
      .then((config) => {
        /* 通关整张地图时记账 + 发成就。
         * 引擎只报"拼完了"，跨地图的账本归 js/progress.js ——
         * 这样引擎保持可移植，进度逻辑也能被别的宿主复用。 */
        config.onMapSolved = (result) => {
          recordMapSolved(config, id, result);
          /* 模式相关的结算：刷新最佳成绩 / 结算双人比分 */
          onModeMapSolved(result);
          /* 整张地图拼完 → 在结算画面上补一个"分享成绩"入口。
           * 【为什么在这里加按钮，而不是改引擎】按钮属于宿主层 UI；
           * 引擎只要在合适的时机回调一次，宿主接住就行（引擎保持可移植）。 */
          const actions = document.getElementById('modalActions');
          if (actions && !actions.querySelector('[data-share]')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-primary';
            btn.setAttribute('data-share', '1');
            btn.textContent = '分享成绩';
            btn.addEventListener('click', showShareCard);
            actions.insertBefore(btn, actions.firstChild);
          }
        };

        /* 交给引擎之前先验一遍：不合法就给人话提示，别让它静默卡死 */
        const v = validateConfig(config, id);
        if (!v.ok) {
          console.error('[地图拼图] 地图包校验失败 · ' + id, {
            reason: v.reason,
            config: config ? Object.keys(config) : null,
            featureCount: config && config.geo && config.geo.features
              ? config.geo.features.length : 0,
            levelCount: config && config.levels ? config.levels.length : 0,
          });
          showFatal(v.reason + '<br><br>这是个数据文件的问题，不是浏览器的问题。');
          return;
        }

        // 注意 start() 不返回任何东西，实例要先接住再启动
        /* 纠错通道：引擎只管把"用户点了哪条资料"抛出来，
         * 具体怎么提交（Issue / 邮件 / 剪贴板）是宿主层的自由。
         * 这样引擎不依赖 js/contribute.js，将来挪到别的站点也能用。 */
        /* 模式 → 引擎配置。引擎只认这几个通用开关（见 js/modes.js 的 engineOverrides），
         * 所以这里注入的是"开关"而不是"模式名"。 */
        Object.assign(config, global.MapModes.engineOverrides(CURRENT_MODE, CURRENT_DIFF));
        config.onPlacement = onPlacement;
        /* 教学模式的选区裁剪必须在**这里**：initModes() 跑在 boot() 开头，
         * 那时候地图包还没加载（MAP_PACKAGES[CURRENT_ID] 是 undefined），
         * 所以位置只能放在 load().then() 里、create() 之前。
         * 顺带留一份完整关卡列表，供"选要练的行政区"面板使用 ——
         * 否则面板看到的是裁过的列表，用户就再也加不回来了。 */
        applyTeachPick(config);

        config.onReportIssue = (target) => {
          showReportPanel({
            mapId: id,
            mapName: (config.name) || id,
            adcode: target.adcode,
            districtName: target.name,
            current: target.meta || {},
          });
        };
        const engine = global.MapPuzzleEngine.create(config);
        engine.start();
        // 暴露实例给测试和调试用（getState() 是引擎的公开接口，不是内部状态）
        global.__ENGINE__ = engine;

        // 导航 UI 属于宿主层：引擎起来之后再渲染，它就是"最后一件事"
        updateBrand(config, id);
        renderNav(id);
        renderProgressBar();
        renderDaily();
        renderHometown();
        bindProgressChip();
        renderModeBar();
        startModeTicker();

        markReady(id);
      })
      .catch((err) => {
        /* 脚本 404 / 语法错误都会落到这里。
         * 控制台留结构化信息，页面上留人话 —— 排查的人两边都能用。 */
        console.error('[地图拼图] 地图加载失败 · ' + id, {
          message: err && err.message,
          stack: err && err.stack,
          hint: '检查 js/maps/registry.js 里这张图的 dir，以及三个包文件是否都在',
        });
        showFatal(
          '地图「' + id + '」没加载出来：' + (err && err.message ? err.message : '未知错误') +
          '<br><br>最可能的两个原因：<br>' +
          '① js/maps/registry.js 里这张图登记的路径不对（或文件被删了）<br>' +
          '② 打开控制台看具体是哪个脚本 404 —— 通常是缺少 ' + id +
          '.geo.js / .data.js / .js 三者之一。'
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
