/* =====================================================================
 * 地图加载器（运行时 · 浏览器侧）
 * ---------------------------------------------------------------------
 * 路径：js/maps/loader.js
 *
 * 【加载策略：按需注入脚本】
 *   registry.js 只是一份很轻的元信息（几 KB），一次性全量加载；
 *   真正几百 KB 的 .geo.js 等到"用户选中某张地图"时才用 <script> 注入。
 *   于是地图再多，首屏也不会变慢。
 *
 *   为什么是注入 <script> 而不是 fetch？——因为 index.html 要能双击直接打开。
 *   file:// 下浏览器会拦 fetch 本地 .json（CORS），但普通 <script> 不受影响，
 *   "零依赖、双击即玩"这条底线就是这么保住的。
 *
 * 【路径约定】地图包的三个脚本路径由 `dir + id` 现算：
 *   `<dir>/<id>.geo.js`、`<dir>/<id>.data.js`、`<dir>/<id>.js`（根地图 dir 为空）。
 *   **registry 里不再存 scripts 字段** —— 它是纯推导结果，而 registry 是首屏要下载的文件；
 *   接满全国 494 张地图时，省掉这个字段能少约三分之一体积。
 *   本文件用自己 <script src> 的地址推算基准目录，所以宿主页放在哪一层都不会错。
 * ===================================================================== */

(function (global) {
  'use strict';

  /** 本文件自己的 URL → js/maps/ 基准目录 */
  const BASE = (function () {
    const cur = document.currentScript;
    if (cur && cur.src) return cur.src.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
    return 'js/maps/'; // 兜底（理论上用不到）
  })();

  /** 由一个 registry 条目推出它要注入的三个脚本（顺序不能改：
   *  .geo.js 与 .data.js 都是往全局登记，最后 .js 才组装出地图包） */
  function scriptsOfEntry(e) {
    const base = e.dir ? e.dir + '/' : '';
    return [base + e.id + '.geo.js', base + e.id + '.data.js', base + e.id + '.js'];
  }

  /** 正在加载中的地图：id → Promise，避免同一张图被并发加载两次 */
  const inflight = {};

  const registry = () =>
    global.MAP_REGISTRY || { version: 1, roots: [], orphans: [], maps: {} };

  function entry(id) {
    return registry().maps[id] || null;
  }

  function inject(url) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = url;
      el.async = false; // 按插入顺序执行，保持依赖顺序
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('脚本加载失败：' + url));
      document.head.appendChild(el);
    });
  }

  /**
   * 加载一张地图：按 registry 里登记的顺序注入它的三个脚本，
   * resolve 出可以直接交给引擎的配置对象。
   *
   * 同一个 id 重复调用只会真的加载一次（memoize）；
   * 失败会把缓存清掉，允许重试（否则一次网络抖动就永久卡住）。
   *
   * @param {string} id 地图包 id，如 'chengdu'
   * @returns {Promise<object>} 引擎配置
   */
  function load(id) {
    if (global.MAP_PACKAGES && global.MAP_PACKAGES[id]) {
      return Promise.resolve(global.MAP_PACKAGES[id]);
    }
    if (inflight[id]) return inflight[id];

    const e = entry(id);
    if (!e) {
      const known = Object.keys(registry().maps).join(', ') || '（空）';
      return Promise.reject(new Error('registry 里没有地图「' + id + '」。已接入的有：' + known));
    }

    inflight[id] = (async () => {
      const scripts = scriptsOfEntry(e);
      for (let i = 0; i < scripts.length; i++) {
        await inject(BASE + scripts[i]);
      }
      const pkg = global.MAP_PACKAGES && global.MAP_PACKAGES[id];
      if (!pkg) {
        throw new Error('脚本都加载了，但地图包「' + id + '」没有登记到 window.MAP_PACKAGES');
      }
      return pkg;
    })();

    inflight[id].catch(() => {
      delete inflight[id];
    });

    return inflight[id];
  }

  /** 这张地图的脚本是否已经注入过 */
  function isLoaded(id) {
    return !!(global.MAP_PACKAGES && global.MAP_PACKAGES[id]);
  }

  /** 全部已登记地图，按 adcode 升序 */
  function list() {
    return Object.keys(registry().maps)
      .map((id) => registry().maps[id])
      .sort((a, b) => (a.adcode || 0) - (b.adcode || 0));
  }

  /** 直接下级地图 */
  function childrenOf(id) {
    const e = entry(id);
    return e ? e.children.map((c) => registry().maps[c]).filter(Boolean) : [];
  }

  /** 上一级地图（父级还没接入时返回 null —— 也就是 registry.orphans 里那些） */
  function parentOf(id) {
    const e = entry(id);
    return e && e.parent ? registry().maps[e.parent] || null : null;
  }

  /**
   * 从根到指定地图的路径，用于面包屑导航：
   *   trail('chengdu') → [{id:'china',…}, {id:'sichuan',…}, {id:'chengdu',…}]
   * 父级还没接入时（孤儿地图）就只返回它自己，界面上自然表现为"没有上一级"。
   */
  function trail(id) {
    const path = [];
    let cur = entry(id);
    for (let guard = 0; cur && guard < 16; guard++) {
      path.unshift(cur);
      cur = cur.parent ? registry().maps[cur.parent] || null : null;
    }
    return path;
  }

  global.MapLoader = {
    base: BASE,
    registry,
    list,
    entry,
    childrenOf,
    parentOf,
    trail,
    load,
    isLoaded,
  };
})(window);
