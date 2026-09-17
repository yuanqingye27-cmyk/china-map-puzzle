/* =====================================================================
 * 地图包 · yanbian · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/jilin/yanbian.data.js
 * 生成：node tools/add-map.js --adcode=222400 --name=yanbian --parent=jilin
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（8 个下级行政区 × 4 项）：
 *   1. area      面积（km²，数字；缺失时信息卡显示"—"）
 *   2. landmark  地标
 *   3. tagline   一句话介绍
 *   4. funFact   冷知识
 * 关卡（levels）现在只是"每 8 个一组"的机械切分，
 * 真正好玩的关卡应当按地理/文化逻辑重新分组，并补上 blurb。
 * [area-from-geo] 面积口径：本文件 area 由 tools/area-from-geo.js 从
 * 《yanbian.geo.js》的官方边界几何计算得出（球面多边形面积，与 d3.geoArea 同公式），
 * 与拼图所用边界严格同源、可复现；属"几何计算值"，不等于官方公布的统计口径面积。
 * 重新生成：node tools/area-from-geo.js --only=yanbian --write

 * ===================================================================== */

(function (global) {
  'use strict';

  /** 下级行政区资料，key 是国家行政区划代码（adcode） */
  const DISTRICTS = {
    "222401": {
      area: 1704,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 延吉市
    "222402": {
      area: 1132,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 图们市
    "222403": {
      area: 11748,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 敦化市
    "222404": {
      area: 5187,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 珲春市
    "222405": {
      area: 2212,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 龙井市
    "222406": {
      area: 5042,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 和龙市
    "222424": {
      area: 8801,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 汪清县
    "222426": {
      area: 7427,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 安图县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '县级市',
      short: '县级市',
      color: '#9e39d0',
      blurb: '按行政类型自动分组：代管的县级市（6 个）。想把相邻的区县编成一关，或凑成"中心城区""沿江城市带"这类主题，直接改这个文件里的 levels。',
      adcodes: [222401, 222402, 222403, 222404, 222405, 222406],
    },
    {
      id: 'l2',
      name: '县',
      short: '县',
      color: '#d03980',
      blurb: '按行政类型自动分组：下辖的县与自治县（2 个）。想把相邻的区县编成一关，或凑成"中心城区""沿江城市带"这类主题，直接改这个文件里的 levels。',
      adcodes: [222424, 222426],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['yanbian'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
