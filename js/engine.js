/* =====================================================================
 * 地图拼图引擎 · 通用逻辑（不含任何城市数据）
 * ---------------------------------------------------------------------
 * 用法：
 *   const engine = MapPuzzleEngine.create(window.MAP_PACKAGES.chengdu);
 *   engine.start();      // 数据与 DOM 就绪后启动（引擎不自动启动，何时启动由宿主页决定）
 *   engine.getState();   // 取一份运行状态快照（测试断言 / 宿主页面读取）
 *
 * 一张地图 = 一份配置（见 js/maps/ 下的包文件 <id>.js）。引擎只认配置里的字段：
 *   geo / levels 必需，districts / palette / storage / themes / texts 可省略。
 *
 * 核心难点是"拖拽落点判定"，这里的做法是：
 *   1. 拖动时用 fixed 幽灵层跟随指针，全程只改 transform（走 GPU，不掉帧）
 *   2. 松手时把指针的屏幕坐标用 getScreenCTM().inverse() 换算回地图坐标系
 *   3. 先看这个点是否落在某个凹槽多边形内部（isPointInFill，精确）
 *      再退回"离最近的凹槽中心够近吗"（容错，照顾手抖）
 *   4. 判定正确就把幽灵从当前尺寸 transform 过渡到目标尺寸，
 *      因为幽灵和地图用的是同一份 path 数据、同一个 bbox，
 *      所以缩放后能严丝合缝地重合，看起来就是"碎片嵌进去了"
 * ===================================================================== */

