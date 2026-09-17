/* =====================================================================
 * 地图包 · 成都（配置）
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/chengdu.js
 *
 * 【层级】中国 → 四川 → 成都
 *   parent    'sichuan'   上一级地图包 id（"返回上一级"按钮靠它找路）
 *   adcode    510100      本级行政区划代码
 *   children  []          下一级地图包 id 列表
 *                         （成都下辖的是区县，不是独立地图包，所以为空）
 *
 * 【分工】一个地图包三个文件，按"谁来维护"拆开：
 *   chengdu.geo.js   构建产物（自动生成，勿手改）
 *   chengdu.data.js  人工资料与关卡
 *   chengdu.js       本文件：把上面两份 + 配色/存储/文案组装成引擎配置
 *
 * 引擎只认一个纯数据对象（MapPuzzleEngine.create(CONFIG)），
 * 这里把它登记到 window.MAP_PACKAGES.chengdu，
 * 启动器和地图选择器都从这里取。
 *
 * ⚠️ 加载顺序：registry.js → chengdu.geo.js → chengdu.data.js → 本文件
 *    → geomap.js → engine.js → game.js
 *    （三个包文件都做了防御性初始化，实际对顺序不敏感，但别排在 engine/game 之后）
 * ===================================================================== */

(function (global) {
  'use strict';

  // 防御性初始化：即使 registry.js 没先加载，这里也不会炸
  const GEO_ALL = (global.MAP_GEO = global.MAP_GEO || {});
  const DATA_ALL = (global.MAP_DATA = global.MAP_DATA || {});

  const DATA = DATA_ALL.chengdu || {};

  const CONFIG = {
    /* ---------------- 身份与层级 ---------------- */
    id: 'chengdu',
    name: '成都市',
    parent: 'sichuan',   // 上一级地图包 id，null 表示已是根
    adcode: 510100,      // 本级行政区划代码
    children: [],        // 下一级地图包 id（成都下面是区县，没有子地图包）

    /* ---------------- 数据（引擎的三份输入） ----------------
     * geo        GeoJSON FeatureCollection，每个 feature 需要
     *            properties.adcode / properties.name
     * districts  adcode -> 资料卡（面积 / 地标 / 一句话 / 冷知识）
     * levels     关卡设定：id / name / short / blurb / adcodes
     * -------------------------------------------------------- */
    geo: GEO_ALL.chengdu,
    districts: DATA.districts,
    levels: DATA.levels,

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
     * 每个地图包用独立的 key，否则两个地图的存档会互相覆盖
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
     * 只放"会因地图而变"的部分；交互提示语这类通用文案写在引擎里，
     * 引擎用这里的值去拼。
     * -------------------------------------- */
    texts: {
      cityName: '成都市',
      districtCount: 20,   // 全部区县数，通关文案里用
      // 数据结构缺失时的应急提示（直接写进 <body>）
      missingDataHint:
        '地图数据没加载出来，请确认 js/maps/china/sichuan/ 下的 ' +
        'chengdu.geo.js、chengdu.data.js 存在且没有被浏览器拦截。',
    },
  };

  /* 登记到共享命名空间：地图选择器、启动器、构建脚本都从这里取 */
  const PACKAGES = (global.MAP_PACKAGES = global.MAP_PACKAGES || {});
  PACKAGES.chengdu = CONFIG;
})(window);
