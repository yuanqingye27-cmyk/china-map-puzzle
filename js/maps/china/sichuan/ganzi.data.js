/* =====================================================================
 * 地图包 · 甘孜藏族自治州 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/ganzi.data.js
 * 生成：node tools/add-map.js --adcode=513300 --name=ganzi --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（18 个下级行政区 × 4 项）：
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
    "513301": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：康定市地标】',
      tagline: '【待补充：康定市一句话介绍】',
      funFact: '【待补充：康定市冷知识】',
    }, // 康定市
    "513322": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：泸定县地标】',
      tagline: '【待补充：泸定县一句话介绍】',
      funFact: '【待补充：泸定县冷知识】',
    }, // 泸定县
    "513323": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：丹巴县地标】',
      tagline: '【待补充：丹巴县一句话介绍】',
      funFact: '【待补充：丹巴县冷知识】',
    }, // 丹巴县
    "513324": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：九龙县地标】',
      tagline: '【待补充：九龙县一句话介绍】',
      funFact: '【待补充：九龙县冷知识】',
    }, // 九龙县
    "513325": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：雅江县地标】',
      tagline: '【待补充：雅江县一句话介绍】',
      funFact: '【待补充：雅江县冷知识】',
    }, // 雅江县
    "513326": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：道孚县地标】',
      tagline: '【待补充：道孚县一句话介绍】',
      funFact: '【待补充：道孚县冷知识】',
    }, // 道孚县
    "513327": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：炉霍县地标】',
      tagline: '【待补充：炉霍县一句话介绍】',
      funFact: '【待补充：炉霍县冷知识】',
    }, // 炉霍县
    "513328": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：甘孜县地标】',
      tagline: '【待补充：甘孜县一句话介绍】',
      funFact: '【待补充：甘孜县冷知识】',
    }, // 甘孜县
    "513329": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：新龙县地标】',
      tagline: '【待补充：新龙县一句话介绍】',
      funFact: '【待补充：新龙县冷知识】',
    }, // 新龙县
    "513330": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：德格县地标】',
      tagline: '【待补充：德格县一句话介绍】',
      funFact: '【待补充：德格县冷知识】',
    }, // 德格县
    "513331": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：白玉县地标】',
      tagline: '【待补充：白玉县一句话介绍】',
      funFact: '【待补充：白玉县冷知识】',
    }, // 白玉县
    "513332": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：石渠县地标】',
      tagline: '【待补充：石渠县一句话介绍】',
      funFact: '【待补充：石渠县冷知识】',
    }, // 石渠县
    "513333": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：色达县地标】',
      tagline: '【待补充：色达县一句话介绍】',
      funFact: '【待补充：色达县冷知识】',
    }, // 色达县
    "513334": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：理塘县地标】',
      tagline: '【待补充：理塘县一句话介绍】',
      funFact: '【待补充：理塘县冷知识】',
    }, // 理塘县
    "513335": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：巴塘县地标】',
      tagline: '【待补充：巴塘县一句话介绍】',
      funFact: '【待补充：巴塘县冷知识】',
    }, // 巴塘县
    "513336": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：乡城县地标】',
      tagline: '【待补充：乡城县一句话介绍】',
      funFact: '【待补充：乡城县冷知识】',
    }, // 乡城县
    "513337": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：稻城县地标】',
      tagline: '【待补充：稻城县一句话介绍】',
      funFact: '【待补充：稻城县冷知识】',
    }, // 稻城县
    "513338": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：得荣县地标】',
      tagline: '【待补充：得荣县一句话介绍】',
      funFact: '【待补充：得荣县冷知识】',
    }, // 得荣县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#d039d0',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [513301, 513322, 513323, 513324, 513325, 513326, 513327, 513328],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#d0394d',
      blurb: '【待补充：第二关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [513329, 513330, 513331, 513332, 513333, 513334, 513335, 513336],
    },
    {
      id: 'l3',
      name: '第三关',
      short: '第三关',
      color: '#d0a839',
      blurb: '【待补充：第三关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [513337, 513338],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['ganzi'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
