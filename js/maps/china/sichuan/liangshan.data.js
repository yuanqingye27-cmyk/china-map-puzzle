/* =====================================================================
 * 地图包 · liangshan · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/liangshan.data.js
 * 生成：node tools/add-map.js --adcode=513400 --name=liangshan --parent=sichuan --source=file
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（17 个下级行政区 × 4 项）：
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
    "513401": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 西昌市
    "513402": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 会理市
    "513422": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 木里藏族自治县
    "513423": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 盐源县
    "513424": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 德昌县
    "513426": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 会东县
    "513427": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 宁南县
    "513428": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 普格县
    "513429": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 布拖县
    "513430": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 金阳县
    "513431": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 昭觉县
    "513432": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 喜德县
    "513433": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 冕宁县
    "513434": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 越西县
    "513435": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 甘洛县
    "513436": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 美姑县
    "513437": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 雷波县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#d09e39',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [513401, 513402, 513422, 513423, 513424, 513426, 513427, 513428],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#80d039',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [513429, 513430, 513431, 513432, 513433, 513434, 513435, 513436],
    },
    {
      id: 'l3',
      name: '第三关',
      short: '第三关',
      color: '#39d075',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [513437],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['liangshan'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
