/* =====================================================================
 * 地图包 · 中国 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china.data.js
 * 生成：node tools/add-map.js --adcode=100000 --name=china
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（34 个下级行政区 × 4 项）：
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
    "110000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 北京市
    "120000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 天津市
    "130000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 河北省
    "140000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 山西省
    "150000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 内蒙古自治区
    "210000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 辽宁省
    "220000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 吉林省
    "230000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 黑龙江省
    "310000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 上海市
    "320000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 江苏省
    "330000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 浙江省
    "340000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 安徽省
    "350000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 福建省
    "360000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 江西省
    "370000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 山东省
    "410000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 河南省
    "420000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 湖北省
    "430000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 湖南省
    "440000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 广东省
    "450000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 广西壮族自治区
    "460000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 海南省
    "500000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 重庆市
    "510000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 四川省
    "520000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 贵州省
    "530000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 云南省
    "540000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 西藏自治区
    "610000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 陕西省
    "620000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 甘肃省
    "630000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 青海省
    "640000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 宁夏回族自治区
    "650000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 新疆维吾尔自治区
    "710000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 台湾省
    "810000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 香港特别行政区
    "820000": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '（待补充）',
      tagline: '（待补充）',
      funFact: '（待补充）',
    }, // 澳门特别行政区
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#9e39d0',
      blurb: '（待补充：说明这一关的分组依据，比如"中心城区"或"沿江城市带"）',
      adcodes: [110000, 120000, 130000, 140000, 150000, 210000, 220000, 230000],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#d03980',
      blurb: '（待补充：说明这一关的分组依据，比如"中心城区"或"沿江城市带"）',
      adcodes: [310000, 320000, 330000, 340000, 350000, 360000, 370000, 410000],
    },
    {
      id: 'l3',
      name: '第三关',
      short: '第三关',
      color: '#d07539',
      blurb: '（待补充：说明这一关的分组依据，比如"中心城区"或"沿江城市带"）',
      adcodes: [420000, 430000, 440000, 450000, 460000, 500000, 510000, 520000],
    },
    {
      id: 'l4',
      name: '第四关',
      short: '第四关',
      color: '#a8d039',
      blurb: '（待补充：说明这一关的分组依据，比如"中心城区"或"沿江城市带"）',
      adcodes: [530000, 540000, 610000, 620000, 630000, 640000, 650000, 710000],
    },
    {
      id: 'l5',
      name: '第五关',
      short: '第五关',
      color: '#39d04d',
      blurb: '（待补充：说明这一关的分组依据，比如"中心城区"或"沿江城市带"）',
      adcodes: [810000, 820000],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['china'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
