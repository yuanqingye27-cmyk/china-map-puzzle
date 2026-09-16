/* =====================================================================
 * 地图包 · 广安市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/guangan.data.js
 * 生成：node tools/add-map.js --adcode=511600 --name=guangan --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（6 个下级行政区 × 4 项）：
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
    "511602": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：广安区地标】',
      tagline: '【待补充：广安区一句话介绍】',
      funFact: '【待补充：广安区冷知识】',
    }, // 广安区
    "511603": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：前锋区地标】',
      tagline: '【待补充：前锋区一句话介绍】',
      funFact: '【待补充：前锋区冷知识】',
    }, // 前锋区
    "511621": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：岳池县地标】',
      tagline: '【待补充：岳池县一句话介绍】',
      funFact: '【待补充：岳池县冷知识】',
    }, // 岳池县
    "511622": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：武胜县地标】',
      tagline: '【待补充：武胜县一句话介绍】',
      funFact: '【待补充：武胜县冷知识】',
    }, // 武胜县
    "511623": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：邻水县地标】',
      tagline: '【待补充：邻水县一句话介绍】',
      funFact: '【待补充：邻水县冷知识】',
    }, // 邻水县
    "511681": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：华蓥市地标】',
      tagline: '【待补充：华蓥市一句话介绍】',
      funFact: '【待补充：华蓥市冷知识】',
    }, // 华蓥市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#d09e39',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511602, 511603, 511621, 511622, 511623, 511681],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['guangan'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
