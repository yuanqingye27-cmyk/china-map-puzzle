/* =====================================================================
 * 地图包 · 阿坝藏族羌族自治州 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/aba.data.js
 * 生成：node tools/add-map.js --adcode=513200 --name=aba --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（13 个下级行政区 × 4 项）：
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
    "513201": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：马尔康市地标】',
      tagline: '【待补充：马尔康市一句话介绍】',
      funFact: '【待补充：马尔康市冷知识】',
    }, // 马尔康市
    "513221": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：汶川县地标】',
      tagline: '【待补充：汶川县一句话介绍】',
      funFact: '【待补充：汶川县冷知识】',
    }, // 汶川县
    "513222": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：理县地标】',
      tagline: '【待补充：理县一句话介绍】',
      funFact: '【待补充：理县冷知识】',
    }, // 理县
    "513223": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：茂县地标】',
      tagline: '【待补充：茂县一句话介绍】',
      funFact: '【待补充：茂县冷知识】',
    }, // 茂县
    "513224": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：松潘县地标】',
      tagline: '【待补充：松潘县一句话介绍】',
      funFact: '【待补充：松潘县冷知识】',
    }, // 松潘县
    "513225": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：九寨沟县地标】',
      tagline: '【待补充：九寨沟县一句话介绍】',
      funFact: '【待补充：九寨沟县冷知识】',
    }, // 九寨沟县
    "513226": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：金川县地标】',
      tagline: '【待补充：金川县一句话介绍】',
      funFact: '【待补充：金川县冷知识】',
    }, // 金川县
    "513227": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：小金县地标】',
      tagline: '【待补充：小金县一句话介绍】',
      funFact: '【待补充：小金县冷知识】',
    }, // 小金县
    "513228": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：黑水县地标】',
      tagline: '【待补充：黑水县一句话介绍】',
      funFact: '【待补充：黑水县冷知识】',
    }, // 黑水县
    "513230": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：壤塘县地标】',
      tagline: '【待补充：壤塘县一句话介绍】',
      funFact: '【待补充：壤塘县冷知识】',
    }, // 壤塘县
    "513231": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：阿坝县地标】',
      tagline: '【待补充：阿坝县一句话介绍】',
      funFact: '【待补充：阿坝县冷知识】',
    }, // 阿坝县
    "513232": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：若尔盖县地标】',
      tagline: '【待补充：若尔盖县一句话介绍】',
      funFact: '【待补充：若尔盖县冷知识】',
    }, // 若尔盖县
    "513233": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：红原县地标】',
      tagline: '【待补充：红原县一句话介绍】',
      funFact: '【待补充：红原县冷知识】',
    }, // 红原县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#399ed0',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [513201, 513221, 513222, 513223, 513224, 513225, 513226, 513227],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#5739d0',
      blurb: '【待补充：第二关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [513228, 513230, 513231, 513232, 513233],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['aba'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