(function (global) {
  'use strict';

  /**
   * 创建一个拼图引擎实例。
   *
   * @param {object} config 地图配置，结构见 js/maps/china/sichuan/chengdu.js
   * @returns {{start: Function, getState: Function}} 对外接口
   *
   * 所有内部状态（state / drag / el / shapes …）都是本函数的闭包变量，
   * 所以每个实例天然互不干扰 —— 同一页里放两张地图也不会串状态。
   */
  function createMapPuzzleEngine(config) {
    /* ============================ 地图配置 ============================
     * 引擎不认识任何一个具体城市：地图数据、区县资料、关卡设定、配色、
     * 存储 key、文案，全部由调用方通过 config 传入（见 js/maps/ 下的包文件）。
     * 配置少写一项就用下面的默认值兜底 —— 不崩，只是回退到通用表现。
     * ============================================================== */
    const CONFIG = config || {};

    /** 取数字：非法值（undefined / NaN / 字符串）一律回退到默认 */
    const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

    /** 用默认值补齐一份配置对象（只补第一层，够用且好懂） */
    function withDefaults(given, defaults) {
      const out = {};
      Object.keys(defaults).forEach((k) => {
        out[k] = given && given[k] !== undefined ? given[k] : defaults[k];
      });
      return out;
    }

    /* 画布 */
    const MAP_WIDTH = num(CONFIG.map && CONFIG.map.width, 1000);
    const MAP_PADDING = num(CONFIG.map && CONFIG.map.padding, 14);

    /* 碎片尺寸 */
    const PIECE_MAX = num(CONFIG.piece && CONFIG.piece.max, 62);           // 托盘里的最大边
    const PIECE_MIN_SIDE = num(CONFIG.piece && CONFIG.piece.minSide, 15);  // 短边下限
    /* 尺寸档位：[视口宽度上限, 最大边]；都不中就用 PIECE_MAX */
    const PIECE_TIERS = (CONFIG.piece && CONFIG.piece.pieces) ||
      [[420, 40], [620, 48], [900, 56]];

    /* 引擎自己的常量：与城市无关，留在代码里 */
    const DRAG_THRESHOLD = 5;      // 移动超过这个距离才算"拖拽"，否则算"点击"
    const SNAP_MS = 300;           // 吸附动画时长，要和 CSS 里的 transition 对上

    /* 配色：主色调由城市决定 —— 这就是"不同城市不同主色调"的入口 */
    const PALETTE = withDefaults(CONFIG.palette, {
      hueByLevel: {},    // 关卡 id → HSL 色相
      fallbackHue: 160,  // 关卡没配色相时的兜底
      saturation: 62,
      lightBase: 48,
      lightStep: 7,
      lightSpan: 16,
      hueSpread: 44,
    });

    /* 本地存储：每个城市一套 key，否则多城市会互相覆盖存档 */
    const STORAGE = withDefaults(CONFIG.storage, {
      save: 'map-puzzle-save',
      theme: 'map-puzzle-theme',
      sound: 'map-puzzle-sound',
      intro: 'map-puzzle-intro-seen',
      saveVersion: 2,
    });

    /* 配色主题（对应 CSS 里的 data-theme） */
    const THEMES = (CONFIG.themes && CONFIG.themes.list) || ['jade'];
    const DEFAULT_THEME = (CONFIG.themes && CONFIG.themes.fallback) || THEMES[0];

    /* ============================ 数据 ============================ */
    const GEO = CONFIG.geo;
    const DISTRICT_INFO = CONFIG.districts || {};
    const LEVELS = CONFIG.levels || [];

    /* 文案：只放"会因城市而变"的部分 */
    const TEXTS = withDefaults(CONFIG.texts, {
      cityName: '',
      districtCount: GEO && GEO.features ? GEO.features.length : 0,
      missingDataHint: '地图数据没加载出来，请确认数据文件存在且没有被浏览器拦截。',
    });

    /* ============================ 运行状态 ============================ */
    const state = {
      levelIndex: 0,
      placed: new Set(),        // 本关已拼好的 adcode
      slots: new Map(),         // adcode -> 凹槽 <g> 元素
      pieces: new Map(),        // adcode -> 碎片 <button> 元素
      selected: null,           // 点击选中的碎片（点击模式用）
      tries: 0,
      hints: 0,
      startedAt: 0,
      elapsed: 0,
      timer: null,
      solved: false,
      unlocked: 1,              // 已解锁到第几关
      finishedLevels: new Set(),
      resume: null,             // 从 localStorage 读到的待恢复快照
    };

    /** 运行状态快照：给测试断言和宿主页面读，改它不会影响引擎内部状态 */
    function snapshotState() {
      const level = currentLevel();
      return {
        levelIndex: state.levelIndex,
        levelId: level ? level.id : null,
        placed: [...state.placed],
        slotsLeft: state.slots.size,
        piecesLeft: state.pieces.size,
        selected: state.selected,
        tries: state.tries,
        hints: state.hints,
        elapsed: state.elapsed,
        solved: state.solved,
        unlocked: state.unlocked,
        finishedLevels: [...state.finishedLevels],
        introOpen: introIsOpen(),
      };
    }

    /* 一次拖拽的上下文 */
    let drag = null;

    /* ============================ DOM 缓存 ============================ */
    const el = {};

    /* ============================ 工具函数 ============================ */
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    /** 系统是否开了"减少动态效果"。动画和过渡都该尊重这个偏好 */
    function prefersReducedMotion() {
      return !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /** Fisher-Yates 洗牌，返回新数组 */
    function shuffle(list) {
      const a = list.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function formatTime(ms) {
      const total = Math.floor(ms / 1000);
      const m = String(Math.floor(total / 60)).padStart(2, '0');
      const s = String(total % 60).padStart(2, '0');
      return `${m}:${s}`;
    }

    function currentLevel() {
      return LEVELS[state.levelIndex];
    }

    /** 这个区县属于哪一关（用来显示"中心城区 / 近郊 / 远郊"标签） */
    function categoryOf(adcode) {
      const lv = LEVELS.find((l) => l.adcodes.includes(adcode));
      return lv ? lv.short : '';
    }

    /** 同关内的配色：色相小幅摆动 + 明度阶梯，整体协调又能区分相邻区县 */
    function colorOf(adcode) {
      const level = currentLevel();
      const idx = level.adcodes.indexOf(adcode);
      // 主色相的来源优先级：关卡自带 hue → 城市配色的 hueByLevel → 兜底色相
      const base = num(level.hue, num(PALETTE.hueByLevel[level.id], PALETTE.fallbackHue));
      const hue = base + ((idx * 11) % PALETTE.hueSpread) - PALETTE.hueSpread / 2;
      const light = PALETTE.lightBase + ((idx * PALETTE.lightStep) % PALETTE.lightSpan);
      return `hsl(${hue} ${PALETTE.saturation}% ${light}%)`;
    }

    /**
     * 碎片的最大边要跟着屏幕走。
     * 手机上如果还用 62px，一关 7~8 块就会横向撑破托盘（实测第 5 块被裁掉）。
     */
    function pieceMax() {
      const w = window.innerWidth || 1280;
      for (let i = 0; i < PIECE_TIERS.length; i++) {
        if (w <= PIECE_TIERS[i][0]) return PIECE_TIERS[i][1];
      }
      return PIECE_MAX;
    }

    /** 碎片在托盘里的像素尺寸：等比缩放到最大边 */
    function pieceSize(shape) {
      const max = pieceMax();
      const { w, h } = shape.bbox;
      const long = Math.max(w, h);
      const short = Math.min(w, h);

      let k = max / long;
      if (short * k < PIECE_MIN_SIDE) {
        // 短边太细会看不清，但一味放大又会让长边撑破托盘，
        // 所以同时卡一个长边上限（max 的 1.15 倍），两边取更小的那个 k。
        k = Math.min(PIECE_MIN_SIDE / short, (max * 1.15) / long);
      }
      return { w: w * k, h: h * k };
    }

    /** 视口变化后，把托盘里已有碎片的尺寸重算一遍（旋转屏幕、拉窗口都用得上） */
    function refreshPieceSizes() {
      state.pieces.forEach((btn, adcode) => {
        const shape = shapes.get(adcode);
        const svg = btn.querySelector('svg');
        if (!shape || !svg) return;
        const size = pieceSize(shape);
        svg.setAttribute('width', size.w.toFixed(1));
        svg.setAttribute('height', size.h.toFixed(1));
      });
    }

    /** 视口坐标 → 地图 viewBox 坐标 */
    function screenToMap(clientX, clientY) {
      const ctm = el.map.getScreenCTM();
      if (!ctm) return null;
      return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    }

    /** 地图 viewBox 里的 bbox → 视口像素矩形（用来对齐幽灵和真实区块） */
    function bboxToScreen(bbox) {
      const m = el.map.getScreenCTM();
      if (!m) return null;
      const p1 = new DOMPoint(bbox.x, bbox.y).matrixTransform(m);
      const p2 = new DOMPoint(bbox.x + bbox.w, bbox.y + bbox.h).matrixTransform(m);
      return { x: p1.x, y: p1.y, w: p2.x - p1.x, h: p2.y - p1.y };
    }

    /* ============================ 初始化 ============================ */
    function init() {
      if (!GEO || !LEVELS.length || !window.GeoMap) {
        document.body.innerHTML =
          '<p style="padding:40px;color:#e7f2ec;font-family:sans-serif">' +
          TEXTS.missingDataHint + '</p>';
        return;
      }

      cacheDom();
      buildMap();
      loadProgress();
      initTheme();
      initSound();
      initIntro();

      // ?level=N 直达时覆盖存档（调试 / 分享用）。
      // ⚠️ 必须先判断参数存不存在：URLSearchParams.get() 在没这个参数时返回 null，
      // 而 Number(null) === 0，会被误当成 "?level=0"，把三关全部解锁、
      // 让"逐关解锁"彻底失效（锁图标永远不出现）。
      const rawLevel = new URLSearchParams(location.search).get('level');
      const direct = rawLevel === null || rawLevel === '' ? NaN : Number(rawLevel);
      const hasDirect = Number.isInteger(direct) && direct >= 0 && direct < LEVELS.length;

      // 有存档就接着上次那一关继续
      const resume = hasDirect ? null : state.resume;

      if (hasDirect) {
        state.levelIndex = direct;
        state.unlocked = LEVELS.length;
      } else if (resume && Number.isInteger(resume.levelIndex)) {
        state.levelIndex = clamp(resume.levelIndex, 0, LEVELS.length - 1);
      } else {
        state.levelIndex = clamp(state.unlocked - 1, 0, LEVELS.length - 1);
      }

      bindGlobalEvents();
      startLevel(state.levelIndex, resume);
    }

    /** 节流版保存：尝试/提示这类高频操作不必每次都写 localStorage */
    function saveProgressThrottled() {
      if (Date.now() - lastSavedAt < 1200) return;
      saveProgress();
    }

    /* ============================ 进度持久化 ============================
     * 存 localStorage：刷新、关标签页、甚至关掉浏览器再打开都能接着玩。
     * 存的是一份"完整快照"——不只是解锁进度，还包括当前关卡已经拼好了哪几块、
     * 已经花了多少时间、试了几次、用了几次提示。
     *
     * 带 SAVE_VERSION：将来存档结构变了，旧数据会被直接丢弃而不是读出乱码。
     * 所有读写都包 try/catch —— 隐私模式或某些 file:// 环境下 storage 会直接抛错。
     * ================================================================== */

    const SAVE_KEY = STORAGE.save;
    const SAVE_VERSION = STORAGE.saveVersion;
    let lastSavedAt = 0;

    function readSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const saved = JSON.parse(raw);
        if (!saved || saved.v !== SAVE_VERSION) return null;
        return saved;
      } catch (e) {
        return null;
      }
    }

    function loadProgress() {
      state.unlocked = 1;
      state.finishedLevels = new Set();
      const saved = readSave();
      if (!saved) return;

      state.unlocked = clamp(Number(saved.unlocked) || 1, 1, LEVELS.length);
      state.finishedLevels = new Set(
        (saved.finished || []).filter((id) => LEVELS.some((l) => l.id === id))
      );
      state.resume = saved; // 具体的关卡内进度等 startLevel 时再消费
    }

    function saveProgress() {
      // 开场动画还没看完时不写档，免得把"没开始玩"的状态也存进去
      if (introIsOpen()) return;
      lastSavedAt = Date.now();
      try {
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({
            v: SAVE_VERSION,
            unlocked: state.unlocked,
            finished: [...state.finishedLevels],
            // 已通关的关卡不再存"这一关拼到哪了"，而是把指针挪到下一关，
            // 否则下次打开会停在一张已经拼满、没什么可玩的空地图上
            levelIndex: state.solved
              ? Math.min(state.levelIndex + 1, LEVELS.length - 1)
              : state.levelIndex,
            placed: state.solved ? [] : [...state.placed],
            elapsed: state.solved ? 0 : state.elapsed,
            tries: state.solved ? 0 : state.tries,
            hints: state.solved ? 0 : state.hints,
          })
        );
      } catch (e) {
        /* 写不进去就算了，不影响游戏 */
      }
    }

    function clearSave() {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch (e) {
        /* 忽略 */
      }
      state.resume = null;
    }

    function cacheDom() {
      el.map = document.getElementById('map');
      el.layerBase = document.getElementById('layerBase');
      el.layerSlots = document.getElementById('layerSlots');
      el.layerPlaced = document.getElementById('layerPlaced');
      el.tray = document.getElementById('tray');
      el.trayCount = document.getElementById('trayCount');
      el.trayHint = document.getElementById('trayHint');
      el.levelTabs = document.getElementById('levelTabs');
      el.themeSwitch = document.getElementById('themeSwitch');
      el.board = document.getElementById('board');
      el.boardToast = document.getElementById('boardToast');
      el.boardIntro = document.getElementById('boardIntro');
      el.infoCard = document.getElementById('infoCard');
      el.statDone = document.getElementById('statDone');
      el.statTotal = document.getElementById('statTotal');
      el.statTime = document.getElementById('statTime');
      el.statTries = document.getElementById('statTries');
      el.statHints = document.getElementById('statHints');
      el.progressFill = document.getElementById('progressFill');
      el.btnHint = document.getElementById('btnHint');
      el.btnRestart = document.getElementById('btnRestart');
      el.modal = document.getElementById('modal');
      el.modalIcon = document.getElementById('modalIcon');
      el.modalTitle = document.getElementById('modalTitle');
      el.modalText = document.getElementById('modalText');
      el.modalStats = document.getElementById('modalStats');
      el.modalActions = document.getElementById('modalActions');
      el.modalKicker = document.getElementById('modalKicker');
      el.modalStars = document.getElementById('modalStars');
      el.modalChips = document.getElementById('modalChips');
      el.intro = document.getElementById('intro');
      el.introStart = document.getElementById('introStart');
      el.soundBtn = document.getElementById('soundBtn');
    }

    /* ============================ 配色主题 ============================
     * 三套主题共用同一份样式规则，切换只是给 <html> 换一个 data-theme，
     * 让 CSS 里对应的变量组生效（见 style.css 顶部）。
     * ================================================================== */

    const THEME_KEY = STORAGE.theme;

    function applyTheme(name, animate) {
      const theme = THEMES.indexOf(name) >= 0 ? name : DEFAULT_THEME;

      // 切换瞬间才挂 .theme-anim，让颜色平滑过渡；平时不挂，避免拖拽掉帧
      if (animate && !prefersReducedMotion()) {
        document.documentElement.classList.add('theme-anim');
        clearTimeout(applyTheme._timer);
        applyTheme._timer = setTimeout(() => {
          document.documentElement.classList.remove('theme-anim');
        }, 460);
      }

      document.documentElement.setAttribute('data-theme', theme);
      if (el.themeSwitch) {
        el.themeSwitch.querySelectorAll('.theme-dot').forEach((dot) => {
          dot.setAttribute('aria-pressed', String(dot.dataset.theme === theme));
        });
      }
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {
        /* 隐私模式 / file:// 下可能写不了，忽略 */
      }
    }

    function initTheme() {
      let saved = null;
      try {
        saved = localStorage.getItem(THEME_KEY);
      } catch (e) {
        /* 忽略 */
      }
      // 注意：<head> 里的内联脚本已经提前设过一次 data-theme（防闪烁），
      // 这里再设一次是为了同步色点的选中态
      applyTheme(
        saved || document.documentElement.getAttribute('data-theme') || DEFAULT_THEME,
        false
      );

      if (el.themeSwitch) {
        el.themeSwitch.addEventListener('click', (ev) => {
          const dot = ev.target.closest('.theme-dot');
          if (dot) applyTheme(dot.dataset.theme, true);
        });
      }
    }

    /* ============================ 音效 ============================
     * 全部用 Web Audio API 现场合成，不加载任何音频文件（项目保持零外链）。
     *
     * 一个必须绕开的限制：浏览器不允许页面在用户交互前出声。
     * 所以 AudioContext 做成懒加载 —— 等到第一次 pointerdown 才创建。
     * ============================================================== */

    const SOUND_KEY = STORAGE.sound;
    let audioCtx = null;
    let soundOn = true;

    function audioReady() {
      if (!soundOn) return null;
      try {
        if (!audioCtx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          audioCtx = new AC();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
      } catch (e) {
        return null; // 拿不到音频就静默降级，绝不让它影响玩法
      }
    }

    /**
     * 播一串音符。
     * @param {Array<[number, number, number]>} notes [频率Hz, 起始延迟s, 时长s]
     * @param {string} type 波形
     * @param {number} volume 峰值音量
     */
    function playNotes(notes, type, volume) {
      const ctx = audioReady();
      if (!ctx) return;
      const t0 = ctx.currentTime;

      notes.forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0 + delay);

        // 包络：极快起音 + 指数衰减，听起来是"叮"而不是"嘟"
        gain.gain.setValueAtTime(0.0001, t0 + delay);
        gain.gain.exponentialRampToValueAtTime(volume || 0.1, t0 + delay + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + dur + 0.03);
      });
    }

    /* 音色设计：
       拼对 = 两个上行纯音（G5→D6），清亮
       放错 = 低音下行三角波（G3→D3），闷而不刺耳 */
    const SFX = {
      ok: () => playNotes([[784, 0, 0.14], [1174.7, 0.075, 0.2]], 'sine', 0.11),
      bad: () => playNotes([[196, 0, 0.16], [146.8, 0.09, 0.22]], 'triangle', 0.1),
      pick: () => playNotes([[587.3, 0, 0.07]], 'sine', 0.055),
      levelUp: () => playNotes(
        [[587.3, 0, 0.16], [784, 0.11, 0.16], [987.8, 0.22, 0.16], [1174.7, 0.33, 0.34]],
        'sine',
        0.095
      ),
    };

    function initSound() {
      try {
        soundOn = localStorage.getItem(SOUND_KEY) !== '0';
      } catch (e) {
        /* 忽略 */
      }

      if (el.soundBtn) {
        el.soundBtn.setAttribute('aria-pressed', String(soundOn));
        el.soundBtn.addEventListener('click', () => {
          soundOn = !soundOn;
          el.soundBtn.setAttribute('aria-pressed', String(soundOn));
          try {
            localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
          } catch (e) {
            /* 忽略 */
          }
          if (soundOn) SFX.pick(); // 打开时给个即时反馈
        });
      }

      // 借用户第一次按下指针的机会解锁 AudioContext
      document.addEventListener('pointerdown', () => {
        audioReady();
      }, { once: true });
    }

    /* ============================ 构建地图 ============================ */
    let shapes = new Map(); // adcode -> 几何数据（d / bbox / center）
    let viewRaf = null;     // viewBox 过渡动画的句柄
    let hasRenderedOnce = false;

    function buildMap() {
      const built = window.GeoMap.buildGeoMap(GEO, {
        width: MAP_WIDTH,
        padding: MAP_PADDING,
      });

      el.map.setAttribute('viewBox', built.viewBox);
      currentVB = { x: 0, y: 0, w: built.width, h: built.height };

      built.districts.forEach((d) => shapes.set(d.adcode, d));

      // 底图：把全部区县画一遍浅色轮廓，给玩家一个"整张地图"的参照系
      const frag = document.createDocumentFragment();
      built.districts.forEach((d) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d.d);
        frag.appendChild(path);
      });
      el.layerBase.appendChild(frag);
    }

    /* ------------------------- 视图聚焦 -------------------------
     * 有的关卡只占全图极小一块（比如把市中心几个小区单独设成一关），
     * 如果整张地图一直铺在画布上，那一关的凹槽会挤成看不清的一小团。
     * 所以每一关都把视图推到该关区县的范围，切换关卡时用 viewBox 插值做出
     * 平滑推近/拉远的效果。
     * ------------------------------------------------------------ */

    /**
     * 算出贴着画布宽高比的 viewBox。
     * 之所以要主动把宽高比对齐，是因为 preserveAspectRatio="meet" 会留黑边，
     * 比例一致时地图才能正好填满画布。
     */
    function computeLevelViewBox(adcodes) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;

      adcodes.forEach((a) => {
        const b = shapes.get(a).bbox;
        if (b.x < x0) x0 = b.x;
        if (b.y < y0) y0 = b.y;
        if (b.x + b.w > x1) x1 = b.x + b.w;
        if (b.y + b.h > y1) y1 = b.y + b.h;
      });

      let w = x1 - x0;
      let h = y1 - y0;
      // 四周留一圈，让玩家看到相邻区县的轮廓作为定位参照。
      // 系数别太大，否则地图被推得太远、画布四周全是空的。
      const pad = Math.max(w, h) * 0.16 + 12;
      w += pad * 2;
      h += pad * 2;

      const rect = el.board.getBoundingClientRect();
      const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1.2;
      if (w / h < aspect) w = h * aspect;
      else h = w / aspect;

      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    }

    let currentVB = { x: 0, y: 0, w: MAP_WIDTH, h: MAP_WIDTH };

    function applyViewBox(vb) {
      currentVB = vb;
      el.map.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    }

    function animateViewBox(target, duration) {
      if (viewRaf) {
        cancelAnimationFrame(viewRaf);
        viewRaf = null;
      }

      if (prefersReducedMotion() || duration <= 0) {
        applyViewBox(target);
        return;
      }

      const from = { ...currentVB };
      const t0 = performance.now();

      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
        applyViewBox({
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          w: from.w + (target.w - from.w) * e,
          h: from.h + (target.h - from.h) * e,
        });
        viewRaf = t < 1 ? requestAnimationFrame(step) : null;
      };
      viewRaf = requestAnimationFrame(step);
    }

    /* ============================ 关卡 ============================ */
    function renderTabs() {
      el.levelTabs.innerHTML = '';
      LEVELS.forEach((level, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'level-tab';
        if (i === state.levelIndex) {
          btn.classList.add('is-active');
          btn.setAttribute('aria-current', 'true');
        }
        if (state.finishedLevels.has(level.id)) btn.classList.add('is-done');

        const done = state.finishedLevels.has(level.id);
        const locked = i >= state.unlocked && !done;
        btn.disabled = locked;
        // 徽标三态：已通关打勾 / 未解锁上锁 / 其余显示本关碎片数
        const badge = done
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-check"/></svg>'
          : locked
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-lock"/></svg>'
            : String(level.adcodes.length);
        btn.innerHTML = `${level.short}<span class="level-tab-badge">${badge}</span>`;
        btn.title = level.name;
        btn.addEventListener('click', () => startLevel(i));
        el.levelTabs.appendChild(btn);
      });
    }

    /**
     * 开始一关。
     * @param {number} index 关卡序号
     * @param {object} [resume] 从存档恢复时传入的快照（已拼碎片 / 用时 / 计数）
     */
    function startLevel(index, resume) {
      state.levelIndex = clamp(index, 0, LEVELS.length - 1);
      state.placed = new Set();
      state.slots = new Map();
      state.pieces = new Map();
      state.selected = null;
      state.tries = 0;
      state.hints = 0;
      state.solved = false;
      state.elapsed = 0;
      state.startedAt = Date.now();

      el.layerSlots.innerHTML = '';
      el.layerPlaced.innerHTML = '';
      el.tray.innerHTML = '';
      el.board.classList.remove('is-solved');
      el.modal.hidden = true;

      const level = currentLevel();

      level.adcodes.forEach((adcode) => createSlot(adcode));
      shuffle(level.adcodes).forEach((adcode) => createPiece(adcode));

      // 视图聚焦到本关范围（首次进入直接定位，之后切关卡才做推近动画）
      const vb = computeLevelViewBox(level.adcodes);
      animateViewBox(vb, hasRenderedOnce ? 640 : 0);
      hasRenderedOnce = true;

      renderTabs();
      renderLevelInfo(level);
      // 开场动画还盖在上面时先别播关卡引导，等它退场后再播（见 initIntro）
      if (!introIsOpen()) playIntro(level);
      updateStats();
      startTimer();

      if (resume) restoreProgress(resume);
    }

    /**
     * 把存档里的进度铺回界面上。
     * 和正常拼图走的是同一套 DOM 结构，只是不播吸附动画、不弹提示、不覆盖信息卡，
     * 否则刷新一下会被"拼对了 ×5"的提示刷屏。
     */
    function restoreProgress(save) {
      const level = currentLevel();
      const valid = (save.placed || []).filter(
        (a) => level.adcodes.indexOf(a) >= 0 && shapes.has(a)
      );

      // 已经拼满的关卡不再恢复（那说明存档是通关瞬间写的）
      if (!valid.length || valid.length >= level.adcodes.length) return;

      valid.forEach((adcode) => revealDistrict(adcode, false, true));

      state.tries = Math.max(0, Number(save.tries) || 0);
      state.hints = Math.max(0, Number(save.hints) || 0);

      // 用时接着上次走：把起点往前推，计时器就能无缝续上
      const elapsed = Math.max(0, Number(save.elapsed) || 0);
      state.elapsed = elapsed;
      state.startedAt = Date.now() - elapsed;
      el.statTime.textContent = formatTime(elapsed);

      updateStats();
      renderLevelInfo(level);
      return true;
    }

    /** 在地图上创建一个"凹槽"（待拼位置的虚线轮廓） */
    function createSlot(adcode) {
      const shape = shapes.get(adcode);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'slot');
      g.dataset.adcode = adcode;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', shape.d);

      // 键盘可达：Tab 能停在空位上，选中碎片后按回车放下去。
      // 提示文案刻意不写"某某区该放这里"，否则等于直接把答案念出来。
      path.setAttribute('tabindex', '-1');
      path.setAttribute('role', 'button');
      path.setAttribute('aria-label', '地图上的空位，选中碎片后按回车放下');
      path.addEventListener('keydown', (ev) => {
        if ((ev.key === 'Enter' || ev.key === ' ') && state.selected !== null) {
          ev.preventDefault();
          tryPlace(state.selected, { adcode, exact: true }, null,
            state.pieces.get(state.selected), null);
        }
      });

      g.appendChild(path);

      el.layerSlots.appendChild(g);
      state.slots.set(adcode, { g, path });
    }

    /**
     * 空位是否可以被 Tab 聚焦，取决于"手上有没有拿着碎片"。
     * 一直可聚焦的话，Tab 要依次经过 5~9 个空位，很烦；
     * 一直不可聚焦的话，键盘用户又没法把碎片放下去。
     */
    function updateSlotFocusability() {
      const tabbable = state.selected !== null ? '0' : '-1';
      state.slots.forEach((slot) => {
        slot.path.setAttribute('tabindex', tabbable);
      });
    }

    /** 在托盘里创建一个碎片 */
    function createPiece(adcode) {
      const shape = shapes.get(adcode);
      const size = pieceSize(shape);
      const color = colorOf(adcode);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'piece';
      btn.dataset.adcode = adcode;
      btn.style.setProperty('--c', color);
      btn.setAttribute('aria-label', `拖动这块碎片，放到地图上正确的位置`);
      // 碎片 svg 的 viewBox 直接复用该区县在地图上的包围盒，
      // 于是"碎片"和"地图上的那块"用的是同一份 path 数据，形状保证一致
      btn.innerHTML =
        `<svg width="${size.w.toFixed(1)}" height="${size.h.toFixed(1)}" ` +
        `viewBox="${shape.bbox.x} ${shape.bbox.y} ${shape.bbox.w} ${shape.bbox.h}" ` +
        `preserveAspectRatio="none" aria-hidden="true">` +
        `<path d="${shape.d}"></path></svg>`;

      el.tray.appendChild(btn);
      state.pieces.set(adcode, btn);

      btn.addEventListener('pointerdown', (ev) => onPieceDown(ev, adcode));
      // 键盘可达性：不用 click 事件处理，因为它会和 pointerup 那条路撞车
      // （两者都会切换选中，等于切了两次又回到原点）。直接听 keydown 最干净。
      btn.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          toggleSelect(adcode);
        }
      });
    }

    /* ============================ 拖拽 ============================ */
    function onPieceDown(ev, adcode) {
      if (ev.button !== undefined && ev.button !== 0) return; // 只响应左键 / 触摸
      if (state.placed.has(adcode)) return;

      const pieceEl = state.pieces.get(adcode);
      const rect = pieceEl.getBoundingClientRect();

      // 指针相对碎片中心的偏移：拖动时保持它，碎片就不会"跳"到指针中心
      drag = {
        adcode,
        pieceEl,
        startX: ev.clientX,
        startY: ev.clientY,
        offX: ev.clientX - (rect.left + rect.width / 2),
        offY: ev.clientY - (rect.top + rect.height / 2),
        w: rect.width,
        h: rect.height,
        ghost: null,
        moved: false,
        hitAdcode: null,
        lastX: ev.clientX,
        lastY: ev.clientY,
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(ev) {
      if (!drag) return;
      drag.lastX = ev.clientX;
      drag.lastY = ev.clientY;

      // 还没越过阈值：不算拖拽，先不动（这样"点击选中"和"拖拽"能共存）
      if (!drag.moved) {
        const dist = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY);
        if (dist < DRAG_THRESHOLD) return;
        drag.moved = true;
        spawnGhost();
      }

      // 高频事件用 rAF 节流，避免一帧内算好几次
      if (drag.rafPending) return;
      drag.rafPending = true;
      requestAnimationFrame(() => {
        if (!drag) return;
        drag.rafPending = false;
        applyGhostTransform();
        updateCandidate();
      });
    }

    function spawnGhost() {
      const shape = shapes.get(drag.adcode);
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.style.width = `${drag.w}px`;
      ghost.style.height = `${drag.h}px`;
      ghost.style.setProperty('--c', colorOf(drag.adcode));
      ghost.innerHTML =
        `<svg viewBox="${shape.bbox.x} ${shape.bbox.y} ${shape.bbox.w} ${shape.bbox.h}" ` +
        `preserveAspectRatio="none" aria-hidden="true">` +
        `<path d="${shape.d}"></path></svg>`;

      document.body.appendChild(ghost);
      drag.ghost = ghost;

      drag.pieceEl.classList.add('is-taken');
      applyGhostTransform();
    }

    /** 幽灵中心 = 指针位置 - 抓取偏移 */
    function applyGhostTransform() {
      if (!drag || !drag.ghost) return;
      const cx = drag.lastX - drag.offX;
      const cy = drag.lastY - drag.offY;
      drag.ghost.style.transform =
        `translate3d(${(cx - drag.w / 2).toFixed(1)}px, ${(cy - drag.h / 2).toFixed(1)}px, 0)`;
    }

    /** 拖动过程中点亮"可能的目标"凹槽 */
    function updateCandidate() {
      if (!drag || !drag.ghost) return;
      const cx = drag.lastX - drag.offX;
      const cy = drag.lastY - drag.offY;
      const hit = resolveDrop(cx, cy);
      const next = hit ? hit.adcode : null;
      if (next === drag.hitAdcode) return;

      if (drag.hitAdcode !== null) {
        const prev = state.slots.get(drag.hitAdcode);
        if (prev) prev.g.classList.remove('is-candidate');
      }
      drag.hitAdcode = next;
      if (next !== null) {
        const cur = state.slots.get(next);
        if (cur) cur.g.classList.add('is-candidate');
      }
    }

    function onPointerUp() {
      if (!drag) return;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);

      const ctx = drag;
      drag = null;

      // 没越过阈值 → 视为"点击"，切换选中状态（点击模式的入口）
      if (!ctx.moved) {
        ctx.pieceEl.classList.remove('is-taken');
        toggleSelect(ctx.adcode);
        return;
      }

      if (ctx.hitAdcode !== null) {
        const cur = state.slots.get(ctx.hitAdcode);
        if (cur) cur.g.classList.remove('is-candidate');
      }

      const cx = ctx.lastX - ctx.offX;
      const cy = ctx.lastY - ctx.offY;
      tryPlace(ctx.adcode, resolveDrop(cx, cy), ctx.ghost, ctx.pieceEl, { cx, cy });
    }

    /**
     * 判断这个屏幕坐标落在哪个凹槽上。
     * 先精确判断"点是否在多边形内"，再退回"离得最近且够近"。
     */
    function resolveDrop(clientX, clientY) {
      const p = screenToMap(clientX, clientY);
      if (!p) return null;

      // 1) 精确命中：点落在某个凹槽形状里
      for (const [adcode, slot] of state.slots) {
        if (typeof slot.path.isPointInFill === 'function' && slot.path.isPointInFill(p)) {
          return { adcode, exact: true };
        }
      }

      // 2) 容错命中：离某个凹槽的中心足够近（形状太小、手抖时用得上）
      let best = null;
      let bestDist = Infinity;
      for (const adcode of state.slots.keys()) {
        const shape = shapes.get(adcode);
        const dist = Math.hypot(shape.center[0] - p.x, shape.center[1] - p.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = adcode;
        }
      }
      if (best !== null) {
        const shape = shapes.get(best);
        const limit = clamp(Math.min(shape.bbox.w, shape.bbox.h) * 0.85, 34, 110);
        if (bestDist <= limit) return { adcode: best, exact: false };
      }
      return null;
    }

    /* ============================ 放置 ============================ */
    function tryPlace(draggedAdcode, hit, ghost, pieceEl, pos) {
      state.tries++;
      saveProgressThrottled();

      // 没落到任何凹槽上 → 直接飞回托盘
      if (!hit) {
        if (ghost) returnGhost(ghost, pieceEl);
        clearSelection();
        updateStats();
        return;
      }

      // 落到别人的位置上 → 提示放错
      if (hit.adcode !== draggedAdcode) {
        const slot = state.slots.get(hit.adcode);
        if (slot) {
          slot.g.classList.add('is-wrong');
          setTimeout(() => slot.g.classList.remove('is-wrong'), 620);
        }
        const rightName = shapes.get(draggedAdcode).name;
        const wrongName = shapes.get(hit.adcode).name;
        showToast(`这里是${wrongName}，${rightName}还在别处`, 'bad');
        SFX.bad();
        updateStats();
        if (ghost) {
          ghost.classList.add('is-shaking');
          // 抖两下再飞回去
          setTimeout(() => {
            ghost.classList.remove('is-shaking');
            returnGhost(ghost, pieceEl);
          }, 420);
        } else {
          clearSelection();
        }
        return;
      }

      // 放对了！
      commitPlace(draggedAdcode, ghost, pieceEl, pos);
    }

    function commitPlace(adcode, ghost, pieceEl, pos) {
      const shape = shapes.get(adcode);
      const target = bboxToScreen(shape.bbox);

      if (ghost && target) {
        // 幽灵从"托盘尺寸"平滑过渡到"地图上的真实尺寸"。
        // 因为两者用的是同一个 bbox、同一个 path，缩放后能精确重合。
        const sx = target.w / ghost.offsetWidth;
        const sy = target.h / ghost.offsetHeight;
        ghost.classList.add('is-snapping');
        ghost.style.transform =
          `translate3d(${target.x.toFixed(1)}px, ${target.y.toFixed(1)}px, 0) ` +
          `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;

        setTimeout(() => {
          ghost.remove();
          revealDistrict(adcode, true);
        }, SNAP_MS);
      } else {
        // 点击模式：没有幽灵，直接出现
        if (ghost) ghost.remove();
        revealDistrict(adcode, true);
      }
    }

    /** 把幽灵送回托盘原位 */
    function returnGhost(ghost, pieceEl) {
      if (!ghost) {
        clearSelection();
        return;
      }
      const rect = pieceEl.getBoundingClientRect();
      ghost.classList.add('is-returning');
      ghost.style.transform = `translate3d(${rect.left.toFixed(1)}px, ${rect.top.toFixed(1)}px, 0)`;
      setTimeout(() => {
        ghost.remove();
        pieceEl.classList.remove('is-taken');
      }, 270);
    }

    /** 地图上亮出这个区县的彩色区块 */
    /**
     * 把某个区县在地图上"亮出来"。
     * @param {string|number} adcode
     * @param {boolean} isNew  信息卡上是否要显示"拼对啦"
     * @param {boolean} [silent] 恢复存档时用：不播入场动画、不弹提示、不动信息卡
     */
    function revealDistrict(adcode, isNew, silent) {
      const shape = shapes.get(adcode);
      const color = colorOf(adcode);

      if (!state.placed.has(adcode)) {
        state.placed.add(adcode);

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'placed');
        g.dataset.adcode = adcode;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', shape.d);
        path.style.setProperty('--c', color);
        if (!silent) path.classList.add('pop');
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', `${shape.name}，点击查看介绍`);

        // 点/回车看介绍
        path.addEventListener('click', () => showDistrict(adcode));
        path.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            showDistrict(adcode);
          }
        });

        g.appendChild(path);
        el.layerPlaced.appendChild(g);

        // 移除凹槽和碎片
        const slot = state.slots.get(adcode);
        if (slot) {
          slot.g.remove();
          state.slots.delete(adcode);
        }
        const pieceEl = state.pieces.get(adcode);
        if (pieceEl) {
          pieceEl.classList.add('is-used');
          state.pieces.delete(adcode);
        }

        state.selected = null;
      }

      if (silent) return;

      updateStats();
      showDistrict(adcode, isNew);
      showToast(`拼对了 · ${shape.name}`, 'ok');
      SFX.ok();
      saveProgress();

      if (state.slots.size === 0) finishLevel();
    }

    /* ============================ 点击选中模式 ============================ */
    function toggleSelect(adcode) {
      if (state.selected === adcode) {
        clearSelection();
        return;
      }
      clearSelection();
      state.selected = adcode;
      const pieceEl = state.pieces.get(adcode);
      if (pieceEl) pieceEl.classList.add('is-selected');
      el.trayHint.textContent = '已选中碎片，点地图上的虚线位置放下';
      updateSlotFocusability();
      SFX.pick();
    }

    function clearSelection() {
      if (state.selected !== null) {
        const prev = state.pieces.get(state.selected);
        if (prev) prev.classList.remove('is-selected');
      }
      state.selected = null;
      el.trayHint.textContent = '拖动碎片到地图上的虚线位置';
      updateSlotFocusability();
    }

    /** 点击地图：如果有选中的碎片，就尝试放在这个位置 */
    function onMapClick(ev) {
      if (state.selected === null) return;
      const adcode = state.selected;
      const hit = resolveDrop(ev.clientX, ev.clientY);
      if (!hit) return;
      tryPlace(adcode, hit, null, state.pieces.get(adcode), null);
    }

    /* ============================ 提示 ============================ */
    function doHint() {
      const remaining = currentLevel().adcodes.filter((a) => !state.placed.has(a));
      if (!remaining.length) return;

      const adcode = remaining[Math.floor(Math.random() * remaining.length)];
      state.hints++;
      updateStats();
      saveProgressThrottled();

      const slot = state.slots.get(adcode);
      if (slot) {
        slot.g.classList.add('is-hinted');
        setTimeout(() => slot.g.classList.remove('is-hinted'), 2300);
      }
      const pieceEl = state.pieces.get(adcode);
      if (pieceEl) {
        pieceEl.classList.add('is-hinted');
        pieceEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setTimeout(() => pieceEl.classList.remove('is-hinted'), 2300);
      }
      showToast(`提示：找一找 ${shapes.get(adcode).name}`, 'ok');
    }

    /* ============================ 信息卡 ============================ */
    function renderLevelInfo(level) {
      el.infoCard.innerHTML = `
        <div class="info-body is-fresh">
          <div class="info-kicker">本关说明</div>
          <h2 class="info-name" style="font-size:19px">${level.name}</h2>
          <p class="level-blurb">${level.blurb}</p>
          <div class="legend">
            <div class="legend-row"><span class="legend-dot" style="background:var(--jade)"></span>
              <span>拖动<b>碎片</b>到地图上的虚线位置</span></div>
            <div class="legend-row"><span class="legend-dot" style="background:var(--azure)"></span>
              <span>也可以<b>先点碎片、再点位置</b>放置</span></div>
            <div class="legend-row"><span class="legend-dot" style="background:var(--amber)"></span>
              <span>拼对后点地图色块，随时回看介绍</span></div>
          </div>
        </div>`;
    }

    /** 面积显示：整数就不拖一个 .0 的尾巴 */
    function formatArea(v) {
      if (typeof v !== 'number' || !isFinite(v)) return '—';
      return (Number.isInteger(v) ? v : v.toFixed(1)) + ' km²';
    }

    function showDistrict(adcode, isNew) {
      const shape = shapes.get(adcode);
      const meta = DISTRICT_INFO[adcode] || {};
      const color = colorOf(adcode);
      const cat = categoryOf(adcode);

      el.infoCard.innerHTML = `
        <div class="info-body is-fresh" style="--c:${color}">
          <div class="info-kicker">${isNew ? '拼对啦' : '区县介绍'}</div>
          <div>
            <span class="info-cat">${cat}</span>
            <h2 class="info-name">${shape.name}</h2>
          </div>
          <p class="info-tagline">${meta.tagline || ''}</p>
          <dl class="info-facts">
            <div><dt>面积</dt><dd>${formatArea(meta.area)}</dd></div>
            <div><dt>地标</dt><dd>${meta.landmark || '—'}</dd></div>
          </dl>
          <div class="info-fun">
            <span class="fun-badge">冷知识</span>
            <p>${meta.funFact || ''}</p>
          </div>
        </div>`;
    }

    /* ============================ 通关 ============================ */
    function finishLevel() {
      state.solved = true;
      stopTimer();
      SFX.levelUp();
      state.finishedLevels.add(currentLevel().id);
      state.unlocked = Math.min(
        LEVELS.length,
        Math.max(state.unlocked, state.levelIndex + 2)
      );
      saveProgress();

      el.board.classList.add('is-solved');
      renderTabs();

      const isLast = state.levelIndex === LEVELS.length - 1;

      // 全部拼完就拉远到全图，让玩家看一眼自己拼出来的完整地图
      if (isLast) {
        animateViewBox(computeLevelViewBox([...shapes.keys()]), 1100);
      }

      setTimeout(() => {
        // 图标固定是手绘盖碗茶（"拼完了，喝口茶"），不再按状态切 emoji
        el.modalKicker.textContent = isLast ? '全部完成' : '本关通关';
        el.modalTitle.textContent = isLast ? '全部拼完了！' : `${currentLevel().short} 通关`;
        // 城市名留空时不留出一个多余的"的"字
        const cityLabel = TEXTS.cityName ? `${TEXTS.cityName}的 ` : '';
        el.modalText.textContent = isLast
          ? `你已经把${cityLabel}${TEXTS.districtCount} 个区县全部放回了正确的位置。现在点地图上的任意区块，可以慢慢看每个地方的介绍。`
          : `${currentLevel().name} 已全部归位。下一关会更大一些，准备好了吗？`;

        renderStars(starsForLevel());
        renderChips();

        // 统计数字从 0 滚上去，比直接蹦出来生动
        el.modalStats.innerHTML = `
          <div class="stat"><span class="stat-k">用时</span><span class="stat-v" id="mvTime">00:00</span></div>
          <div class="stat"><span class="stat-k">尝试</span><span class="stat-v" id="mvTries">0</span></div>
          <div class="stat"><span class="stat-k">提示</span><span class="stat-v" id="mvHints">0</span></div>`;
        countUp(el.modalStats.querySelector('#mvTime'), state.elapsed, 700, formatTime);
        countUp(el.modalStats.querySelector('#mvTries'), state.tries, 700, String);
        countUp(el.modalStats.querySelector('#mvHints'), state.hints, 700, String);

        el.modalActions.innerHTML = '';
        if (!isLast) {
          el.modalActions.appendChild(
            makeButton('进入下一关', 'btn-primary', () => startLevel(state.levelIndex + 1))
          );
          el.modalActions.appendChild(
            makeButton('重玩本关', 'btn-ghost', () => startLevel(state.levelIndex))
          );
        } else {
          el.modalActions.appendChild(
            makeButton('从第一关重来', 'btn-primary', () => startLevel(0))
          );
          el.modalActions.appendChild(
            makeButton('留在全图', 'btn-ghost', () => {
              el.modal.hidden = true;
            })
          );
        }
        el.modal.hidden = false;
      }, 620);
    }

    /** 星级：无提示、尝试次数也不多才给三星，鼓励认真看图而不是乱试 */
    function starsForLevel() {
      const n = currentLevel().adcodes.length;
      let s = 3;
      if (state.hints >= 1) s -= 1;
      if (state.hints >= 3) s -= 1;
      if (state.tries > n * 1.6) s -= 1;
      return clamp(s, 1, 3);
    }

    function renderStars(count) {
      let html = '';
      for (let i = 0; i < 3; i++) {
        const empty = i < count ? '' : ' is-empty';
        html += `<svg class="modal-star${empty}" viewBox="0 0 24 24" ` +
          `style="animation-delay:${(0.16 + i * 0.13).toFixed(2)}s"><use href="#i-star"/></svg>`;
      }
      el.modalStars.innerHTML = html;
    }

    /** 本关所有区县做成彩色印记，依次浮现（颜色沿用地图上的那套） */
    function renderChips() {
      el.modalChips.innerHTML = currentLevel().adcodes.map((adcode, i) => {
        const shape = shapes.get(adcode);
        return `<span class="modal-chip" style="--chip:${colorOf(adcode)};` +
          `animation-delay:${(0.32 + i * 0.055).toFixed(2)}s">${shape.name}</span>`;
      }).join('');
    }

    /** 数字从 0 滚到目标值 */
    function countUp(node, to, duration, format) {
      if (!node) return;
      if (prefersReducedMotion()) {
        node.textContent = format(to);
        return;
      }
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
        if (t < 1) {
          node.textContent = format(Math.round(to * e));
          requestAnimationFrame(step);
        } else {
          node.textContent = format(to);
        }
      };
      requestAnimationFrame(step);
    }

    /* ============================ 开场欢迎动画 ============================
     * 同一次会话只看一次（sessionStorage），并且支持
     * 点任意位置 / 按任意键 / 4 秒后自动进入 —— 不会把用户卡在首屏。
     * ================================================================== */

    const INTRO_KEY = STORAGE.intro;
    let introTimer = null;

    function initIntro() {
      let seen = false;
      try {
        seen = sessionStorage.getItem(INTRO_KEY) === '1';
      } catch (e) {
        /* 隐私模式下读不到，当作没看过 */
      }

      // 用 ?level= 直达时（调试 / 分享）直接跳过开场
      const direct = new URLSearchParams(location.search).has('level');

      if (seen || direct || !el.intro) {
        if (el.intro) el.intro.hidden = true;
        return;
      }

      el.intro.hidden = false;
      document.body.classList.add('intro-open');

      const close = () => {
        if (el.intro.hidden || el.intro.classList.contains('is-leaving')) return;
        clearTimeout(introTimer);
        el.intro.classList.add('is-leaving');
        try {
          sessionStorage.setItem(INTRO_KEY, '1');
        } catch (e) {
          /* 忽略 */
        }

        setTimeout(() => {
          el.intro.hidden = true;
          document.body.classList.remove('intro-open');
          // 等开场退场完再播关卡引导，否则两个动画会叠在一起
          playIntro(currentLevel());
        }, 470);
      };

      el.intro.addEventListener('click', close);
      el.introStart.addEventListener('click', (ev) => {
        ev.stopPropagation();
        close();
      });
      document.addEventListener('keydown', close, { once: true });
      introTimer = setTimeout(close, 4000); // 兜底，什么都不做也能进游戏
    }

    function introIsOpen() {
      return !!el.intro && !el.intro.hidden;
    }

    function makeButton(text, cls, onClick) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn ${cls}`;
      b.textContent = text;
      b.addEventListener('click', onClick);
      return b;
    }

    /* ============================ UI 杂项 ============================ */
    let toastTimer = null;

    function showToast(text, kind) {
      el.boardToast.textContent = text;
      el.boardToast.className = `board-toast is-on ${kind === 'bad' ? 'is-bad' : 'is-ok'}`;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.boardToast.classList.remove('is-on');
      }, 1500);
    }

    function playIntro(level) {
      const total = level.adcodes.length;
      el.boardIntro.innerHTML = `
        <div class="intro-kicker">${level.short}</div>
        <div class="intro-title">${total} 块碎片</div>
        <div class="intro-sub">把每一块拖到地图上正确的位置</div>`;
      el.boardIntro.classList.remove('is-on');
      void el.boardIntro.offsetWidth; // 强制重排，让动画能重播
      el.boardIntro.classList.add('is-on');
    }

    function updateStats() {
      const level = currentLevel();
      const total = level.adcodes.length;
      const done = state.placed.size;

      el.statDone.textContent = done;
      el.statTotal.textContent = total;
      el.statTries.textContent = state.tries;
      el.statHints.textContent = state.hints;
      el.progressFill.style.width = `${(done / total) * 100}%`;
      el.trayCount.textContent = state.slots.size ? `还剩 ${state.slots.size} 块` : '全部拼完';

      if (state.slots.size === 0) {
        el.tray.innerHTML =
          '<div class="tray-empty">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-check"/></svg>' +
          '本关已全部归位</div>';
      }
    }

    function startTimer() {
      stopTimer();
      state.startedAt = Date.now();
      state.elapsed = 0;
      el.statTime.textContent = '00:00';
      state.timer = setInterval(() => {
        if (state.solved) return;
        state.elapsed = Date.now() - state.startedAt;
        el.statTime.textContent = formatTime(state.elapsed);
      }, 500);
    }

    function stopTimer() {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
    }

    /* ============================ 全局事件 ============================ */
    function bindGlobalEvents() {
      el.btnHint.addEventListener('click', doHint);
      el.btnRestart.addEventListener('click', () => startLevel(state.levelIndex));
      el.map.addEventListener('click', onMapClick);

      // 点击空白底图取消选中
      el.board.addEventListener('click', (ev) => {
        const t = ev.target;
        if (t === el.map || (t.closest && t.closest('.layer-base'))) clearSelection();
      });

      el.modal.addEventListener('click', (ev) => {
        if (ev.target === el.modal) el.modal.hidden = true;
      });

      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          el.modal.hidden = true;
          clearSelection();
        }
      });

      // 切走标签页 / 关掉页面时把进度落盘（用时也在这一刻定格）
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) saveProgress();
      });
      window.addEventListener('beforeunload', saveProgress);

      // 画布尺寸变了要重算 viewBox，否则聚焦比例会失配出现黑边
      let resizeTimer = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          const adcodes = state.solved && state.levelIndex === LEVELS.length - 1
            ? [...shapes.keys()]
            : currentLevel().adcodes;
          animateViewBox(computeLevelViewBox(adcodes), 220);
          refreshPieceSizes();
        }, 160);
      });
    }

    /* ============================ 对外接口 ============================
     * 只暴露这两个入口，内部状态一律不直接给出，免得宿主页面改坏引擎。
     * 注意：引擎并不自动启动 —— 由宿主页面（js/game.js）决定何时 init()。
     * ============================================================== */
    return {
      start: init,
      getState: snapshotState,
    };
  }

  global.MapPuzzleEngine = { create: createMapPuzzleEngine };
})(window);
