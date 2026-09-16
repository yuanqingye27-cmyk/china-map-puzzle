/* =====================================================================
 * 启动引导 · 地图拼图
 * ---------------------------------------------------------------------
 * 这个文件刻意做得很薄：只负责"挑一份地图配置交给引擎并启动"。
 * 所有游戏逻辑都在 js/engine.js 里，所以换地图不需要动这里。
 *
 * 本轮仍是静态加载成都（index.html 里按顺序写死了三个包文件）。
 * 下一步会长成：读 registry → 动态注入该地图的脚本 → 支持 ?map=<id> 选择。
 * ===================================================================== */

(function (global) {
  'use strict';

  /** 没有 ?map= 参数时默认启动哪张地图 */
  const DEFAULT_MAP = 'chengdu';

  function boot() {
    // 引擎文件没加载出来（路径写错 / 被浏览器拦），给一句人话提示
    if (!global.MapPuzzleEngine) {
      document.body.innerHTML =
        '<p style="padding:40px;color:#e7f2ec;font-family:sans-serif">' +
        '引擎没加载出来，请确认 js/engine.js 存在且没有被浏览器拦截。</p>';
      return;
    }

    // 地图包把自己登记在 window.MAP_PACKAGES[id] 上（见 js/maps/**.js）
    const packages = global.MAP_PACKAGES || {};

    // CONFIG 缺失（比如包脚本没加载）时，引擎内部会兜底并提示
    global.MapPuzzleEngine.create(packages[DEFAULT_MAP]).start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
