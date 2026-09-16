/* =====================================================================
 * 城市配置 · 成都
 * ---------------------------------------------------------------------
 * 这个文件是"数据"和"引擎"的分界线：
 *   js/engine.js          通用引擎，不认识任何一个具体城市
 *   js/cities/<city>.js   一个城市一份配置（本文件）
 *
 * 引擎只认这一个全局对象 window.MAP_PUZZLE_CONFIG。
 * 想做一个新城市，就照着本文件复制一份、换掉数据和配色即可，
 * 不需要改引擎里的任何一行逻辑。
 *
 * ⚠️ 加载顺序：本文件依赖 map-data.js 和 districts.js，
 *    必须排在它们后面、engine/game 之前。
 * ===================================================================== */

(function (global) {
  'use strict';

  const CONFIG = {
    /* ---------------- 身份 ---------------- */
    id: 'chengdu',
    name: '成都',

    /* ---------------- 数据（引擎的三份输入） ----------------
     * geo        GeoJSON FeatureCollection，每个 feature 需要
     *            properties.adcode / properties.name
     * districts  adcode -> 资料卡（面积 / 地标 / 一句话 / 冷知识）
     * levels     关卡设定：id / name / short / blurb / adcodes
     * -------------------------------------------------------- */
    geo: global.CHENGDU_GEO,
    districts: global.DistrictData && global.DistrictData.DISTRICT_INFO,
    levels: global.DistrictData && global.DistrictData.LEVELS,

    /* ---------------- 画布 ---------------- */
    map: {
      width: 1000,   // 画布逻辑宽度，高度按地理比例自动推算
      padding: 14,   // 四周留白
    },

    /* ---------------- 碎片尺寸 ----------------
     * pieces: [视口宽度上限, 碎片最大边]，从窄到宽匹配，都不中就用 max
     * 手机上一关 7~8 块如果用 62px 会把托盘横向撑破（实测第 5 块被裁掉）
     * ------------------------------------------- */
    piece: {
      max: 62,
      minSide: 15,   // 碎片短边下限，防止细长条形看不清
      pieces: [[420, 40], [620, 48], [900, 56]],
    },

    /* ---------------- 配色 ----------------
     * 每个关卡一个主色相（HSL 的 H），同关内再靠 hueSpread / lightStep
     * 微调出层次，于是相邻区县既协调又能区分。
     * 换城市只需要换这一块 —— 这就是"不同城市不同主色调"的入口。
     * -------------------------------------- */
    palette: {
      hueByLevel: { core: 34, inner: 158, outer: 196 }, // 银杏金 / 竹青 / 青瓷
      fallbackHue: 160,   // 关卡没配色相时的兜底
      saturation: 62,     // 饱和度 %
      lightBase: 48,      // 明度起点 %
      lightStep: 7,       // 每块递增的明度
      lightSpan: 16,      // 明度摆动的总幅度（取模）
      hueSpread: 44,      // 色相摆动总幅度（取模后再减一半）
    },

    /* ---------------- 本地存储 ----------------
     * 每个城市用独立的 key，否则两个城市的存档会互相覆盖
     * ------------------------------------------- */
    storage: {
      save: 'chengdu-map-puzzle',
      theme: 'chengdu-map-theme',
      sound: 'chengdu-map-sound',
      intro: 'chengdu-map-intro-seen',
      saveVersion: 2,   // 存档结构版本，升级后旧档会被丢弃而不是读出乱码
    },

    /* ---------------- 配色主题（CSS 里的 data-theme） ---------------- */
    themes: {
      list: ['jade', 'ginkgo', 'shu'],
      fallback: 'jade',
    },

    /* ---------------- 文案 ----------------
     * 只放"会因城市而变"的部分；交互提示语这类通用文案写在引擎里，
     * 引擎用这里的值去拼。
     * -------------------------------------- */
    texts: {
      cityName: '成都',
      districtCount: 20,   // 全部区县数，通关文案里用
      // 数据结构缺失时的应急提示（直接写进 <body>）
      missingDataHint:
        '地图数据没加载出来，请确认 js/map-data.js、js/districts.js 存在且没有被浏览器拦截。',
    },
  };

  global.MAP_PUZZLE_CONFIG = CONFIG;
})(window);
