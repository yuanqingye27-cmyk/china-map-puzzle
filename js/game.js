/* =====================================================================
 * 启动引导 · 成都地图拼图
 * ---------------------------------------------------------------------
 * 这个文件刻意做得很薄：只负责"把城市配置交给引擎并启动"。
 * 所有游戏逻辑都在 js/engine.js 里，所以换城市不需要动这里。
 *
 * 多城市时这里会长成：
 *   const city = new URLSearchParams(location.search).get('city') || 'chengdu';
 *   MapPuzzleEngine.create(CITY_CONFIGS[city]).start();
 * 本轮先固定加载 js/cities/chengdu.js。
 * ===================================================================== */

(function (global) {
  'use strict';

  function boot() {
    // 引擎文件没加载出来（路径写错 / 被浏览器拦），给一句人话提示
    if (!global.MapPuzzleEngine) {
      document.body.innerHTML =
        '<p style="padding:40px;color:#e7f2ec;font-family:sans-serif">' +
        '引擎没加载出来，请确认 js/engine.js 存在且没有被浏览器拦截。</p>';
      return;
    }

    // CONFIG 缺失（比如 js/cities/*.js 没加载）时，引擎内部会兜底并提示
    global.MapPuzzleEngine.create(global.MAP_PUZZLE_CONFIG).start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
