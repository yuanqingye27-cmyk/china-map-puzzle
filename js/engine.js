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

    /* ---------- 拖拽手感：极小碎片的可见性 ----------
     * 【要解决的问题】托盘碎片有"短边下限"归一化（见 pieceSize），而地图上的空位
     * 是**真实比例**。实测（1600×1000 画布）：
     *   中国图第 5 关 · 澳门空位 0.8×1.6px / 香港 7.9×6.1px
     *   四川  第 1 关 · 最小空位 34×42px
     *   成都  第 1 关 · 最小空位 107×138px（舒服）
     * 可见这不是"中国图独有"，而是"一关块数多 + 区域本身小"的通病。
     *
     * 【为什么用"镜头推近"而不是把答案显示在别处】第一版做的是屏幕角落的放大镜，
     * 但它是**外挂**：玩家视线要在"手指/碎片"和"角落圆盘"之间来回跳，而且圆盘里
     * 看到的东西跟地图不在同一个位置，认知负担高。它只是在补偿"看不见"，
     * 而不是让目标看得见。推近镜头则直接把目标本身变大 —— 不需要第二块视野。
     *
     * 这些是**通用体验参数**，不含任何具体地图数据，也不含模式分支。 */
    const DRAGF = withDefaults(CONFIG.drag, {
      /* 触屏：判定点相对视觉触点再上移这么多（负值 = 往上）。
       * 手指接触面有大小，玩家瞄准的是手指**上方**的落点。 */
      touchLift: 8,

      /* 镜头推近：空位最小边的屏幕像素小于这个值就推近 */
      zoomBelowPx: 56,
      /* 推近后让空位最小边达到这么大。
       *
       * 【这个数决定"推多猛"】曾经是 104（= 舒适点击目标 44px 的 2 倍多），
       * 实机反馈是"幅度太大、太猛、像卡顿"。降到 76：仍然远大于 44px 的
       * 可点击下限，但镜头不用贴那么近，缩放倍数和视觉位移都明显变小，
       * 观感从"怼到脸上"回到"看清目标"。
       * 澳门这种极端小目标因此要 ~77 倍（此前 ~128 倍）。 */
      zoomFitPx: 76,
      /* 倍率上限。这不是"手感偏好"而是防呆：真正的边界由 zoomedViewBox
       * 把镜头夹在底图范围内保证（空位必定在底图里，夹住就不会露白）。
       *
       * 【为什么必须定得高】实测澳门的地图坐标 bbox 是 0.9×1.8 单位，
       * 在第 5 关视野下只有 0.81×1.63px —— 要让它达到 zoomFitPx 需要几十倍。
       * 我第一版凭直觉设成 8，结果推近后澳门只有 6.5px，等于没推。
       * 教训：这个数字要用真实数据算出来，不能拍脑袋。 */
      zoomMax: 200,
      /* 推近（收）与退回全景（放）的时长。
       *
       * 【为什么要 460ms 而不是 320ms】320ms 在实机上"像卡顿"——
       * 它太短了，一帧的变化量太大，肉眼看到的是"跳"而不是"移动"。
       * 450~500ms 配更缓的曲线（见 animateViewBox 的 easing）才是丝滑的区间：
       * 苹果官网那类过渡也大多落在这个量级。
       * 退回全景更慢（700ms）是因为它的位移更大，需要更多时间让人跟上方位。 */
      zoomInMs: 460,
      zoomOutMs: 700,
      /* 放下一块之后，隔多久把镜头缓缓退回全景。
       * 【为什么需要它】刚放下时不该立刻拉走（玩家还在看"我放对了"），
       * 但**不能一直停在近景** —— 实机反馈：接着拖下一块时地图还是放大的，
       * 大碎片显示不全、也找不到自己的位置，等于玩不下去。
       * 900ms 是"看清结果"与"别让人等"之间的折中：再长显得迟钝
       * （玩家已经想去拖下一块了），再短则看不完信息卡的反馈。 */
      resetAfterPlaceMs: 900,
    });

    /* 判断"这次拖拽是不是触屏/触控笔"。用 pointerType 而不是 UA sniffing：
     * UA 会被魔改系统骗，而事件里的 pointerType 是浏览器自己填的事实。 */
    const isTouchPointer = (ev) =>
      !!ev && (ev.pointerType === 'touch' || ev.pointerType === 'pen');

    /* 本关的"全景"viewBox：退回全景、以及推近时限制不越界都要用它 */
    let levelViewBox = null;

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

    /* ============ 玩法模式的通用开关（全部可选，缺省＝原有行为） ============
     * 引擎**不认识"模式"这个概念** —— 它只认下面这几个通用配置。
     * 六套模式（普通/计时/教学/考试/儿童/双人）由 js/modes.js 翻译成这几个值，
     * 所以以后加第七套模式**不需要改引擎**。
     * ==================================================================== */
    /** 'never'（默认，原行为）| 'always'：碎片上是否常显地名（教学模式要用） */
    const PIECE_NAMES = (CONFIG.pieceNames === 'always') ? 'always' : 'never';
    /** 提示次数上限：null=不限（原行为）｜数字｜Infinity（等于不限） */
    const HINT_LIMIT = (CONFIG.hintLimit === undefined || CONFIG.hintLimit === null)
      ? null : CONFIG.hintLimit;
    /** 放错时的反馈是否放软（儿童模式）：不出现"连击中断"这类挫败向说法 */
    const SOFT_FEEDBACK = CONFIG.softenFeedback === true;
    /** 是否跳过引擎自己的动画（考试模式）：与系统的"减少动态效果"是同一个开关 */
    const DISABLE_MOTION = CONFIG.disableMotion === true;
    /** 每次放置后回调一次，供宿主页做回合/错题集/正确率统计（引擎不关心用途） */
    const ON_PLACEMENT = typeof CONFIG.onPlacement === 'function' ? CONFIG.onPlacement : null;

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
      /* 连击与得分：放错清零、放对递增。
       * 得分不参与解锁，纯粹是'玩得好不好'的即时反馈 ——
       * 连击存在的意义是给'别急着乱放'一个理由。 */
      combo: 0,
      score: 0,
      bestCombo: 0,
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
        combo: state.combo,
        score: state.score,
        bestCombo: state.bestCombo,
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
      /* 两个来源：① 系统的"减少动态效果"偏好 ② 模式配置（考试模式要求关动画）。
       * 合并成一个判断，后面所有动画门都用它，就不必到处写两遍。 */
      if (DISABLE_MOTION) return true;
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

      /* 【关卡结构指纹】关卡分组变了（例如从"每 8 个一组"改成"按行政类型分组"），
       * 旧存档必须**作废**，不能硬套 —— 实测踩过：
       * 甘孜旧档是 3 关、unlocked=2；新分组只有 1 关（18 个县全在第 1 关），
       * 于是第 1 关被判成"未解锁"，玩家点进去**拼图直接不能玩**。
       * 指纹变了就从第一关重来（只保留"看过开场动画"这类无关进度的标记）。 */
      const fingerprint = LEVELS.map((l) => l.id + ':' + l.adcodes.length).join('|');
      if (saved.levelFingerprint && saved.levelFingerprint !== fingerprint) {
        return;   // 关卡结构已变 → 旧进度不适用
      }

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
            /* 关卡结构指纹：改关卡分组后旧存档要能自动作废（见 loadProgress） */
            levelFingerprint: LEVELS.map((l) => l.id + ':' + l.adcodes.length).join('|'),
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
      el.statScore = document.getElementById('statScore');
      el.comboChip = document.getElementById('comboChip');
      el.statCombo = document.getElementById('statCombo');
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
    let viewSettle = null;  // 该动画的 resolve（镜头停稳时兑现，见 animateViewBox）
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

    /** 视图过渡的缓动曲线：easeInOutCubic。
     *
     *  【为什么不用 easeOutCubic】原来用的是 `1-(1-t)³` —— 起步就冲满速度、
     *  然后一路减速。实机反馈"推得猛、像卡顿"，问题就出在这里：
     *  开头那一帧的位移量太大，肉眼看到的是"跳"而不是"移动"。
     *  easeInOutCubic 起止速度都是 0，中段均匀加速再均匀减速，
     *  首尾两帧几乎不动 —— 那才是"丝滑"给人的直接来源。
     *  苹果官网那类页面过渡用的也是同一类曲线（两端缓入缓出）。 */
    const easeView = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    /** 平滑推近/拉远视图。
     *
     *  【为什么返回 Promise】镜头在动的时候，同一个屏幕点对应的地图位置一直在变。
     *  自动放大之后这一点变得很要命：澳门的空位只有 0.8px，几十倍的镜头会把
     *  几个像素的差放大成地图里上百个单位的偏差，于是"看对了却放到了隔壁省"。
     *  所以调用方需要"镜头已经停稳"的信号，而不是猜一个 sleep 时长。
     *
     *  【为什么 transform 而不是给 SVG 加 CSS transition】viewBox 不是可动画的
     *  CSS 属性，只能用 rAF 逐帧插值。这是 SVG 缩放的固有做法。 */
    function animateViewBox(target, duration) {
      if (viewRaf) {
        cancelAnimationFrame(viewRaf);
        viewRaf = null;
      }
      if (viewSettle) {
        const done = viewSettle;
        viewSettle = null;
        done();
      }

      if (prefersReducedMotion() || duration <= 0) {
        applyViewBox(target);
        return Promise.resolve();
      }

      const from = { ...currentVB };
      const t0 = performance.now();

      return new Promise((resolve) => {
        viewSettle = resolve;
        const step = (now) => {
          const t = Math.min(1, (now - t0) / duration);
          const e = easeView(t);
          applyViewBox({
            x: from.x + (target.x - from.x) * e,
            y: from.y + (target.y - from.y) * e,
            w: from.w + (target.w - from.w) * e,
            h: from.h + (target.h - from.h) * e,
          });
          if (t < 1) {
            viewRaf = requestAnimationFrame(step);
          } else {
            viewRaf = null;
            viewSettle = null;
            resolve();
          }
        };
        viewRaf = requestAnimationFrame(step);
      });
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
      /* 换关时把待执行的"退回全景"取消掉：那是上一关排的队，
       * 落到新关卡上会把刚定位好的视图又拉走。 */
      cancelScheduledZoomOut();
      state.levelIndex = clamp(index, 0, LEVELS.length - 1);
      state.placed = new Set();
      state.slots = new Map();
      state.pieces = new Map();
      state.selected = null;
      state.tries = 0;
      state.hints = 0;
      state.combo = 0;      // 连击每关重置（跨关累积会让"断了"没有痛感）
      state.score = 0;
      state.bestCombo = 0;
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
      levelViewBox = vb;   // 记住"本关全景"，自动放大要退回这里
      /* 【根级地图（如中国图）首屏先亮全貌，再聚焦到第 1 关】
       * 中国图的第 1 关是"东北"（只有 3 个省），而首次进入原本是
       * duration=0 直接定位 —— 于是打开中国图看到的是东北一角，
       * 全图视野只覆盖 79%×50%，"这是全国拼图"这件事反而看不出来。
       *
       * 这里让国家图开头先给一眼完整版图（地图本身就承载"这是哪"的信息），
       * 再平滑推到第 1 关。只有一关的图（很多市级图）不绕这一趟：
       * 先亮全貌再拉回同一处，等于白动一次镜头。 */
      const isCountryMap = !CONFIG.parent && LEVELS.length > 1;
      if (!hasRenderedOnce && isCountryMap) {
        animateViewBox(computeLevelViewBox([...shapes.keys()]), 0);
        setTimeout(() => animateViewBox(vb, 900), 260);
      } else {
        animateViewBox(vb, hasRenderedOnce ? 640 : 0);
      }
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
      btn.className = 'piece' + (PIECE_NAMES === 'always' ? ' is-named' : '');
      btn.dataset.adcode = adcode;
      btn.style.setProperty('--c', color);
      /* 无障碍标签：
       *   · 教学模式（碎片常显地名）→ 直接报出名字，屏幕阅读器才"看得见"
       *   · 其它模式 → 报出序号，加上"第几块/共几块"，键盘用户才能定位自己在第几块
       *     （不报名字是刻意的：考试/困难模式就是不许看答案，
       *      但"第 2 块，共 7 块"不泄露任何答案信息） */
      const pieceIndex = el.tray.querySelectorAll('.piece').length + 1;
      const pieceTotal = currentLevel() ? currentLevel().adcodes.length : 0;
      btn.setAttribute('aria-label', PIECE_NAMES === 'always'
        ? `碎片：${shape.name}，第 ${pieceIndex} 块，共 ${pieceTotal} 块。按回车选中，再选地图上的位置`
        : `碎片，第 ${pieceIndex} 块，共 ${pieceTotal} 块。按回车选中，再选地图上的位置`);
      btn.setAttribute('aria-describedby', 'trayHint');
      // 碎片 svg 的 viewBox 直接复用该区县在地图上的包围盒，
      // 于是"碎片"和"地图上的那块"用的是同一份 path 数据，形状保证一致
      btn.innerHTML =
        `<svg width="${size.w.toFixed(1)}" height="${size.h.toFixed(1)}" ` +
        `viewBox="${shape.bbox.x} ${shape.bbox.y} ${shape.bbox.w} ${shape.bbox.h}" ` +
        `preserveAspectRatio="none" aria-hidden="true">` +
        `<path d="${shape.d}"></path></svg>` +
        /* 地名标签：只在教学模式渲染。
         * 用 aria-hidden 避免屏幕阅读器把名字读两遍（aria-label 里已经有了）。 */
        (PIECE_NAMES === 'always'
          ? `<span class="piece-name" aria-hidden="true">${shape.name}</span>`
          : '');

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
      const touch = isTouchPointer(ev);
      const rawX = ev.clientX;
      const rawY = ev.clientY;

      /* 【模型：判定点与镜头解耦，全部在屏幕空间里算】
       * offX/offY = 触点相对碎片中心的屏幕像素偏移。拖动时"碎片中心 = 指针 - 该偏移"，
       * 于是碎片老老实实跟着手指走 —— 这部分与镜头怎么动完全无关。
       *
       * 【为什么不需要"内容坐标"那一套】解析落点时屏幕坐标会被 getScreenCTM()
       * 换算进地图坐标，而 getScreenCTM 读的是**当前** viewBox。
       * 也就是说自动放大推近镜头后，同一个屏幕点自然对应到新镜头下的正确地图位置，
       * 落点本来就跟着镜头走，不需要把指针另存成一个坐标再还原。
       * （我一度为此加了一层内容坐标换算，反而引入了偏移与叠加推近，已删除。）
       *
       * 【触屏校准只施加一次】按原始触点记偏移，校正在算判定点时统一减一次。
       * 两处都减会让落点整块偏移 —— 实测澳门因此偏出 13px，落到隔壁广东上。 */
      drag = {
        adcode,
        pieceEl,
        startX: rawX,
        startY: rawY,
        offX: rawX - (rect.left + rect.width / 2),
        offY: rawY - (rect.top + rect.height / 2),
        w: rect.width,
        h: rect.height,
        ghost: null,
        moved: false,
        hitAdcode: null,
        lastX: rawX,
        lastY: rawY,
        touch,
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);

      /* 按下就为极小碎片推近镜头。
       * 【为什么放在这里】此刻玩家还没开始移动，镜头能在操作前就停稳；
       * 放在"越过拖拽阈值"那一刻会变成一边推镜头一边拖，目标持续跑位。 */
      zoomForTinyPiece(adcode);
    }

    /** 触屏校准：判定点/幽灵相对指针整体上移 DRAGF.touchLift。
     *  手指遮在触点的**下方**、视线在触点上方，所以瞄准的是抬高后的那一点。
     *  这是**唯一**施加校准的地方 —— 在别处再减一次会让落点整块偏移。 */
    function touchLiftPx(ctx) {
      return ctx && ctx.touch ? DRAGF.touchLift : 0;
    }

    /** 这次拖拽的判定点（真实落点，屏幕坐标）= 指针位置 - 抓取偏移 - 触屏校准。
     *  offX/offY 与校准都在 pointerdown 时按原始触点定好，这里只照着用，
     *  所以无论镜头怎么动，碎片中心始终贴着指针。 */
    function hitPointOf(ctx) {
      return {
        x: ctx.lastX - ctx.offX,
        y: ctx.lastY - ctx.offY - touchLiftPx(ctx),
      };
    }

    function dragHitPoint() {
      return hitPointOf(drag);
    }

    /** 某个空位在屏幕上的尺寸（像素）。CTM 无旋转/镜像时，"地图坐标长度 ×
     *  CTM 缩放"就是屏幕长度 —— 和 pieces 那边用 getBoundingClientRect 得到
     *  的效果一致，但不必等布局，拖动中每帧算也不贵。 */
    function slotScreenSize(adcode) {
      const slot = state.slots.get(adcode);
      const shape = shapes.get(adcode);
      if (!slot || !slot.path || !shape) return null;
      const m = slot.path.getScreenCTM();
      if (!m) return null;
      const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 0;
      return { w: shape.bbox.w * scale, h: shape.bbox.h * scale, scale };
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
        /* 【先把推近落定，再生成幽灵】玩家已经确实在拖了，镜头必须从这一刻起
         * 就是静止的 —— 否则他可能在这 320ms 动画跑完之前就松手，
         * 落点判定会打在"正在变化中的镜头"上，直接放到隔壁。
         * 全量冒烟实测过：淮北被判成宿州，150 项断言失败。 */
        settleZoomNow();
        spawnGhost();
      }

      // 高频事件用 rAF 节流，避免一帧内算好几次
      if (drag.rafPending) return;
      drag.rafPending = true;
      requestAnimationFrame(() => {
        if (!drag) return;
        drag.rafPending = false;
        /* 【每帧只解析一次落点】"幽灵画哪 / 哪个空位是候选"都要用到同一个命中结果。
         * 第一版各自算了一次，于是每帧要把全部空位遍历三遍、还各做一轮
         * isPointInFill —— 中国图第一关有 34 个空位，这是白白多出来的开销。 */
        const p = dragHitPoint();
        const hit = resolveDrop(p.x, p.y);
        applyGhostTransform(p);
        updateCandidate(hit);
      });
    }

    /** 拖动开始时，把所有"还没放上"的空位标记成 is-open。
     *  目的：给每个空位加一圈可见光晕，让目标不再"悄悄藏在地图里"。
     *  拖动结束统一 clearOpenSlots 摘掉。 */
    function markOpenSlots() {
      state.slots.forEach((slot) => slot.g.classList.add('is-open'));
    }

    function clearOpenSlots() {
      state.slots.forEach((slot) => slot.g.classList.remove('is-open', 'is-candidate'));
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
      /* 空位光晕：让"有没有目标、目标在哪"这件事不再取决于区域大小 */
      markOpenSlots();
      applyGhostTransform(dragHitPoint());
    }

    /* ---------- 自动放大：把"小到看不见的目标"直接变大 ----------
     *
     * 【方案：按下就推近，等镜头停稳再让玩家操作】
     *   推近挂在 pointerdown（按下那一刻），而不是"越过拖拽阈值"。
     *   于是无论玩家是"点一下选中再点空位"还是"按住直接拖"，
     *   镜头都在他真正开始移动之前就已经推到位了。
     *
     * 【为什么不挂在"越过拖拽阈值"】试过，不行：那一刻玩家已经在移动了，
     *   镜头一边推、手指一边走，目标在屏幕上的位置持续变化，玩家必须停下来重新瞄准。
     *   澳门实测要做到可瞄准需要约 90 倍 —— 在那个倍率下，屏幕上几像素的差
     *   就是地图里上百单位的偏差，于是"看着放对了却落到隔壁省"。
     *   把推近提前到按下那一刻，镜头在操作开始前就停稳，这类问题从根上消失。
     *
     * 【为什么一次拖拽只推一次】判定要用当前 viewBox 把屏幕坐标换算进地图坐标。
     *   镜头在操作过程中持续变化的话，手指没动、地图却在缩放，落点会持续漂。
     *   推近一次后定住，整段操作的映射关系就是稳定的。
     *
     * 【为什么不需要"另存一套坐标"来重新锚定】判定点全程用屏幕坐标表达
     *   （指针 - 抓取偏移），屏幕坐标不受 viewBox 影响；viewBox 只参与最后
     *   resolveDrop 那一步的换算，而那一步本来就读当前值。 */

    /* 当前镜头是为哪块碎片推近的（null = 处于本关全景）。
     * 用来避免重复推近、以及"点空白取消选中时拉回全景"。 */
    let zoomedFor = null;
    let zoomPromise = Promise.resolve();
    /* 正在动画中的推近目标。玩家一旦真的开始拖动就立刻落定到它 —— 见 settleZoomNow。 */
    let zoomTarget = null;

    /** 空位太小就推近镜头。推不动（本来就够大）就什么都不做。
     *  @returns {Promise<void>} 镜头停稳时兑现（没推近则立即兑现） */
    function zoomForTinyPiece(adcode) {
      if (!levelViewBox) return Promise.resolve();        // 还没定位过本关视图
      if (prefersReducedMotion()) return Promise.resolve(); // 系统要求少动效
      if (zoomedFor === adcode) return zoomPromise;       // 已经为这块推过了

      const size = slotScreenSize(adcode);
      if (!size) return Promise.resolve();
      const shortSide = Math.min(size.w, size.h);
      if (shortSide >= DRAGF.zoomBelowPx) return Promise.resolve();  // 本来就看得清

      /* 倍率 = 目标尺寸 / 当前尺寸。用**几何平均**而不是最小边：
       * 形状常有长短边（澳门 1:2、台湾狭长），按最小边算会把长边推得过大，
       * 几何平均对两个方向都照顾到。 */
      const geoMean = Math.sqrt(Math.max(size.w, 1e-6) * Math.max(size.h, 1e-6));
      let factor = DRAGF.zoomFitPx / geoMean;
      factor = Math.min(factor, DRAGF.zoomMax);
      factor = Math.max(factor, 1);                       // 只推近，不拉远
      const target = zoomedViewBox(adcode, factor);
      if (!target) return Promise.resolve();

      zoomedFor = adcode;
      zoomTarget = target;
      zoomPromise = animateViewBox(target, DRAGF.zoomInMs).then(() => { zoomTarget = null; });
      return zoomPromise;
    }

    /** 推近立刻落定，跳过剩余动画。
     *
     *  【为什么必须有这个】推近挂在 pointerdown，动画 320ms；但玩家可能按下就飞快拖、
     *  100 多毫秒就松手。那一瞬间镜头还在动，"同一个屏幕点对应地图哪儿"正在变 ——
     *  落点判定就会打到隔壁（全量冒烟实测：淮北被判成宿州，150 项断言失败）。
     *
     *  解法不是让判定去追动画，而是**在玩家真正开始拖动时把镜头一次落定**：
     *  此后整段拖拽镜头纹丝不动，映射关系稳定，落点必然正确。
     *  视觉上就是"一拖起来，镜头立刻到位" —— 比"一边拖一边推"更符合预期，
     *  因为拖动期间画面自己缩放本来就很晕。 */
    function settleZoomNow() {
      if (!zoomTarget) return;
      const target = zoomTarget;
      zoomTarget = null;
      animateViewBox(target, 0);   // 立即生效，并取消进行中的动画
    }

    /** 回到本关全景。deselectOnly 时不做动画 —— 用于"紧接着还要推近到另一块"，
     *  否则两次动画会互相打断，看起来像镜头在抖。 */
    function resetZoom(animateIt) {
      if (zoomedFor === null && !animateIt) return Promise.resolve();
      zoomedFor = null;
      zoomTarget = null;
      if (!levelViewBox) return Promise.resolve();
      if (!animateIt) {
        applyViewBox(levelViewBox);
        zoomPromise = Promise.resolve();
        return zoomPromise;
      }
      zoomPromise = animateViewBox(levelViewBox, DRAGF.zoomOutMs);
      return zoomPromise;
    }

    /** 以某个空位为中心、按倍率收窄本关全景，并夹住四边不越界。 */
    function zoomedViewBox(adcode, factor) {
      const shape = shapes.get(adcode);
      if (!shape || !levelViewBox) return null;
      const base = levelViewBox;
      let w = base.w / factor;
      let h = base.h / factor;

      /* 保持画布宽高比，否则 preserveAspectRatio 会再套一层缩放、
       * 算出来的"目标尺寸"就对不上了。 */
      const rect = el.board.getBoundingClientRect();
      const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1.2;
      if (w / h < aspect) w = h * aspect;
      else h = w / aspect;

      const cx = (shape.bbox.x + shape.bbox.x + shape.bbox.w) / 2;
      const cy = (shape.bbox.y + shape.bbox.y + shape.bbox.h) / 2;
      let x = cx - w / 2;
      let y = cy - h / 2;

      /* 夹在本关全景之内，保证"附近有邻居"这个定位参照不会跑丢 */
      x = clamp(x, base.x, base.x + base.w - w);
      y = clamp(y, base.y, base.y + base.h - h);
      return { x, y, w, h };
    }

    /** 幽灵画在哪：判定点（屏幕坐标）减去碎片半个尺寸。
     *  判定点已经包含了抓取偏移与触屏校准，所以幽灵中心正好落在指针那儿。 */
    function applyGhostTransform(p) {
      if (!drag || !drag.ghost) return;
      drag.ghost.style.transform =
        `translate3d(${(p.x - drag.w / 2).toFixed(1)}px, ${(p.y - drag.h / 2).toFixed(1)}px, 0)`;
    }


    /** 拖动过程中点亮"可能的目标"凹槽。
     *  @param {{adcode:(string|number)}|null} hit 本帧解析到的目标空位（由调用方算好） */
    function updateCandidate(hit) {
      if (!drag || !drag.ghost) return;
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

      /* 空位光晕与候选高亮统一在这里摘掉（clearOpenSlots 同时清掉两个类） */
      clearOpenSlots();

      /* 落点用屏幕公式算一次。resolveDrop 内部按**当前** viewBox 换算 ——
       * 拖动开始时可能刚为极小碎片推近过镜头而动画尚未跑完，
       * 用当前值正是我们要的：落点落在镜头此刻对应的那块地方。 */
      const p = hitPointOf(ctx);
      tryPlace(ctx.adcode, resolveDrop(p.x, p.y), ctx.ghost, ctx.pieceEl, { cx: p.x, cy: p.y });
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
        /* 【容错半径为什么按尺寸放大】原先是固定的 0.85 倍短边（clamp 34~110）。
         * 但"形状小"不等于"好瞄准"：澳门的地图坐标短边只有 0.1 个单位，
         * 就算取到 34px 下限也远远不够 —— 玩家根本看不见它，全靠容错兜住。
         * 改成随尺寸衰减的倍率：越小的形状给越宽的容错。
         * 对照（中国图，短边以地图坐标计）：
         *   澳门 0.1 → 上限 2.0 倍　香港 0.4 → 1.58 倍　台湾 4.1 → 0.4 倍（下限）
         * 取对数是为了让"数量级"起决定作用，而不是线性地越放大越离谱。 */
        const short = Math.max(1e-6, Math.min(shape.bbox.w, shape.bbox.h));
        const mult = clamp(0.85 + 0.3 * Math.log10(3 / short), 0.4, 2.0);
        const limit = clamp(short * mult, 34, 150);
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
        /* 反馈措辞分两档：
         *   普通（原行为）：连击断了要明确说，否则"清零"是静默的、没有惩罚感
         *   放软（儿童模式）：不提连击、不问责，只提示再找找 */
        if (SOFT_FEEDBACK) {
          showToast(`这里不是${rightName}哦，再找找看～`, 'bad');
        } else if (state.combo >= 2) {
          showToast(`连击中断（${state.combo} 连）· 这里是${wrongName}，${rightName}还在别处`, 'bad');
        } else {
          showToast(`这里是${wrongName}，${rightName}还在别处`, 'bad');
        }
        state.combo = 0;
        SFX.bad();
        updateStats();
        /* 放错时把镜头缓缓退回本关全景。两个用意：
         *   ① 给挫败一个缓冲 —— 抖一下然后镜头拉开，比原地卡在局部舒服；
         *   ② 顺手提醒"它在整张图的哪儿"，对"认识地图"这件事是正面的。
         * 用 1100ms，和拼完整图时拉远是同一个节奏，风格统一。 */
        resetZoom(true);
        /* 宿主页回调：回合切换 / 错题集 / 正确率 都靠这一条。
         * 引擎不知道宿主拿它做什么，所以这里只报"发生了什么"。 */
        if (ON_PLACEMENT) {
          try {
            ON_PLACEMENT({
              adcode: draggedAdcode,
              name: rightName,
              correct: false,
              landedOn: hit.adcode,
              landedOnName: wrongName,
            });
          } catch (e) { /* 宿主回调出错不该把游戏弄崩 */ }
        }
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

      /* 计分：放对一次 = 100 × 连击倍率（上限 ×5）。
       * 为什么封顶：不封顶会让"最后几块"变成刷分游戏，
       * 而封顶后"保持不断"才是重点 —— 这正好是想要的行为。 */
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      /* 计分公式来自 js/score.js（纯函数、可单测）。
       * 兜底 100×min(连击,5) 是刻意的：引擎要能**单独**被引擎测试页加载
       * （tools/engine-test.html 只引 engine.js），不能硬依赖别的模块。 */
      const MS = global.MapScore;
      state.score += MS ? MS.forPlacement(state.combo) : 100 * Math.min(state.combo, 5);
      updateStats();

      /* 宿主页回调（放对）。与放错那条对称，回调里报"发生了什么"，
       * 具体用来做回合切换、错题集还是正确率，引擎不关心。 */
      if (ON_PLACEMENT) {
        try {
          ON_PLACEMENT({
            adcode: adcode,
            name: shape.name,
            correct: true,
            landedOn: adcode,
            landedOnName: shape.name,
          });
        } catch (e) { /* 宿主回调出错不该把游戏弄崩 */ }
      }

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

      /* 【放下一块之后要把镜头送回全景】否则会一直停在近景：
       * 实机反馈——接着拖下一块时地图还是放大的，大碎片显示不全、
       * 也看不出自己该放哪儿，等于玩不下去。
       * 但也不能立刻拉走（玩家还在看"我放对了"），所以延后一点再缓缓退回。 */
      scheduleZoomOut();
    }

    /** 延时把镜头缓缓退回本关全景。放下一块之后调用。
     *  用 setTimeout 而不是立刻做：先让玩家看清"这块放对了"（配合信息卡），
     *  再退回全景，为下一块做准备。
     *
     *  【为什么先判断 zoomedFor】第一版无条件排程 + 取消旧定时器，
     *  结果**后一次调用取消了前一次有效的排程**：香港那轮排程之后，
     *  紧接着又来一次（那次 zoomedFor 已经是 null），把定时器清掉，
     *  于是它再也没触发，镜头永远停在近景 ——
     *  这正是"放完一块后地图回不到全局"的根因。
     *  现在只在"确实处于近景"时才排程；已经在全景就直接不做，
     *  也就不会误杀有效的排程。 */
    let zoomOutTimer = null;
    function scheduleZoomOut() {
      if (zoomedFor === null) return;
      if (zoomOutTimer) clearTimeout(zoomOutTimer);
      zoomOutTimer = setTimeout(() => {
        zoomOutTimer = null;
        resetZoom(true);
      }, DRAGF.resetAfterPlaceMs);
    }

    /** 取消待执行的退回（换关/重开时用，避免旧的定时器打到新的关卡上） */
    function cancelScheduledZoomOut() {
      if (zoomOutTimer) {
        clearTimeout(zoomOutTimer);
        zoomOutTimer = null;
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
        // 再点一次 = 取消选中，镜头回到本关全景
        clearSelection();
        resetZoom(true);
        return;
      }
      /* 【为什么这里传 true】clearSelection 默认会把镜头拉回全景，
       * 但紧接着就要推近到新选的这块 —— 两次动画会互相打断（看起来像镜头在抖）。
       * 所以这里"不做动画地"清掉上一次的推近状态，再干净地推近到新目标。 */
      clearSelection(true);
      state.selected = adcode;
      const pieceEl = state.pieces.get(adcode);
      if (pieceEl) pieceEl.classList.add('is-selected');
      el.trayHint.textContent = '已选中碎片，点地图上的虚线位置放下';
      updateSlotFocusability();
      SFX.pick();
      /* 选中极小碎片时推近镜头，让玩家在稳定的近景上找空位。
       * 推近发生在"拖拽之前"，动画有充裕时间跑完 —— 这是方案 A 的核心。 */
      zoomForTinyPiece(adcode);
    }

    /** 清除选中。
     *  @param {boolean} keepZoom 调用方马上要推近到别的目标时传 true：
     *         不做任何镜头动作，避免两次推近动画互相打断。 */
    function clearSelection(keepZoom) {
      if (state.selected !== null) {
        const prev = state.pieces.get(state.selected);
        if (prev) prev.classList.remove('is-selected');
      }
      state.selected = null;
      el.trayHint.textContent = '拖动碎片到地图上的虚线位置';
      updateSlotFocusability();
      if (!keepZoom) resetZoom(false);
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
    /** 提示次数用完了吗（null/Infinity = 不限） */
    function hintsExhausted() {
      if (HINT_LIMIT === null || HINT_LIMIT === Infinity) return false;
      return state.hints >= HINT_LIMIT;
    }

    /** 提示按钮的可用状态：用完就禁用并把原因写在 title 上（而不是点了没反应） */
    function updateHintButton() {
      if (!el.btnHint) return;
      const left = (HINT_LIMIT === null || HINT_LIMIT === Infinity)
        ? null : Math.max(0, HINT_LIMIT - state.hints);
      const done = left === 0;
      el.btnHint.disabled = done;
      el.btnHint.setAttribute('aria-disabled', done ? 'true' : 'false');
      el.btnHint.title = left === null
        ? '提示：帮你点亮一块（本模式不限次数）'
        : (done ? '这个难度的提示已经用完了' : '提示：帮你点亮一块（还剩 ' + left + ' 次）');
      /* 只改文字那一层：宿主页把文案包在 [data-hint-label] 里，
       * 直接写 textContent 会把按钮左边的 SVG 图标一起清掉。
       * 找不到那个 span 时（别的宿主页可能没包）才退回整个按钮。 */
      const label = el.btnHint.querySelector('[data-hint-label]');
      const text = left === null
        ? '提示'
        : (done ? '提示已用完' : '提示（剩 ' + left + '）');
      if (label) label.textContent = text;
      else el.btnHint.textContent = text;
    }

    function doHint() {
      if (hintsExhausted()) {
        /* 明确告诉他为什么点不动，而不是静默失败 */
        showToast(HINT_LIMIT === 0 ? '这个难度不给提示哦' : '提示次数用完了', 'bad');
        updateHintButton();
        return;
      }
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
      showToast(SOFT_FEEDBACK
        ? `看看 ${shapes.get(adcode).name} 在哪里呀～`
        : `提示：找一找 ${shapes.get(adcode).name}`, 'ok');
      updateHintButton();
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
          ${meta.src
            ? `<p class="info-src">资料来源：${meta.src}</p>`
            : '<p class="info-src is-missing">资料来源待补 —— 补一条也算帮忙</p>'}
          <button type="button" class="info-report" data-adcode="${adcode}">
            发现写错了 / 想补充这条
          </button>
        </div>`;

      /* 纠错入口：引擎不认识"众包通道"，只把"想报告的区县"抛给宿主页。
       * 宿主页没接 onReportIssue 时按钮直接移除 —— 引擎仍能独立跑测试。 */
      const reportBtn = el.infoCard.querySelector('.info-report');
      if (reportBtn && typeof CONFIG.onReportIssue === 'function') {
        reportBtn.addEventListener('click', () => {
          CONFIG.onReportIssue({ adcode: adcode, name: shape.name, meta: meta });
        });
      } else if (reportBtn) {
        /* 宿主页没接这个回调 → 直接摘掉按钮，不留一个点了没反应的控件 */
        reportBtn.remove();
      }
    }

    /* ============================ 通关 ============================ */
    function finishLevel() {
      state.solved = true;
      stopTimer();
      /* 通关奖励：剩余时间的加成。
       * 上限 2000 —— 刻意控制在"连击奖励量级"之下：
       * 想拿高分主要靠**不乱放**，而不是靠手速。 */
      const MS2 = global.MapScore;
      const timeBonus = MS2
        ? MS2.timeBonus(state.elapsed, currentLevel().adcodes.length)
        : Math.max(0, 2000 - Math.floor(state.elapsed / 1000) * 10);
      state.score += timeBonus;
      updateStats();
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

      /* 全部拼完就拉远到全图，让玩家看一眼自己拼出来的完整地图 */
      if (isLast) {
        animateViewBox(computeLevelViewBox([...shapes.keys()]), 1100);
        /* 通关整张地图的通知 —— 交给宿主层决定"记账/发成就/弹提示"。
         * 【为什么由宿主层做】引擎只该知道"这张图拼完了"，
         * 跨地图的进度账本（js/progress.js）与它无关；
         * 这样引擎保持可移植，进度逻辑也能被别的宿主复用。 */
        if (typeof config.onMapSolved === 'function') {
          try {
            config.onMapSolved({
              mapId: config.id,
              mapName: config.name,
              levelCount: LEVELS.length,
              elapsed: state.elapsed,
              tries: state.tries,
              hints: state.hints,
            });
          } catch (e) { /* 回调出错不能影响结算画面 */ }
        }
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
          <div class="stat"><span class="stat-k">得分</span><span class="stat-v" id="mvScore">0</span></div>
          <div class="stat"><span class="stat-k">最高连击</span><span class="stat-v" id="mvCombo">0</span></div>
          <div class="stat"><span class="stat-k">用时</span><span class="stat-v" id="mvTime">00:00</span></div>
          <div class="stat"><span class="stat-k">尝试</span><span class="stat-v" id="mvTries">0</span></div>
          <div class="stat"><span class="stat-k">提示</span><span class="stat-v" id="mvHints">0</span></div>`;
        countUp(el.modalStats.querySelector('#mvScore'), state.score, 900, String);
        countUp(el.modalStats.querySelector('#mvCombo'), state.bestCombo, 700, String);
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
      /* 统计一变，提示按钮的"还剩几次"也要跟着变。
       * 挂在这里而不是散落在各处，是为了保证"按钮状态永远等于真实状态"——
       * 换关、重开、用掉一次提示，都会经过 updateStats。 */
      if (typeof updateHintButton === 'function') updateHintButton();
      const level = currentLevel();
      const total = level.adcodes.length;
      const done = state.placed.size;

      el.statDone.textContent = done;
      el.statTotal.textContent = total;
      el.statTries.textContent = state.tries;
      el.statHints.textContent = state.hints;
      if (el.statScore) el.statScore.textContent = state.score;
      if (el.comboChip) {
        // 连击 >= 2 才显示：1 连没有信息量，常驻反而干扰
        if (state.combo >= 2) {
          el.comboChip.hidden = false;
          if (el.statCombo) el.statCombo.textContent = state.combo;
          el.comboChip.classList.toggle('is-hot', state.combo >= 5);
        } else {
          el.comboChip.hidden = true;
        }
      }
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
      /* 进关时就把提示额度显示在按钮上（"剩 N 次"），
       * 而不是等玩家点了才发现没额度了 */
      updateHintButton();
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
     * 只暴露这三个入口，内部状态一律不直接给出，免得宿主页面改坏引擎。
     * 注意：引擎并不自动启动 —— 由宿主页面（js/game.js）决定何时 init()。
     *
     * 【为什么没有暴露"镜头停稳"的承诺】一度加过 whenViewSettled，想让测试
     * 等推近动画跑完再判定落点。但那个承诺只在"某一次动画"上兑现，而镜头
     * 会被复位、会被下一次推近打断，追踪一个 Promise 反而比直接观察
     * "viewBox 不再变化"更脆。改成让玩家真正拖动时**立刻落定镜头**之后，
     * 这条需求也消失了 —— 于是删掉这个没有消费者的接口，不留无法被验证的 API。 */
    return {
      start: init,
      getState: snapshotState,
      /* 本关全景的 viewBox（自动放大用它当基准）。宿主/测试需要判断
       * "镜头现在是不是在全景"时，应当用这个权威值，
       * 而不是自己拿当前空位去反推 —— 拼到后面空位越来越少，
       * 反推出来的"全景"会越来越小，结论就完全错了。 */
      getLevelViewBox: () => (levelViewBox ? { ...levelViewBox } : null),
      /* 立刻把镜头放回本关全景（不做动画），并取消排队中的退回。
       * 给宿主/测试用的"复位"入口：直接改 SVG 的 viewBox 属性是不行的 ——
       * 引擎内部的 currentVB 不知道你改了，进行中的动画会立刻把它覆盖回去。 */
      resetView: () => {
        cancelScheduledZoomOut();
        zoomedFor = null;
        zoomTarget = null;
        if (levelViewBox) applyViewBox(levelViewBox);
      },
    };
  }

  global.MapPuzzleEngine = { create: createMapPuzzleEngine };
})(window);
