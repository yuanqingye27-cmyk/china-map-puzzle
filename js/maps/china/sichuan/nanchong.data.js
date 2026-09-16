/* =====================================================================
 * 地图包 · 南充市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/nanchong.data.js
 * 生成：node tools/add-map.js --adcode=511300 --name=nanchong --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（9 个下级行政区 × 4 项）：
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
    "511302": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：顺庆区地标】',
      tagline: '【待补充：顺庆区一句话介绍】',
      funFact: '【待补充：顺庆区冷知识】',
    }, // 顺庆区
    "511303": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：高坪区地标】',
      tagline: '【待补充：高坪区一句话介绍】',
      funFact: '【待补充：高坪区冷知识】',
    }, // 高坪区
    "511304": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：嘉陵区地标】',
      tagline: '【待补充：嘉陵区一句话介绍】',
      funFact: '【待补充：嘉陵区冷知识】',
    }, // 嘉陵区
    "511321": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：南部县地标】',
      tagline: '【待补充：南部县一句话介绍】',
      funFact: '【待补充：南部县冷知识】',
    }, // 南部县
    "511322": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：营山县地标】',
      tagline: '【待补充：营山县一句话介绍】',
      funFact: '【待补充：营山县冷知识】',
    }, // 营山县
    "511323": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：蓬安县地标】',
      tagline: '【待补充：蓬安县一句话介绍】',
      funFact: '【待补充：蓬安县冷知识】',
    }, // 蓬安县
    "511324": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：仪陇县地标】',
      tagline: '【待补充：仪陇县一句话介绍】',
      funFact: '【待补充：仪陇县冷知识】',
    }, // 仪陇县
    "511325": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：西充县地标】',
      tagline: '【待补充：西充县一句话介绍】',
      funFact: '【待补充：西充县冷知识】',
    }, // 西充县
    "511381": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：阆中市地标】',
      tagline: '【待补充：阆中市一句话介绍】',
      funFact: '【待补充：阆中市冷知识】',
    }, // 阆中市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#6bd039',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511302, 511303, 511304, 511321, 511322, 511323, 511324, 511325],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#39d08a',
      blurb: '【待补充：第二关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511381],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['nanchong'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
