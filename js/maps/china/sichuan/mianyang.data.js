/* =====================================================================
 * 地图包 · 绵阳市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/mianyang.data.js
 * 生成：node tools/add-map.js --adcode=510700 --name=mianyang --parent=sichuan
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
    "510703": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：涪城区地标】',
      tagline: '【待补充：涪城区一句话介绍】',
      funFact: '【待补充：涪城区冷知识】',
    }, // 涪城区
    "510704": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：游仙区地标】',
      tagline: '【待补充：游仙区一句话介绍】',
      funFact: '【待补充：游仙区冷知识】',
    }, // 游仙区
    "510705": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：安州区地标】',
      tagline: '【待补充：安州区一句话介绍】',
      funFact: '【待补充：安州区冷知识】',
    }, // 安州区
    "510722": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：三台县地标】',
      tagline: '【待补充：三台县一句话介绍】',
      funFact: '【待补充：三台县冷知识】',
    }, // 三台县
    "510723": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：盐亭县地标】',
      tagline: '【待补充：盐亭县一句话介绍】',
      funFact: '【待补充：盐亭县冷知识】',
    }, // 盐亭县
    "510725": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：梓潼县地标】',
      tagline: '【待补充：梓潼县一句话介绍】',
      funFact: '【待补充：梓潼县冷知识】',
    }, // 梓潼县
    "510726": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：北川羌族自治县地标】',
      tagline: '【待补充：北川羌族自治县一句话介绍】',
      funFact: '【待补充：北川羌族自治县冷知识】',
    }, // 北川羌族自治县
    "510727": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：平武县地标】',
      tagline: '【待补充：平武县一句话介绍】',
      funFact: '【待补充：平武县冷知识】',
    }, // 平武县
    "510781": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：江油市地标】',
      tagline: '【待补充：江油市一句话介绍】',
      funFact: '【待补充：江油市冷知识】',
    }, // 江油市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#396bd0',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [510703, 510704, 510705, 510722, 510723, 510725, 510726, 510727],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#8a39d0',
      blurb: '【待补充：第二关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [510781],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['mianyang'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
