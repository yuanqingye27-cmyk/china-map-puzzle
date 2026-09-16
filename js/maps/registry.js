/* =====================================================================
 * 地图总登记册（registry）· 自动生成，请勿手改
 * ---------------------------------------------------------------------
 * 路径：js/maps/registry.js
 * 生成：node tools/build-registry.js
 * 新增地图：node tools/add-map.js --adcode=<6位> --name=<slug> --parent=<父id>
 *
 * 作用：把 js/maps/ 下所有地图包登记成一份**只含元信息**的清单（不含 GeoJSON）。
 * 元信息很轻，可以一次性全量加载；体积巨大的 geo 数据等到真正切换地图时
 * 再由 js/maps/loader.js 按需注入脚本，于是"双击秒开"的体验不受地图数量影响。
 *
 * 【命名空间约定】引擎之外的共享存储
 *   window.MAP_REGISTRY    元信息树（本文件）
 *   window.MAP_GEO[id]     某张地图的 GeoJSON（由 <id>.geo.js 写入，构建产物）
 *   window.MAP_DATA[id]    某张地图的资料与关卡（由 <id>.data.js 写入，人工维护）
 *   window.MAP_PACKAGES[id] 组装好的引擎配置（由 <id>.js 写入）
 *   三个包文件都做防御性初始化，所以加载顺序不敏感。
 *
 * 【条目字段】
 *   id       地图包唯一 id（= 文件名 = MAP_PACKAGES 的 key）
 *   name     显示名，如"成都"
 *   parent   上一级地图包 id；根地图为 null
 *   adcode   本级行政区划代码
 *   children 下一级地图包 id（**由子地图的 parent 反向推导**，不是手写的）
 *   dir      相对 js/maps/ 的目录，如 "china/sichuan"（根地图为 ""）
 *   scripts  该地图三个文件的路径，相对 js/maps/，按依赖顺序排列
 *
 * 【roots / orphans】
 *   roots    树的根（parent 为 null 的地图）
 *   orphans  声明了 parent 但父级还没接入的地图，如 [{ id, parent }]
 *            —— 这是"父级空位还等着填"的信号，地图选择器会把它顶到根一级显示
 * ===================================================================== */

(function (global) {
  'use strict';

  /* 先把共享命名空间建好（已存在则保留，重复加载也安全） */
  global.MAP_GEO = global.MAP_GEO || {};
  global.MAP_DATA = global.MAP_DATA || {};
  global.MAP_PACKAGES = global.MAP_PACKAGES || {};

  /* ↓↓↓ 以下内容由 tools/build-registry.js 扫描 js/maps/ 生成 ↓↓↓ */
  const REGISTRY =
  {
    "version": 1,
    "roots": [
      "china"
    ],
    "orphans": [],
    "maps": {
      "china": {
        "id": "china",
        "name": "中国",
        "parent": null,
        "adcode": 100000,
        "children": [
          "sichuan"
        ],
        "dir": "",
        "scripts": [
          "china.geo.js",
          "china.data.js",
          "china.js"
        ]
      },
      "sichuan": {
        "id": "sichuan",
        "name": "四川省",
        "parent": "china",
        "adcode": 510000,
        "children": [
          "chengdu",
          "zigong"
        ],
        "dir": "china",
        "scripts": [
          "china/sichuan.geo.js",
          "china/sichuan.data.js",
          "china/sichuan.js"
        ]
      },
      "chengdu": {
        "id": "chengdu",
        "name": "成都",
        "parent": "sichuan",
        "adcode": 510100,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/chengdu.geo.js",
          "china/sichuan/chengdu.data.js",
          "china/sichuan/chengdu.js"
        ]
      },
      "zigong": {
        "id": "zigong",
        "name": "自贡市",
        "parent": "sichuan",
        "adcode": 510300,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/zigong.geo.js",
          "china/sichuan/zigong.data.js",
          "china/sichuan/zigong.js"
        ]
      }
    }
  };
  /* ↑↑↑ 生成内容结束 ↑↑↑ */

  global.MAP_REGISTRY = REGISTRY;
})(window);
