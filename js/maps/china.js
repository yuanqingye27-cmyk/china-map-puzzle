/* =====================================================================
 * 地图包 · 中国（配置）
 * ---------------------------------------------------------------------
 * 路径：js/maps/china.js
 * 生成：node tools/add-map.js --adcode=100000 --name=china
 *
 * 【层级】parent = null（根地图）　adcode = 100000
 *   children 不在这里写 —— 它由 registry 根据子地图的 parent 反向推导，
 *   所以新增下级地图不必回头改这个文件（见 tools/build-registry.js）。
 *
 * 三件套分工：
 *   china.geo.js   构建产物（自动生成）
 *   china.data.js  人工资料与关卡（本包的文字都在那里改）
 *   china.js       本文件：配色/存储/文案
 * ===================================================================== */

(function (global) {
  'use strict';

  const GEO_ALL = (global.MAP_GEO = global.MAP_GEO || {});
  const DATA_ALL = (global.MAP_DATA = global.MAP_DATA || {});
  const DATA = DATA_ALL['china'] || {};

  const CONFIG = {
    id: 'china',
    name: '中华人民共和国',
    parent: null,
    adcode: 100000,

    geo: GEO_ALL['china'],
    districts: DATA.districts,
    levels: DATA.levels,

    map: { width: 1000, padding: 14 },
    piece: { max: 62, minSide: 15, pieces: [[420, 40], [620, 48], [900, 56]] },

    /* 主色相由 adcode 派生（见 tools/add-map.js 的 hueFor），每关错开约 51°。
     * 键名必须与 china.data.js 里 LEVELS 的 id 一一对应。
     * 【为什么是语义 id 而不是 l1/l2】中国图这 7 关是按**地理分区**手写的
     * （东北/华北/华东/华中/华南/西南/西北），不是按行政类型自动分的。
     * tools/regroup-levels.js 有一条守卫：只要关卡 id 不是 `l\d+` 形式，
     * 就认定这份关卡是人工编排的、整体跳过不重排 —— 用语义 id 才能保住它。 */
    palette: {
      hueByLevel: {
        dongbei: 200,
        huabei: 251,
        huadong: 302,
        huazhong: 353,
        huanan: 44,
        xinan: 95,
        xibei: 146,
      },
      fallbackHue: 200,
      saturation: 62,
      lightBase: 48,
      lightStep: 7,
      lightSpan: 16,
      hueSpread: 44,
    },

    /* 每张地图必须有独立的存储 key，否则两张地图的存档会互相覆盖 */
    storage: {
      save: 'china-map-puzzle',
      theme: 'china-map-theme',
      sound: 'china-map-sound',
      intro: 'china-map-intro-seen',
      saveVersion: 2,
    },

    themes: { list: ['jade', 'ginkgo', 'shu'], fallback: 'jade' },

    texts: {
      cityName: '中华人民共和国',
      districtCount: 34,
      missingDataHint:
        '地图数据没加载出来，请确认 js/maps/china.geo.js 存在且没有被浏览器拦截。',
    },
  };

  const PACKAGES = (global.MAP_PACKAGES = global.MAP_PACKAGES || {});
  PACKAGES['china'] = CONFIG;
})(window);
