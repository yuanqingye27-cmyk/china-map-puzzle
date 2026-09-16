/* =====================================================================
 * 地图总登记册（registry）
 * ---------------------------------------------------------------------
 * 路径：js/maps/registry.js
 *
 * 作用：把 js/maps/ 下所有地图包登记成一份**只含元信息**的清单。
 * 元信息故意做得很轻（不含 GeoJSON），所以它可以一次性全量加载，
 * 而体积巨大的 geo 数据等到真正切换地图时再按需注入脚本。
 *
 * ⚠️ 本文件由 tools/build-registry.js 扫描 js/maps/ 生成，**不要手改**。
 *    新增地图请用：node tools/add-map.js --adcode=... --name=... --parent=...
 *
 * 【命名空间约定】—— 引擎之外的三块共享存储
 *   window.MAP_REGISTRY  元信息树（本文件）：谁是谁的父级、脚本在哪
 *   window.MAP_GEO[id]   某张地图的 GeoJSON（由 <id>.geo.js 写入，构建产物）
 *   window.MAP_DATA[id]  某张地图的资料与关卡（由 <id>.data.js 写入，人工维护）
 *   window.MAP_PACKAGES[id]  组装好的引擎配置（由 <id>.js 写入）
 *   三个包文件都做防御性初始化，所以**加载顺序不敏感**。
 *
 * 【registry 条目字段】
 *   id       string   地图包唯一 id（= 文件名，也 = MAP_PACKAGES 的 key）
 *   name     string   显示名，如"成都"
 *   parent   string   上一级地图包 id；根地图为 null
 *   adcode   number   本级行政区划代码
 *   children string[] 下一级地图包 id 列表
 *   scripts  string[] 从 index.html 所在目录算起的脚本路径，按依赖顺序排列
 * ===================================================================== */

(function (global) {
  'use strict';

  /* 先把三块共享命名空间建好，后面的地图包往里登记 */
  global.MAP_REGISTRY = global.MAP_REGISTRY || { version: 1, root: null, maps: {} };
  global.MAP_GEO = global.MAP_GEO || {};
  global.MAP_DATA = global.MAP_DATA || {};
  global.MAP_PACKAGES = global.MAP_PACKAGES || {};

  /* ↓↓↓ 以下内容由 tools/build-registry.js 生成 ↓↓↓ */
  const REGISTRY = {
    version: 1,
    root: null,          // 根地图 id（父级为 null 的那些地图；目前只有 chengdu 一张）
    maps: {
      chengdu: {
        id: 'chengdu',
        name: '成都',
        parent: 'sichuan',
        adcode: 510100,
        children: [],
        scripts: [
          'js/maps/china/sichuan/chengdu.geo.js',
          'js/maps/china/sichuan/chengdu.data.js',
          'js/maps/china/sichuan/chengdu.js',
        ],
      },
    },
  };
  /* ↑↑↑ 生成内容结束 ↑↑↑ */

  global.MAP_REGISTRY = REGISTRY;
})(window);
