/* =====================================================================
 * 地图包 · 攀枝花市 · 资料与关卡【占位骨架，等待人工补全】
 * ---------------------------------------------------------------------
 * 路径：js/maps/china/sichuan/panzhihua.data.js
 * 生成：node tools/add-map.js --adcode=510400 --name=panzhihua --parent=sichuan
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
 * [资料核实] 本轮资料卡来源（2026-09，均为公开可查来源，未采用任何推测内容）：
 *   · 区划与名称：天地图官方行政区划数据（adcode/名称一一对应）
 *   · 素材抓取：tools/facts-batch.js → out/facts-panzhihua.json（词条正文抽句，原文留档）
 *   · 核实方式：子代理逐条比对素材原句 → tools/facts-verify.js 机械核对
 *   · 西区：素材被河南石龙区条目污染（面积比值 0.50）→ 保持占位
 *   · 米易县/盐边县：素材无本行政区面积句（只有河流集雨/流域面积），面积取官方几何值
 *   · 东区 funFact、仁和区 landmark、盐边县 funFact：素材无支撑依据 → 保持占位

 * [area-from-geo] 面积口径：本文件 area 由 tools/area-from-geo.js 从
 * 《panzhihua.geo.js》的官方边界几何计算得出（球面多边形面积，与 d3.geoArea 同公式），
 * 与拼图所用边界严格同源、可复现；属"几何计算值"，不等于官方公布的统计口径面积。
 * 重新生成：node tools/area-from-geo.js --only=panzhihua --write

 * ===================================================================== */

(function (global) {
  'use strict';

  /** 下级行政区资料，key 是国家行政区划代码（adcode） */
  const DISTRICTS = {
    "510402": {
      area: 165,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '玉佛寺、大黑山旅游景区',
      tagline: '攀枝花的中心城区之一，名胜有玉佛寺和大黑山旅游景区。',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 东区
    "510403": {
      area: 122,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '📖 资料收录中，欢迎参与共建',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 西区
    "510411": {
      area: 1721,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '📖 资料收录中，欢迎参与共建',
      tagline: '原名郊区，小气候复杂多样，立体气候明显，全区分为三个垂直气候带。',
      funFact: '仁和区原名郊区，2001 年 8 月 7 日更名为仁和区。',
    }, // 仁和区
    "510421": {
      area: 2111,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '颛顼龙洞景区、傈僳梯田景区、海塔世外桃源、普威绿野花乡、青松林农业公园',
      tagline: '天府旅游名县，有颛顼龙洞、傈僳梯田等 5 处主要景点。',
      funFact: '米易县的"约德节"、傈僳族刺绣、织布技艺等 5 项被评为省级非物质文化遗产。',
    }, // 米易县
    "510422": {
      area: 3289,  // [geo-area] 依官方边界几何计算（km²）
      landmark: '二滩国家森林公园、格萨拉生态旅游区、红格镇红格村',
      tagline: '境内溪流众多，有大小河流 810 余条，县政府驻桐子林镇。',
      funFact: '📖 资料收录中，欢迎参与共建',
    }, // 盐边县
  };

  /** 关卡：自动切分的占位版本，请按地理逻辑重排 */
  const LEVELS = [
    {
      id: 'l1',
      name: '第一关',
      short: '第一关',
      color: '#9e39d0',
      blurb: '📖 本关资料收录中，欢迎参与共建',
      adcodes: [510402, 510403, 510411, 510421, 510422],
    },
  ];

  const MAP_DATA = (global.MAP_DATA = global.MAP_DATA || {});
  MAP_DATA['panzhihua'] = { districts: DISTRICTS, levels: LEVELS };
})(window);
