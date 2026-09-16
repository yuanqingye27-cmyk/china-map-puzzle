/* =====================================================================
 * 测试用虚构城市数据 · tiny-city
 * ---------------------------------------------------------------------
 * ⚠️ 这不是任何一个真实城市，是专门喂给"引擎功能测试"的假数据。
 *    目的：验证引擎在【任意】数据下都能跑通，而不是只对成都有效。
 *
 * 数据规模刻意压到极小：
 *   3 个虚构区县（甲区 / 乙区 / 丙县） + 2 个关卡
 *   甲、乙 是相邻正方形（第一关，2 块）
 *   丙    是 L 形（凹多边形，第二关，1 块）—— 顺带验证凹形状的落点判定
 *
 * 配置里还刻意偏离成都的默认值，用来证明这些东西真的"由外部传入"：
 *   配色：hueByLevel = { one: 285 }，且第二关用【关卡自带 hue: 120】，
 *         饱和度 55 / 明度基数 50 都和引擎默认的 62 / 48 不同
 *   主题：默认主题设成 ginkgo（引擎默认是列表第一项）
 *   存储：key 全部用 tiny-* 前缀，不会碰到成都在用的 chengdu-* 存档
 *   文案：城名"假想城"、区县总数 3
 *
 * 未被覆盖的分支（如实记录）：palette.fallbackHue（关卡既没自带 hue、
 * hueByLevel 里也查不到时才走）—— 要覆盖它得再加一关，这轮先不做。
 * ===================================================================== */

(function (global) {
  'use strict';

  /** 方形环：[西经, 南纬] 起，逆时针一圈（GeoJSON 要求首尾闭合） */
  function square(w, s, e, n) {
    return [[w, s], [e, s], [e, n], [w, n], [w, s]];
  }

  /** L 形环：缺掉东北角那一块，是凹多边形 */
  function lShape(w, s, e, n) {
    const mx = (w + e) / 2;
    const my = (s + n) / 2;
    return [
      [w, s], [e, s], [e, my], [mx, my], [mx, n], [w, n], [w, s],
    ];
  }

  /* adcode 用 9001xx，一眼就能看出是假数据。
     注意这里【故意混用两种 GeoJSON 写法】：
       甲区   = Polygon      （coordinates = [环][点]）
       乙/丙  = MultiPolygon （coordinates = [多边形][环][点]，DataV 导出的成都数据是这种）
     引擎要求两种都能吃下，所以 fixture 就把两种都喂进去。 */
  const TINY_GEO = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { adcode: 900101, name: '甲区' },
        geometry: { type: 'Polygon', coordinates: [square(100.0, 30.0, 100.4, 30.4)] },
      },
      {
        type: 'Feature',
        properties: { adcode: 900102, name: '乙区' },
        geometry: { type: 'MultiPolygon', coordinates: [[square(100.4, 30.0, 100.8, 30.4)]] },
      },
      {
        type: 'Feature',
        properties: { adcode: 900103, name: '丙县' },
        geometry: { type: 'MultiPolygon', coordinates: [[lShape(100.0, 30.4, 100.4, 30.8)]] },
      },
    ],
  };

  const TINY_INFO = {
    900101: {
      area: 100.0,
      landmark: '甲地标',
      tagline: '虚构的甲区，用来跑测试。',
      funFact: '它是引擎测试数据里最南边的一块。',
    },
    900102: {
      area: 101.5,
      landmark: '乙地标',
      tagline: '虚构的乙区，紧挨着甲区东边。',
      funFact: '它和甲区共用一条边界。',
    },
    900103: {
      area: 88,
      landmark: '丙地标',
      tagline: '虚构的丙县，形状是 L 形（凹多边形）。',
      funFact: '它比甲、乙都靠北，用来验证"北在上"。',
    },
  };

  const TINY_LEVELS = [
    {
      id: 'one',
      name: '第一关 · 甲乙两区',
      short: '甲乙',
      blurb: '最小的关卡：两块虚构区域，用来验证放置与解锁。',
      adcodes: [900101, 900102],
      // 没有 hue 字段 → 色相从 palette.hueByLevel.one 取
    },
    {
      id: 'two',
      name: '第二关 · 丙县',
      short: '丙县',
      blurb: '单块关卡，用来验证"最后一关"的通关流程。',
      adcodes: [900103],
      hue: 120,   // 关卡自带色相：优先级高于 hueByLevel
    },
  ];

  global.TINY_CITY_CONFIG = {
    id: 'tiny',
    name: '假想城',

    geo: TINY_GEO,
    districts: TINY_INFO,
    levels: TINY_LEVELS,

    map: { width: 800, padding: 20 },

    piece: { max: 50, minSide: 12, pieces: [[400, 30], [700, 40], [1200, 50]] },

    palette: {
      hueByLevel: { one: 285 },   // 第二关不在这里，它自带 hue
      fallbackHue: 200,
      saturation: 55,             // ≠ 引擎默认 62
      lightBase: 50,              // ≠ 引擎默认 48
      lightStep: 5,
      lightSpan: 10,
      hueSpread: 20,
    },

    storage: {
      save: 'tiny-map-puzzle',
      theme: 'tiny-map-theme',
      sound: 'tiny-map-sound',
      intro: 'tiny-map-intro-seen',
      saveVersion: 2,
    },

    themes: { list: ['jade', 'ginkgo'], fallback: 'ginkgo' },

    texts: { cityName: '假想城', districtCount: 3, missingDataHint: '（测试）数据没加载出来。' },
  };
})(window);
