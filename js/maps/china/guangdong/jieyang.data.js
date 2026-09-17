/* =====================================================================
 * 地图包 · jieyang · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/guangdong/jieyang.data.js
 * 生成：node tools/add-map.js --adcode=445200 --name=jieyang --parent=guangdong
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（5 个下级行政区 × 4 项）：
 *   1. area      面积（km²，数字；缺失时信息卡显示"—"）
 *   2. landmark  地标
 *   3. tagline   一句话介绍
 *   4. funFact   冷知识
 * 关卡（levels）现在只是"每 8 个一组"的机械切分，
 * 真正好玩的关卡应当按地理/文化逻辑重新分组，并补上 blurb。
 * [area-from-geo] 面积口径：本文件 area 由 tools/area-from-geo.js 从
 * 《jieyang.geo.js》的官方边界几何计算得出（球面多边形面积，与 d3.geoArea 同公式），
 * 与拼图所用边界严格同源、可复现；属"几何计算值"，不等于官方公布的统计口径面积。
 * 重新生成：node tools/area-from-geo.js --only=jieyang --write

 * ===================================================================== */

(function (global) {
  'use strict';

  /** 下级行政区资料，key 是国家行政区划代码（adcode） */
  const DISTRICTS = {
    "445202": {
      area: 339,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 榕城区
    "445203": {
      area: 710,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 揭东区
    "445222": {
      area: 1351,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 揭西县
    "445224": {
      area: 1252,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 惠来县
    "445281": {
      area: 1625,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 普宁市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '市辖区',
      short: '市辖区',
      color: '#3939d0',
      blurb: '按行政类型自动分组：这个市的城区部分（市辖区）（3 个）。想把相邻的区县编成一关，或凑成"中心城区""沿江城市带"这类主题，直接改这个文件里的 levels。',
      adcodes: [445202, 445203, 445281],
    },
    {
      id: 'l2',
      name: '县',
      short: '县',
      color: '#bc39d0',
      blurb: '按行政类型自动分组：下辖的县与自治县（2 个）。想把相邻的区县编成一关，或凑成"中心城区""沿江城市带"这类主题，直接改这个文件里的 levels。',
      adcodes: [445222, 445224],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['jieyang'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
