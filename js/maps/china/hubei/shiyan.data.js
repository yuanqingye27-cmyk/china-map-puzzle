/* =====================================================================
 * 地图包 · shiyan · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/hubei/shiyan.data.js
 * 生成：node tools/add-map.js --adcode=420300 --name=shiyan --parent=hubei
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
 * 《shiyan.geo.js》的官方边界几何计算得出（球面多边形面积，与 d3.geoArea 同公式），
 * 与拼图所用边界严格同源、可复现；属"几何计算值"，不等于官方公布的统计口径面积。
 * 重新生成：node tools/area-from-geo.js --only=shiyan --write

 * ===================================================================== */

(function (global) {
  'use strict';

  /** 下级行政区资料，key 是国家行政区划代码（adcode） */
  const DISTRICTS = {
    "420302": {
      area: 537,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 茅箭区
    "420303": {
      area: 658,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 张湾区
    "420304": {
      area: 3831,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 郧阳区
    "420322": {
      area: 3525,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 郧西县
    "420323": {
      area: 3612,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 竹山县
    "420324": {
      area: 3287,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 竹溪县
    "420325": {
      area: 5126,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 房县
    "420381": {
      area: 3135,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 丹江口市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '市辖区',
      short: '市辖区',
      color: '#39d0d0',
      blurb: '按行政类型自动分组：这个市的城区部分（市辖区）（3 个）。想把相邻的区县编成一关，或凑成"中心城区""沿江城市带"这类主题，直接改这个文件里的 levels。',
      adcodes: [420302, 420303, 420304],
    },
    {
      id: 'l2',
      name: '县',
      short: '县',
      color: '#394dd0',
      blurb: '按行政类型自动分组：下辖的县与自治县（5 个）。想把相邻的区县编成一关，或凑成"中心城区""沿江城市带"这类主题，直接改这个文件里的 levels。',
      adcodes: [420322, 420323, 420324, 420325, 420381],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['shiyan'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
