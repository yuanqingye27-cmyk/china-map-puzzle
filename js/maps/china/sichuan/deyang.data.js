/* =====================================================================
 * 地图包 · 德阳市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/deyang.data.js
 * 生成：node tools/add-map.js --adcode=510600 --name=deyang --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（6 个下级行政区 × 4 项）：
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
    "510603": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：旌阳区地标】',
      tagline: '【待补充：旌阳区一句话介绍】',
      funFact: '【待补充：旌阳区冷知识】',
    }, // 旌阳区
    "510604": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：罗江区地标】',
      tagline: '【待补充：罗江区一句话介绍】',
      funFact: '【待补充：罗江区冷知识】',
    }, // 罗江区
    "510623": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：中江县地标】',
      tagline: '【待补充：中江县一句话介绍】',
      funFact: '【待补充：中江县冷知识】',
    }, // 中江县
    "510681": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：广汉市地标】',
      tagline: '【待补充：广汉市一句话介绍】',
      funFact: '【待补充：广汉市冷知识】',
    }, // 广汉市
    "510682": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：什邡市地标】',
      tagline: '【待补充：什邡市一句话介绍】',
      funFact: '【待补充：什邡市冷知识】',
    }, // 什邡市
    "510683": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '【待补充：绵竹市地标】',
      tagline: '【待补充：绵竹市一句话介绍】',
      funFact: '【待补充：绵竹市冷知识】',
    }, // 绵竹市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#39d039',
      blurb: '【待补充：第一关的分组依据，例如"中心城区"或"沿江城市带"】',
      adcodes: [510603, 510604, 510623, 510681, 510682, 510683],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['deyang'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
