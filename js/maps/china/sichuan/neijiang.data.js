/* =====================================================================
 * 地图包 · 内江市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/neijiang.data.js
 * 生成：node tools/add-map.js --adcode=511000 --name=neijiang --parent=sichuan
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
 * ===================================================================== */

(function (global) {
  'use strict';

  /** 下级行政区资料，key 是国家行政区划代码（adcode） */
  const DISTRICTS = {
    "511002": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：市中区地标】',
      tagline: '【待补充：市中区一句话介绍】',
      funFact: '【待补充：市中区冷知识】',
    }, // 市中区
    "511011": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：东兴区地标】',
      tagline: '【待补充：东兴区一句话介绍】',
      funFact: '【待补充：东兴区冷知识】',
    }, // 东兴区
    "511024": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：威远县地标】',
      tagline: '【待补充：威远县一句话介绍】',
      funFact: '【待补充：威远县冷知识】',
    }, // 威远县
    "511025": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：资中县地标】',
      tagline: '【待补充：资中县一句话介绍】',
      funFact: '【待补充：资中县冷知识】',
    }, // 资中县
    "511083": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：隆昌市地标】',
      tagline: '【待补充：隆昌市一句话介绍】',
      funFact: '【待补充：隆昌市冷知识】',
    }, // 隆昌市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#39d09e',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511002, 511011, 511024, 511025, 511083],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['neijiang'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
