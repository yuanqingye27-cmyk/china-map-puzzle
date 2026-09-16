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
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 市中区
    "511111": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 沙湾区
    "511112": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 五通桥区
    "511113": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 金口河区
    "511123": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 犍为县
    "511124": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 井研县
    "511126": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 夹江县
    "511129": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 沐川县
    "511132": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 峨边彝族自治县
    "511133": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 马边彝族自治县
    "511181": {
      area: null,                    // TODO 面积（km²，数字）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 峨眉山市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#6b39d0',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [511102, 511111, 511112, 511113, 511123, 511124, 511126, 511129],
    },
    {
      id: 'l2',
      name: '第二关',
      short: '第二关',
      color: '#d039b2',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [511132, 511133, 511181],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['leshan'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
