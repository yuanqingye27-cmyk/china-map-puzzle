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
        global.MapPuzzleEngine.create(config).start();
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
