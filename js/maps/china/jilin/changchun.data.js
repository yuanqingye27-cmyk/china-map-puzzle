/* =====================================================================
 * 地图包 · changchun · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/jilin/changchun.data.js
 * 生成：node tools/add-map.js --adcode=220100 --name=changchun --parent=jilin
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
 * 《changchun.geo.js》的官方边界几何计算得出（球面多边形面积，与 d3.geoArea 同公式），
 * 与拼图所用边界严格同源、可复现；属"几何计算值"，不等于官方公布的统计口径面积。
 * 重新生成：node tools/area-from-geo.js --only=changchun --write

 * ===================================================================== */

(function (global) {
  'use strict';

  /** 下级行政区资料，key 是国家行政区划代码（adcode） */
  const DISTRICTS = {
    "220102": {
      area: 531,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 南关区
    "220103": {
      area: 923,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 宽城区
    "220104": {
      area: 327,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 朝阳区
    "220105": {
      area: 505,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 二道区
    "220106": {
      area: 284,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 绿园区
    "220112": {
      area: 1676,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 双阳区
    "220113": {
      area: 3368,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 九台区
    "220122": {
      area: 5225,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 农安县
    "220182": {
      area: 4658,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 榆树市
    "220183": {
      area: 3011,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 德惠市
    "220184": {
      area: 4136,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 公主岭市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#39d06b',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [220102, 220103, 220104, 220105, 220106, 220112, 220113, 220122],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#39b2d0',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [220182, 220183, 220184],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['changchun'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
