/* =====================================================================
 * 地图包 · shuangyashan（配置）
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/heilongjiang/shuangyashan.js
 * 生成：node tools/add-map.js --adcode=230500 --name=shuangyashan --parent=heilongjiang
 *
 * 【层级】parent = 'heilongjiang'　adcode = 230500
 *   children 不在这里写 —— 它由 registry 根据子地图的 parent 反向推导，
 *   所以新增下级地图不必回头改这个文件（见 tools/build-registry.js）。
 *
 * 三件套分工：
 *   shuangyashan.geo.js   构建产物（自动生成）
 *   shuangyashan.data.js  人工资料与关卡（本包的文字都在那里改）
 *   shuangyashan.js       本文件：配色/存储/文案
 * ===================================================================== */

(function (global) {
  'use strict';

  const GEO_ALL = (global.MAP_GEO = global.MAP_GEO || {});
  const DATA_ALL = (global.MAP_DATA = global.MAP_DATA || {});
  const DATA = DATA_ALL['shuangyashan'] || {};

  const CONFIG = {
    id: 'shuangyashan',
    name: '双鸭山市',
    parent: 'heilongjiang',
    adcode: 230500,

    geo: GEO_ALL['shuangyashan'],
    districts: DATA.districts,
    levels: DATA.levels,

    map: { width: 1000, padding: 14 },
    piece: { max: 62, minSide: 15, pieces: [[420, 40], [620, 48], [900, 56]] },

    /* 主色相由 adcode 派生（见 tools/add-map.js 的 hueFor），每关错开 52° */
    palette: {
      hueByLevel: {
      l1: 100,
      },
      fallbackHue: 100,
      saturation: 62,
      lightBase: 48,
      lightStep: 7,
      lightSpan: 16,
      hueSpread: 44,
    },

    /* 每张地图必须有独立的存储 key，否则两张地图的存档会互相覆盖 */
    storage: {
      save: 'shuangyashan-map-puzzle',
      theme: 'shuangyashan-map-theme',
      sound: 'shuangyashan-map-sound',
      intro: 'shuangyashan-map-intro-seen',
      saveVersion: 2,
    },

    themes: { list: ['jade', 'ginkgo', 'shu'], fallback: 'jade' },

    texts: {
      cityName: '双鸭山市',
      districtCount: 8,
      missingDataHint:
        '地图数据没加载出来，请确认 js/maps/china/heilongjiang/shuangyashan.geo.js 存在且没有被浏览器拦截。',
    },
  };

  const PACKAGES = (global.MAP_PACKAGES = global.MAP_PACKAGES || {});
  PACKAGES['shuangyashan'] = CONFIG;
})(window);
