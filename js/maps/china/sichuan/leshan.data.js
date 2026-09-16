/* =====================================================================
 * 地图包 · 乐山市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/leshan.data.js
 * 生成：node tools/add-map.js --adcode=511100 --name=leshan --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（11 个下级行政区 × 4 项）：
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
    "511102": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：市中区地标】',
      tagline: '【待补充：市中区一句话介绍】',
      funFact: '【待补充：市中区冷知识】',
    }, // 市中区
    "511111": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：沙湾区地标】',
      tagline: '【待补充：沙湾区一句话介绍】',
      funFact: '【待补充：沙湾区冷知识】',
    }, // 沙湾区
    "511112": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：五通桥区地标】',
      tagline: '【待补充：五通桥区一句话介绍】',
      funFact: '【待补充：五通桥区冷知识】',
    }, // 五通桥区
    "511113": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：金口河区地标】',
      tagline: '【待补充：金口河区一句话介绍】',
      funFact: '【待补充：金口河区冷知识】',
    }, // 金口河区
    "511123": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：犍为县地标】',
      tagline: '【待补充：犍为县一句话介绍】',
      funFact: '【待补充：犍为县冷知识】',
    }, // 犍为县
    "511124": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：井研县地标】',
      tagline: '【待补充：井研县一句话介绍】',
      funFact: '【待补充：井研县冷知识】',
    }, // 井研县
    "511126": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：夹江县地标】',
      tagline: '【待补充：夹江县一句话介绍】',
      funFact: '【待补充：夹江县冷知识】',
    }, // 夹江县
    "511129": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：沐川县地标】',
      tagline: '【待补充：沐川县一句话介绍】',
      funFact: '【待补充：沐川县冷知识】',
    }, // 沐川县
    "511132": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：峨边彝族自治县地标】',
      tagline: '【待补充：峨边彝族自治县一句话介绍】',
      funFact: '【待补充：峨边彝族自治县冷知识】',
    }, // 峨边彝族自治县
    "511133": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：马边彝族自治县地标】',
      tagline: '【待补充：马边彝族自治县一句话介绍】',
      funFact: '【待补充：马边彝族自治县冷知识】',
    }, // 马边彝族自治县
    "511181": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：峨眉山市地标】',
      tagline: '【待补充：峨眉山市一句话介绍】',
      funFact: '【待补充：峨眉山市冷知识】',
    }, // 峨眉山市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#6b39d0',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511102, 511111, 511112, 511113, 511123, 511124, 511126, 511129],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#d039b2',
      blurb: '【待补充：第二关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511132, 511133, 511181],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['leshan'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
