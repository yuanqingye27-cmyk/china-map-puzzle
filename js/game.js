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

  /** 没有 ?map= 参数时默认启动哪张地图 */
  const DEFAULT_MAP = 'chengdu';

  /** 当前地图 id。boot() 里赋值；分享/进度等跨函数逻辑要用到它 */
  let CURRENT_ID = DEFAULT_MAP;

  function showFatal(message) {
    document.body.innerHTML =
      '<p style="padding:40px;color:#e7f2ec;font-family:sans-serif">' + message + '</p>';
  }

  /** URL 里指定的地图 id，没有就用默认值 */
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
  function markReady(id) {
    document.documentElement.setAttribute('data-map-ready', id);
    try {
      document.dispatchEvent(new global.CustomEvent('map-ready', { detail: { id } }));
    } catch (e) {
      /* CustomEvent 不可用时忽略：属性标记已经足够 */
    }
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

  global.MapLoader.load(id)
      .then((config) => {
        /* 通关整张地图时记账 + 发成就。
         * 引擎只报"拼完了"，跨地图的账本归 js/progress.js ——
         * 这样引擎保持可移植，进度逻辑也能被别的宿主复用。 */
        config.onMapSolved = (result) => {
          recordMapSolved(config, id, result);
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

        // 配置缺失时引擎内部会兜底并提示（不会抛）
        // 注意 start() 不返回任何东西，实例要先接住再启动
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

        markReady(id);
      })
      .catch((err) => {
        showFatal(
          '地图「' + id + '」没加载出来：' + err.message +
          '<br>检查一下 js/maps/registry.js 里这张地图登记的脚本路径。'
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
