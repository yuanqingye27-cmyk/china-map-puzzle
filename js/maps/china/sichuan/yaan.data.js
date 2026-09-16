/* =====================================================================
 * 地图包 · 雅安市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/yaan.data.js
 * 生成：node tools/add-map.js --adcode=511800 --name=yaan --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（8 个下级行政区 × 4 项）：
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
    "511802": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：雨城区地标】',
      tagline: '【待补充：雨城区一句话介绍】',
      funFact: '【待补充：雨城区冷知识】',
    }, // 雨城区
    "511803": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：名山区地标】',
      tagline: '【待补充：名山区一句话介绍】',
      funFact: '【待补充：名山区冷知识】',
    }, // 名山区
    "511822": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：荥经县地标】',
      tagline: '【待补充：荥经县一句话介绍】',
      funFact: '【待补充：荥经县冷知识】',
    }, // 荥经县
    "511823": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：汉源县地标】',
      tagline: '【待补充：汉源县一句话介绍】',
      funFact: '【待补充：汉源县冷知识】',
    }, // 汉源县
    "511824": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：石棉县地标】',
      tagline: '【待补充：石棉县一句话介绍】',
      funFact: '【待补充：石棉县冷知识】',
    }, // 石棉县
    "511825": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：天全县地标】',
      tagline: '【待补充：天全县一句话介绍】',
      funFact: '【待补充：天全县冷知识】',
    }, // 天全县
    "511826": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：芦山县地标】',
      tagline: '【待补充：芦山县一句话介绍】',
      funFact: '【待补充：芦山县冷知识】',
    }, // 芦山县
    "511827": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：宝兴县地标】',
      tagline: '【待补充：宝兴县一句话介绍】',
      funFact: '【待补充：宝兴县冷知识】',
    }, // 宝兴县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#3939d0',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [511802, 511803, 511822, 511823, 511824, 511825, 511826, 511827],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['yaan'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
