/* =====================================================================
 * 地图包 · 宜宾市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/yibin.data.js
 * 生成：node tools/add-map.js --adcode=511500 --name=yibin --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（10 个下级行政区 × 4 项）：
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
    "511502": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：翠屏区地标】',
      tagline: '【待补充：翠屏区一句话介绍】',
      funFact: '【待补充：翠屏区冷知识】',
    }, // 翠屏区
    "511503": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：南溪区地标】',
      tagline: '【待补充：南溪区一句话介绍】',
      funFact: '【待补充：南溪区冷知识】',
    }, // 南溪区
    "511504": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：叙州区地标】',
      tagline: '【待补充：叙州区一句话介绍】',
      funFact: '【待补充：叙州区冷知识】',
    }, // 叙州区
    "511523": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：江安县地标】',
      tagline: '【待补充：江安县一句话介绍】',
      funFact: '【待补充：江安县冷知识】',
    }, // 江安县
    "511524": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：长宁县地标】',
      tagline: '【待补充：长宁县一句话介绍】',
      funFact: '【待补充：长宁县冷知识】',
    }, // 长宁县
    "511525": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：高县地标】',
      tagline: '【待补充：高县一句话介绍】',
      funFact: '【待补充：高县冷知识】',
    }, // 高县
    "511526": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：珙县地标】',
      tagline: '【待补充：珙县一句话介绍】',
      funFact: '【待补充：珙县冷知识】',
    }, // 珙县
    "511527": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：筠连县地标】',
      tagline: '【待补充：筠连县一句话介绍】',
      funFact: '【待补充：筠连县冷知识】',
    }, // 筠连县
    "511528": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：兴文县地标】',
      tagline: '【待补充：兴文县一句话介绍】',
      funFact: '【待补充：兴文县冷知识】',
    }, // 兴文县
    "511529": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：屏山县地标】',
      tagline: '【待补充：屏山县一句话介绍】',
      funFact: '【待补充：屏山县冷知识】',
    }, // 屏山县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#d039d0',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511502, 511503, 511504, 511523, 511524, 511525, 511526, 511527],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#d0394d',
      blurb: '【待补充：第二关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511528, 511529],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['yibin'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
