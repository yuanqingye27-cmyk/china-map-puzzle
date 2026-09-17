/* =====================================================================
 * 地图包 · changdou（配置）
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/xizang/changdou.js
 * 生成：node tools/add-map.js --adcode=540300 --name=changdou --parent=xizang
 *
 * 【层级】parent = 'xizang'　adcode = 540300
 *   children 不在这里写 —— 它由 registry 根据子地图的 parent 反向推导，
 *   所以新增下级地图不必回头改这个文件（见 tools/build-registry.js）。
 *
 * 三件套分工：
 *   changdou.geo.js   构建产物（自动生成）
 *   changdou.data.js  人工资料与关卡（本包的文字都在那里改）
 *   changdou.js       本文件：配色/存储/文案
 * ===================================================================== */

(function (global) {
  'use strict';

  const GEO_ALL = (global.MAP_GEO = global.MAP_GEO || {});
  const DATA_ALL = (global.MAP_DATA = global.MAP_DATA || {});
  const DATA = DATA_ALL['changdou'] || {};

  const CONFIG = {
    id: 'changdou',
    name: 'changdou',
    parent: 'xizang',
    adcode: 540300,

    geo: GEO_ALL['changdou'],
    districts: DATA.districts,
    levels: DATA.levels,

    map: { width: 1000, padding: 14 },
    piece: { max: 62, minSide: 15, pieces: [[420, 40], [620, 48], [900, 56]] },

    /* 主色相由 adcode 派生（见 tools/add-map.js 的 hueFor），每关错开 52° */
    palette: {
      hueByLevel: {
      l1: 300,
      l2: 352,
      },
      fallbackHue: 300,
      saturation: 62,
      lightBase: 48,
      lightStep: 7,
      lightSpan: 16,
      hueSpread: 44,
    },

    /* 每张地图必须有独立的存储 key，否则两张地图的存档会互相覆盖 */
    storage: {
      save: 'changdou-map-puzzle',
      theme: 'changdou-map-theme',
      sound: 'changdou-map-sound',
      intro: 'changdou-map-intro-seen',
      saveVersion: 2,
    },

    themes: { list: ['jade', 'ginkgo', 'shu'], fallback: 'jade' },

    texts: {
      cityName: 'changdou',
      districtCount: 11,
      missingDataHint:
        '地图数据没加载出来，请确认 js/maps/china/xizang/changdou.geo.js 存在且没有被浏览器拦截。',
    },
  };

  const PACKAGES = (global.MAP_PACKAGES = global.MAP_PACKAGES || {});
  PACKAGES['changdou'] = CONFIG;
})(window);
