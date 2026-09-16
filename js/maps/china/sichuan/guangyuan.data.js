/* =====================================================================
 * 地图包 · 广元市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/guangyuan.data.js
 * 生成：node tools/add-map.js --adcode=510800 --name=guangyuan --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（7 个下级行政区 × 4 项）：
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
    "510802": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：利州区地标】',
      tagline: '【待补充：利州区一句话介绍】',
      funFact: '【待补充：利州区冷知识】',
    }, // 利州区
    "510811": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：昭化区地标】',
      tagline: '【待补充：昭化区一句话介绍】',
      funFact: '【待补充：昭化区冷知识】',
    }, // 昭化区
    "510812": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：朝天区地标】',
      tagline: '【待补充：朝天区一句话介绍】',
      funFact: '【待补充：朝天区冷知识】',
    }, // 朝天区
    "510821": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：旺苍县地标】',
      tagline: '【待补充：旺苍县一句话介绍】',
      funFact: '【待补充：旺苍县冷知识】',
    }, // 旺苍县
    "510822": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：青川县地标】',
      tagline: '【待补充：青川县一句话介绍】',
      funFact: '【待补充：青川县冷知识】',
    }, // 青川县
    "510823": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：剑阁县地标】',
      tagline: '【待补充：剑阁县一句话介绍】',
      funFact: '【待补充：剑阁县冷知识】',
    }, // 剑阁县
    "510824": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：苍溪县地标】',
      tagline: '【待补充：苍溪县一句话介绍】',
      funFact: '【待补充：苍溪县冷知识】',
    }, // 苍溪县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#d0399e',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [510802, 510811, 510812, 510821, 510822, 510823, 510824],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['guangyuan'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
