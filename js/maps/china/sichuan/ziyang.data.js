/* =====================================================================
 * 地图包 · 资阳市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/ziyang.data.js
 * 生成：node tools/add-map.js --adcode=512000 --name=ziyang --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（3 个下级行政区 × 4 项）：
 *   1. area      面积（km²，数字；缺失时信息卡显示"—"）
 *   2. landmark  地标
 *   3. tagline   一句话介绍
 *   4. funFact   冷知识
 * 关卡（levels）现在只是"每 8 个一组"的机械切分，
 * 真正好玩的关卡应当按地理/文化逻辑重新分组，并补上 blurb。
 * [area-from-geo] 面积口径：本文件 area 由 tools/area-from-geo.js 从
 * 《ziyang.geo.js》的官方边界几何计算得出（球面多边形面积，与 d3.geoArea 同公式），
 * 与拼图所用边界严格同源、可复现；属"几何计算值"，不等于官方公布的统计口径面积。
 * 重新生成：node tools/area-from-geo.js --only=ziyang --write

 * ===================================================================== */

(function (global) {
  'use strict';

  /** 下级行政区资料，key 是国家行政区划代码（adcode） */
  const DISTRICTS = {
    "512002": {
      area: 1634,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '因城在资水（今沱江）之北而得名“资阳”',
      funFact: '汉武帝建元六年（公元前135年）置县，因城在资水（今沱江）之北，故名“资阳 ”。',
    }, // 雁江区
    "512021": {
      area: 2686,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '安岳石刻·圆觉洞景区、卧佛院摩崖造像、木门寺',
      tagline: '有卧佛院摩崖造像、木门寺等10处全国重点文物保护单位，是“中国石刻之乡”',
      funFact: '安岳石刻·圆觉洞景区成功创建国家AAAA级旅游景区，同时该景区也是全国重点文物保护单位。',
    }, // 安岳县
    "512022": {
      area: 1422,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '蟠龙湖旅游度假区、陈毅故里景区、五彩林乡',
      tagline: '有蟠龙湖旅游度假区、国家AAAA级旅游景区陈毅故里景区和国家AAA级旅游景区五彩林乡等著名景点',
      funFact: '因县东有乐至池而得名',
    }, // 乐至县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#9ed039',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [512002, 512021, 512022],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['ziyang'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
