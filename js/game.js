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

  /** 把标题栏的文案换成当前这张地图的（换地图后不该还写着"成都"） */
  function updateBrand(config, id) {
    const name = (config && config.name) || id;
    const title = document.getElementById('brandTitle');
    const sub = document.getElementById('brandSub');
    // 数量以配置里的 districtCount 为准：geo 里可能还混着非行政区 feature
    // （比如全国数据里的南海九段线），拿 features.length 会多说一个
    const count = (config && config.texts && config.texts.districtCount) ||
      (config && config.geo && config.geo.features.length) || 0;
    if (title) title.textContent = name + '地图拼图';
    if (sub) sub.textContent = '拖动碎片，拼出' + name + (count ? '的 ' + count + ' 个下级行政区' : '');
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.setAttribute('aria-label', name + '行政区划拼图板');
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
   * 渲染地图选择器：把 registry 里的树按层级缩进排成下拉项。
   * 父级还没接入的地图（registry.orphans）挂到顶层并注明，不藏起来 ——
   * 它是一个"父级空位还等着填"的信号，不该让用户在界面上找不到这张图。
   */
  function renderSelect(currentId) {
    const sel = document.getElementById('mapSelect');
    if (!sel) return;
    const reg = global.MAP_REGISTRY || { roots: [], orphans: [], maps: {} };

    const option = (id, depth, note) => {
      const m = global.MapLoader.entry(id);
      if (!m) return;
      const o = document.createElement('option');
      o.value = id;
      o.textContent = '　'.repeat(depth) + m.name + (note ? '（' + note + '）' : '');
      if (id === currentId) o.selected = true;
      sel.appendChild(o);
    };

    // 从根往下递归，depth 决定缩进 —— 山东下的济南会显示在济南下面
    const walk = (id, depth, guard) => {
      if (guard > 16) return; // 防止 parent 成环把自己递归死
      option(id, depth);
      global.MapLoader.childrenOf(id).forEach((c) => walk(c.id, depth + 1, guard + 1));
    };

    sel.innerHTML = '';
    (reg.roots || []).forEach((id) => walk(id, 0, 0));
    (reg.orphans || []).forEach((o) => option(o.id, 0, '父级 ' + o.parent + ' 待接入'));
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

    global.MapLoader.load(id)
      .then((config) => {
        // 配置缺失时引擎内部会兜底并提示（不会抛）
        // 注意 start() 不返回任何东西，实例要先接住再启动
        const engine = global.MapPuzzleEngine.create(config);
        engine.start();
        // 暴露实例给测试和调试用（getState() 是引擎的公开接口，不是内部状态）
        global.__ENGINE__ = engine;

        // 导航 UI 属于宿主层：引擎起来之后再渲染，它就是"最后一件事"
        updateBrand(config, id);
        renderNav(id);

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
