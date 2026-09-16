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
          "zigong",
          "panzhihua",
          "luzhou",
          "deyang",
          "mianyang",
          "guangyuan",
          "suining",
          "neijiang",
          "leshan",
          "nanchong",
          "meishan",
          "yibin",
          "guangan",
          "dazhou",
          "yaan",
          "bazhong",
          "ziyang",
          "aba",
          "ganzi",
          "liangshan"
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
      },
      "panzhihua": {
        "id": "panzhihua",
        "name": "攀枝花市",
        "parent": "sichuan",
        "adcode": 510400,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/panzhihua.geo.js",
          "china/sichuan/panzhihua.data.js",
          "china/sichuan/panzhihua.js"
        ]
      },
      "luzhou": {
        "id": "luzhou",
        "name": "泸州市",
        "parent": "sichuan",
        "adcode": 510500,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/luzhou.geo.js",
          "china/sichuan/luzhou.data.js",
          "china/sichuan/luzhou.js"
        ]
      },
      "deyang": {
        "id": "deyang",
        "name": "德阳市",
        "parent": "sichuan",
        "adcode": 510600,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/deyang.geo.js",
          "china/sichuan/deyang.data.js",
          "china/sichuan/deyang.js"
        ]
      },
      "mianyang": {
        "id": "mianyang",
        "name": "绵阳市",
        "parent": "sichuan",
        "adcode": 510700,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/mianyang.geo.js",
          "china/sichuan/mianyang.data.js",
          "china/sichuan/mianyang.js"
        ]
      },
      "guangyuan": {
        "id": "guangyuan",
        "name": "广元市",
        "parent": "sichuan",
        "adcode": 510800,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/guangyuan.geo.js",
          "china/sichuan/guangyuan.data.js",
          "china/sichuan/guangyuan.js"
        ]
      },
      "suining": {
        "id": "suining",
        "name": "遂宁市",
        "parent": "sichuan",
        "adcode": 510900,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/suining.geo.js",
          "china/sichuan/suining.data.js",
          "china/sichuan/suining.js"
        ]
      },
      "neijiang": {
        "id": "neijiang",
        "name": "内江市",
        "parent": "sichuan",
        "adcode": 511000,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/neijiang.geo.js",
          "china/sichuan/neijiang.data.js",
          "china/sichuan/neijiang.js"
        ]
      },
      "leshan": {
        "id": "leshan",
        "name": "乐山市",
        "parent": "sichuan",
        "adcode": 511100,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/leshan.geo.js",
          "china/sichuan/leshan.data.js",
          "china/sichuan/leshan.js"
        ]
      },
      "nanchong": {
        "id": "nanchong",
        "name": "南充市",
        "parent": "sichuan",
        "adcode": 511300,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/nanchong.geo.js",
          "china/sichuan/nanchong.data.js",
          "china/sichuan/nanchong.js"
        ]
      },
      "meishan": {
        "id": "meishan",
        "name": "眉山市",
        "parent": "sichuan",
        "adcode": 511400,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/meishan.geo.js",
          "china/sichuan/meishan.data.js",
          "china/sichuan/meishan.js"
        ]
      },
      "yibin": {
        "id": "yibin",
        "name": "宜宾市",
        "parent": "sichuan",
        "adcode": 511500,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/yibin.geo.js",
          "china/sichuan/yibin.data.js",
          "china/sichuan/yibin.js"
        ]
      },
      "guangan": {
        "id": "guangan",
        "name": "广安市",
        "parent": "sichuan",
        "adcode": 511600,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/guangan.geo.js",
          "china/sichuan/guangan.data.js",
          "china/sichuan/guangan.js"
        ]
      },
      "dazhou": {
        "id": "dazhou",
        "name": "达州市",
        "parent": "sichuan",
        "adcode": 511700,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/dazhou.geo.js",
          "china/sichuan/dazhou.data.js",
          "china/sichuan/dazhou.js"
        ]
      },
      "yaan": {
        "id": "yaan",
        "name": "雅安市",
        "parent": "sichuan",
        "adcode": 511800,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/yaan.geo.js",
          "china/sichuan/yaan.data.js",
          "china/sichuan/yaan.js"
        ]
      },
      "bazhong": {
        "id": "bazhong",
        "name": "巴中市",
        "parent": "sichuan",
        "adcode": 511900,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/bazhong.geo.js",
          "china/sichuan/bazhong.data.js",
          "china/sichuan/bazhong.js"
        ]
      },
      "ziyang": {
        "id": "ziyang",
        "name": "资阳市",
        "parent": "sichuan",
        "adcode": 512000,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/ziyang.geo.js",
          "china/sichuan/ziyang.data.js",
          "china/sichuan/ziyang.js"
        ]
      },
      "aba": {
        "id": "aba",
        "name": "阿坝藏族羌族自治州",
        "parent": "sichuan",
        "adcode": 513200,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/aba.geo.js",
          "china/sichuan/aba.data.js",
          "china/sichuan/aba.js"
        ]
      },
      "ganzi": {
        "id": "ganzi",
        "name": "甘孜藏族自治州",
        "parent": "sichuan",
        "adcode": 513300,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/ganzi.geo.js",
          "china/sichuan/ganzi.data.js",
          "china/sichuan/ganzi.js"
        ]
      },
      "liangshan": {
        "id": "liangshan",
        "name": "liangshan",
        "parent": "sichuan",
        "adcode": 513400,
        "children": [],
        "dir": "china/sichuan",
        "scripts": [
          "china/sichuan/liangshan.geo.js",
          "china/sichuan/liangshan.data.js",
          "china/sichuan/liangshan.js"
        ]
      }
    }
  };
  /* ↑↑↑ 生成内容结束 ↑↑↑ */

  global.MAP_REGISTRY = REGISTRY;
})(window);
