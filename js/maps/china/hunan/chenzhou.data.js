/* =====================================================================
 * 地图包 · chenzhou · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/hunan/chenzhou.data.js
 * 生成：node tools/add-map.js --adcode=431000 --name=chenzhou --parent=hunan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（11 个下级行政区 × 4 项）：
 *   1. area      面积（km²，数字；缺失时信息卡显示"—"）
 *   2. landmark  地标
 *   3. tagline   一句话介绍
 *   4. funFact   冷知识
 * 关卡（levels）现在只是"每 8 个一组"的机械切分，
 * 真正好玩的关卡应当按地理/文化逻辑重新分组，并补上 blurb。
 * [area-from-geo] 面积口径：本文件 area 由 tools/area-from-geo.js 从
 * 《chenzhou.geo.js》的官方边界几何计算得出（球面多边形面积，与 d3.geoArea 同公式），
 * 与拼图所用边界严格同源、可复现；属"几何计算值"，不等于官方公布的统计口径面积。
 * 重新生成：node tools/area-from-geo.js --only=chenzhou --write

 * ===================================================================== */

(function (global) {
  'use strict';

  /** 下级行政区资料，key 是国家行政区划代码（adcode） */
  const DISTRICTS = {
    "431002": {
      area: 817,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 北湖区
    "431003": {
      area: 1344,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 苏仙区
    "431021": {
      area: 2964,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 桂阳县
    "431022": {
      area: 2150,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 宜章县
    "431023": {
      area: 1989,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 永兴县
    "431024": {
      area: 701,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 嘉禾县
    "431025": {
      area: 1403,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 临武县
    "431026": {
      area: 2434,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 汝城县
    "431027": {
      area: 1448,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 桂东县
    "431028": {
      area: 1462,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 安仁县
    "431081": {
      area: 2733,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 资兴市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '市辖区',
      short: '市辖区',
      color: '#9ed039',
      blurb: '按行政类型自动分组：这个市的城区部分（市辖区）（2 个）。想把相邻的区县编成一关，或凑成"中心城区""沿江城市带"这类主题，直接改这个文件里的 levels。',
      adcodes: [431002, 431003],
    },
    {
      id: 'l2',
      name: '县',
      short: '县',
      color: '#39d057',
      blurb: '按行政类型自动分组：下辖的县与自治县（9 个）。想把相邻的区县编成一关，或凑成"中心城区""沿江城市带"这类主题，直接改这个文件里的 levels。',
      adcodes: [431021, 431022, 431023, 431024, 431025, 431026, 431027, 431028, 431081],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['chenzhou'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
