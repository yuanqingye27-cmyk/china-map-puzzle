/* =====================================================================
 * 地图包 · 达州市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/dazhou.data.js
 * 生成：node tools/add-map.js --adcode=511700 --name=dazhou --parent=sichuan
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
    "511702": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：通川区地标】',
      tagline: '【待补充：通川区一句话介绍】',
      funFact: '【待补充：通川区冷知识】',
    }, // 通川区
    "511703": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：达川区地标】',
      tagline: '【待补充：达川区一句话介绍】',
      funFact: '【待补充：达川区冷知识】',
    }, // 达川区
    "511722": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：宣汉县地标】',
      tagline: '【待补充：宣汉县一句话介绍】',
      funFact: '【待补充：宣汉县冷知识】',
    }, // 宣汉县
    "511723": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：开江县地标】',
      tagline: '【待补充：开江县一句话介绍】',
      funFact: '【待补充：开江县冷知识】',
    }, // 开江县
    "511724": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：大竹县地标】',
      tagline: '【待补充：大竹县一句话介绍】',
      funFact: '【待补充：大竹县冷知识】',
    }, // 大竹县
    "511725": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：渠县地标】',
      tagline: '【待补充：渠县一句话介绍】',
      funFact: '【待补充：渠县冷知识】',
    }, // 渠县
    "511781": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：万源市地标】',
      tagline: '【待补充：万源市一句话介绍】',
      funFact: '【待补充：万源市冷知识】',
    }, // 万源市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#39d06b',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511702, 511703, 511722, 511723, 511724, 511725, 511781],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['dazhou'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
