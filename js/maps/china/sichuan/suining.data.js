/* =====================================================================
 * 地图包 · 遂宁市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/suining.data.js
 * 生成：node tools/add-map.js --adcode=510900 --name=suining --parent=sichuan
 *
 * ⚠️ 这是脚本生成的占位内容，自动化流程**不会**再覆盖本文件：
 *    重新跑 add-map.js 只会刷新 .geo.js，你在这里写的文字是安全的。
 *
 * 待补清单（5 个下级行政区 × 4 项）：
 *   1. area      面积（km²，数字；缺失时信息卡显示"—"）
 *   2. landmark  地标
 *   3. tagline   一句话介绍
 *   4. funFact   冷知识
 * 关卡（levels）现在只是"每 8 个一组"的机械切分，
 * 真正好玩的关卡应当按地理/文化逻辑重新分组，并补上 blurb。
 * [area-from-geo] 面积口径：本文件 area 由 tools/area-from-geo.js 从
 * 《suining.geo.js》的官方边界几何计算得出（球面多边形面积，与 d3.geoArea 同公式），
 * 与拼图所用边界严格同源、可复现；属"几何计算值"，不等于官方公布的统计口径面积。
 * 重新生成：node tools/area-from-geo.js --only=suining --write

 * ===================================================================== */

(function (global) {
  'use strict';

  /** 下级行政区资料，key 是国家行政区划代码（adcode） */
  const DISTRICTS = {
    "510903": {
      area: 612,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 船山区
    "510904": {
      area: 1261,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '安居县名始于隋开皇十三年（593年），由柔刚县改名而来。',
    }, // 安居区
    "510921": {
      area: 1254,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '鹫峰寺塔、宝梵寺',
      tagline: '境内有国家AAAA级旅游景区高峰山景区和国家AA级旅游景区继勋公园。',
      funFact: '蓬溪县名始于唐天宝元年（742年），由唐兴县改名而来。',
    }, // 蓬溪县
    "510923": {
      area: 697,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '卓筒井、蓬基井',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 大英县
    "510981": {
      area: 1504,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '陈子昂读书台、饶益寺',
      tagline: '射洪市是中国民间诗画艺术之乡，被誉为“子昂故里，诗酒之乡”。',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 射洪市
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#d0d039',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [510903, 510904, 510921, 510923, 510981],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['suining'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
