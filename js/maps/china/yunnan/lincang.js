/* =====================================================================
 * 地图包 · lincang（配置）
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/yunnan/lincang.js
 * 生成：node tools/add-map.js --adcode=530900 --name=lincang --parent=yunnan
 *
 * 【层级】parent = 'yunnan'　adcode = 530900
 *   children 不在这里写 —— 它由 registry 根据子地图的 parent 反向推导，
 *   所以新增下级地图不必回头改这个文件（见 tools/build-registry.js）。
 *
 * 三件套分工：
 *   lincang.geo.js   构建产物（自动生成）
 *   lincang.data.js  人工资料与关卡（本包的文字都在那里改）
 *   lincang.js       本文件：配色/存储/文案
 * ===================================================================== */

(function (global) {
  'use strict';

  const GEO_ALL = (global.MAP_GEO = global.MAP_GEO || {});
  const DATA_ALL = (global.MAP_DATA = global.MAP_DATA || {});
  const DATA = DATA_ALL['lincang'] || {};

  const CONFIG = {
    id: 'lincang',
    name: '临沧市',
    parent: 'yunnan',
    adcode: 530900,

    geo: GEO_ALL['lincang'],
    districts: DATA.districts,
    levels: DATA.levels,

    map: { width: 1000, padding: 14 },
    piece: { max: 62, minSide: 15, pieces: [[420, 40], [620, 48], [900, 56]] },

    /* 主色相由 adcode 派生（见 tools/add-map.js 的 hueFor），每关错开 52° */
    palette: {
      hueByLevel: {
      l1: 260,
      },
      fallbackHue: 260,
      saturation: 62,
      lightBase: 48,
      lightStep: 7,
      lightSpan: 16,
      hueSpread: 44,
    },

    /* 每张地图必须有独立的存储 key，否则两张地图的存档会互相覆盖 */
    storage: {
      save: 'lincang-map-puzzle',
      theme: 'lincang-map-theme',
      sound: 'lincang-map-sound',
      intro: 'lincang-map-intro-seen',
      saveVersion: 2,
    },

    themes: { list: ['jade', 'ginkgo', 'shu'], fallback: 'jade' },

    texts: {
      cityName: '临沧市',
      districtCount: 8,
      missingDataHint:
        '地图数据没加载出来，请确认 js/maps/china/yunnan/lincang.geo.js 存在且没有被浏览器拦截。',
    },
  };

  const PACKAGES = (global.MAP_PACKAGES = global.MAP_PACKAGES || {});
  PACKAGES['lincang'] = CONFIG;
})(window);
