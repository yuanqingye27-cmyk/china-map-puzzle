/* =====================================================================
 * 地图包 · 泸州市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/luzhou.data.js
 * 生成：node tools/add-map.js --adcode=510500 --name=luzhou --parent=sichuan
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
    "510502": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：江阳区地标】',
      tagline: '【待补充：江阳区一句话介绍】',
      funFact: '【待补充：江阳区冷知识】',
    }, // 江阳区
    "510503": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：纳溪区地标】',
      tagline: '【待补充：纳溪区一句话介绍】',
      funFact: '【待补充：纳溪区冷知识】',
    }, // 纳溪区
    "510504": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：龙马潭区地标】',
      tagline: '【待补充：龙马潭区一句话介绍】',
      funFact: '【待补充：龙马潭区冷知识】',
    }, // 龙马潭区
    "510521": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：泸县地标】',
      tagline: '【待补充：泸县一句话介绍】',
      funFact: '【待补充：泸县冷知识】',
    }, // 泸县
    "510522": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：合江县地标】',
      tagline: '【待补充：合江县一句话介绍】',
      funFact: '【待补充：合江县冷知识】',
    }, // 合江县
    "510524": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：叙永县地标】',
      tagline: '【待补充：叙永县一句话介绍】',
      funFact: '【待补充：叙永县冷知识】',
    }, // 叙永县
    "510525": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：古蔺县地标】',
      tagline: '【待补充：古蔺县一句话介绍】',
      funFact: '【待补充：古蔺县冷知识】',
    }, // 古蔺县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#d06b39',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [510502, 510503, 510504, 510521, 510522, 510524, 510525],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['luzhou'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
