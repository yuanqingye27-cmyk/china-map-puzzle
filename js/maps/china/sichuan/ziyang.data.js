/* =====================================================================
 * 地图包 · 资阳市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/ziyang.data.js
 * 生成：node tools/add-map.js --adcode=512000 --name=ziyang --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（3 个下级行政区 × 4 项）：
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
    "512002": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：雁江区地标】',
      tagline: '【待补充：雁江区一句话介绍】',
      funFact: '【待补充：雁江区冷知识】',
    }, // 雁江区
    "512021": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：安岳县地标】',
      tagline: '【待补充：安岳县一句话介绍】',
      funFact: '【待补充：安岳县冷知识】',
    }, // 安岳县
    "512022": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：乐至县地标】',
      tagline: '【待补充：乐至县一句话介绍】',
      funFact: '【待补充：乐至县冷知识】',
    }, // 乐至县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#9ed039',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [512002, 512021, 512022],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['ziyang'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
