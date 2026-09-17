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
          "beijing",
          "tianjin",
          "hebei",
          "shanxi",
          "neimenggu",
          "liaoning",
          "jilin",
          "heilongjiang",
          "shanghai",
          "jiangsu",
          "zhejiang",
          "anhui",
          "fujian",
          "jiangxi",
          "shandong",
          "henan",
          "hubei",
          "hunan",
          "guangdong",
          "guangxi",
          "hainan",
          "chongqing",
          "sichuan",
          "guizhou",
          "yunnan",
          "xizang",
          "shaanxi",
          "gansu",
          "qinghai",
          "ningxia",
          "xinjiang",
          "taiwan",
          "hongkong"
        ],
        "dir": ""
      },
      "beijing": {
        "id": "beijing",
        "name": "beijing",
        "parent": "china",
        "adcode": 110000,
        "children": [],
        "dir": "china"
      },
      "tianjin": {
        "id": "tianjin",
        "name": "tianjin",
        "parent": "china",
        "adcode": 120000,
        "children": [],
        "dir": "china"
      },
      "hebei": {
        "id": "hebei",
        "name": "hebei",
        "parent": "china",
        "adcode": 130000,
        "children": [
          "shijiazhuang",
          "tangshan",
          "qinhuangdao",
          "handan",
          "xingtai",
          "baoding",
          "zhangjiakou",
          "chengde",
          "cangzhou",
          "langfang",
          "hengshui"
        ],
        "dir": "china"
      },
      "shijiazhuang": {
        "id": "shijiazhuang",
        "name": "shijiazhuang",
        "parent": "hebei",
        "adcode": 130100,
        "children": [],
        "dir": "china/hebei"
      },
      "tangshan": {
        "id": "tangshan",
        "name": "tangshan",
        "parent": "hebei",
        "adcode": 130200,
        "children": [],
        "dir": "china/hebei"
      },
      "qinhuangdao": {
        "id": "qinhuangdao",
        "name": "qinhuangdao",
        "parent": "hebei",
        "adcode": 130300,
        "children": [],
        "dir": "china/hebei"
      },
      "handan": {
        "id": "handan",
        "name": "handan",
        "parent": "hebei",
        "adcode": 130400,
        "children": [],
        "dir": "china/hebei"
      },
      "xingtai": {
        "id": "xingtai",
        "name": "xingtai",
        "parent": "hebei",
        "adcode": 130500,
        "children": [],
        "dir": "china/hebei"
      },
      "baoding": {
        "id": "baoding",
        "name": "baoding",
        "parent": "hebei",
        "adcode": 130600,
        "children": [],
        "dir": "china/hebei"
      },
      "zhangjiakou": {
        "id": "zhangjiakou",
        "name": "zhangjiakou",
        "parent": "hebei",
        "adcode": 130700,
        "children": [],
        "dir": "china/hebei"
      },
      "chengde": {
        "id": "chengde",
        "name": "chengde",
        "parent": "hebei",
        "adcode": 130800,
        "children": [],
        "dir": "china/hebei"
      },
      "cangzhou": {
        "id": "cangzhou",
        "name": "cangzhou",
        "parent": "hebei",
        "adcode": 130900,
        "children": [],
        "dir": "china/hebei"
      },
      "langfang": {
        "id": "langfang",
        "name": "langfang",
        "parent": "hebei",
        "adcode": 131000,
        "children": [],
        "dir": "china/hebei"
      },
      "hengshui": {
        "id": "hengshui",
        "name": "hengshui",
        "parent": "hebei",
        "adcode": 131100,
        "children": [],
        "dir": "china/hebei"
      },
      "shanxi": {
        "id": "shanxi",
        "name": "shanxi",
        "parent": "china",
        "adcode": 140000,
        "children": [
          "taiyuan",
          "datong",
          "yangquan",
          "changzhi",
          "jincheng",
          "shuozhou",
          "jinzhong",
          "yuncheng",
          "xinzhou",
          "linfen",
          "lliang"
        ],
        "dir": "china"
      },
      "taiyuan": {
        "id": "taiyuan",
        "name": "taiyuan",
        "parent": "shanxi",
        "adcode": 140100,
        "children": [],
        "dir": "china/shanxi"
      },
      "datong": {
        "id": "datong",
        "name": "datong",
        "parent": "shanxi",
        "adcode": 140200,
        "children": [],
        "dir": "china/shanxi"
      },
      "yangquan": {
        "id": "yangquan",
        "name": "yangquan",
        "parent": "shanxi",
        "adcode": 140300,
        "children": [],
        "dir": "china/shanxi"
      },
      "changzhi": {
        "id": "changzhi",
        "name": "changzhi",
        "parent": "shanxi",
        "adcode": 140400,
        "children": [],
        "dir": "china/shanxi"
      },
      "jincheng": {
        "id": "jincheng",
        "name": "jincheng",
        "parent": "shanxi",
        "adcode": 140500,
        "children": [],
        "dir": "china/shanxi"
      },
      "shuozhou": {
        "id": "shuozhou",
        "name": "shuozhou",
        "parent": "shanxi",
        "adcode": 140600,
        "children": [],
        "dir": "china/shanxi"
      },
      "jinzhong": {
        "id": "jinzhong",
        "name": "jinzhong",
        "parent": "shanxi",
        "adcode": 140700,
        "children": [],
        "dir": "china/shanxi"
      },
      "yuncheng": {
        "id": "yuncheng",
        "name": "yuncheng",
        "parent": "shanxi",
        "adcode": 140800,
        "children": [],
        "dir": "china/shanxi"
      },
      "xinzhou": {
        "id": "xinzhou",
        "name": "xinzhou",
        "parent": "shanxi",
        "adcode": 140900,
        "children": [],
        "dir": "china/shanxi"
      },
      "linfen": {
        "id": "linfen",
        "name": "linfen",
        "parent": "shanxi",
        "adcode": 141000,
        "children": [],
        "dir": "china/shanxi"
      },
      "lliang": {
        "id": "lliang",
        "name": "lliang",
        "parent": "shanxi",
        "adcode": 141100,
        "children": [],
        "dir": "china/shanxi"
      },
      "neimenggu": {
        "id": "neimenggu",
        "name": "neimenggu",
        "parent": "china",
        "adcode": 150000,
        "children": [
          "huhehaote",
          "baotou",
          "wuhai",
          "chifeng",
          "tongliao",
          "eerduosi",
          "hulunbeier",
          "bayannaoer",
          "wulanchabu",
          "xingan",
          "xilinguole",
          "alashan"
        ],
        "dir": "china"
      },
      "huhehaote": {
        "id": "huhehaote",
        "name": "huhehaote",
        "parent": "neimenggu",
        "adcode": 150100,
        "children": [],
        "dir": "china/neimenggu"
      },
      "baotou": {
        "id": "baotou",
        "name": "baotou",
        "parent": "neimenggu",
        "adcode": 150200,
        "children": [],
        "dir": "china/neimenggu"
      },
      "wuhai": {
        "id": "wuhai",
        "name": "wuhai",
        "parent": "neimenggu",
        "adcode": 150300,
        "children": [],
        "dir": "china/neimenggu"
      },
      "chifeng": {
        "id": "chifeng",
        "name": "chifeng",
        "parent": "neimenggu",
        "adcode": 150400,
        "children": [],
        "dir": "china/neimenggu"
      },
      "tongliao": {
        "id": "tongliao",
        "name": "tongliao",
        "parent": "neimenggu",
        "adcode": 150500,
        "children": [],
        "dir": "china/neimenggu"
      },
      "eerduosi": {
        "id": "eerduosi",
        "name": "eerduosi",
        "parent": "neimenggu",
        "adcode": 150600,
        "children": [],
        "dir": "china/neimenggu"
      },
      "hulunbeier": {
        "id": "hulunbeier",
        "name": "hulunbeier",
        "parent": "neimenggu",
        "adcode": 150700,
        "children": [],
        "dir": "china/neimenggu"
      },
      "bayannaoer": {
        "id": "bayannaoer",
        "name": "bayannaoer",
        "parent": "neimenggu",
        "adcode": 150800,
        "children": [],
        "dir": "china/neimenggu"
      },
      "wulanchabu": {
        "id": "wulanchabu",
        "name": "wulanchabu",
        "parent": "neimenggu",
        "adcode": 150900,
        "children": [],
        "dir": "china/neimenggu"
      },
      "xingan": {
        "id": "xingan",
        "name": "xingan",
        "parent": "neimenggu",
        "adcode": 152200,
        "children": [],
        "dir": "china/neimenggu"
      },
      "xilinguole": {
        "id": "xilinguole",
        "name": "xilinguole",
        "parent": "neimenggu",
        "adcode": 152500,
        "children": [],
        "dir": "china/neimenggu"
      },
      "alashan": {
        "id": "alashan",
        "name": "alashan",
        "parent": "neimenggu",
        "adcode": 152900,
        "children": [],
        "dir": "china/neimenggu"
      },
      "liaoning": {
        "id": "liaoning",
        "name": "liaoning",
        "parent": "china",
        "adcode": 210000,
        "children": [
          "shenyang",
          "dalian",
          "anshan",
          "fushun",
          "benxi",
          "dandong",
          "jinzhou",
          "yingkou",
          "fuxin",
          "liaoyang",
          "panjin",
          "tieling",
          "chaoyangshi",
          "huludao"
        ],
        "dir": "china"
      },
      "shenyang": {
        "id": "shenyang",
        "name": "shenyang",
        "parent": "liaoning",
        "adcode": 210100,
        "children": [],
        "dir": "china/liaoning"
      },
      "dalian": {
        "id": "dalian",
        "name": "dalian",
        "parent": "liaoning",
        "adcode": 210200,
        "children": [],
        "dir": "china/liaoning"
      },
      "anshan": {
        "id": "anshan",
        "name": "anshan",
        "parent": "liaoning",
        "adcode": 210300,
        "children": [],
        "dir": "china/liaoning"
      },
      "fushun": {
        "id": "fushun",
        "name": "fushun",
        "parent": "liaoning",
        "adcode": 210400,
        "children": [],
        "dir": "china/liaoning"
      },
      "benxi": {
        "id": "benxi",
        "name": "benxi",
        "parent": "liaoning",
        "adcode": 210500,
        "children": [],
        "dir": "china/liaoning"
      },
      "dandong": {
        "id": "dandong",
        "name": "dandong",
        "parent": "liaoning",
        "adcode": 210600,
        "children": [],
        "dir": "china/liaoning"
      },
      "jinzhou": {
        "id": "jinzhou",
        "name": "jinzhou",
        "parent": "liaoning",
        "adcode": 210700,
        "children": [],
        "dir": "china/liaoning"
      },
      "yingkou": {
        "id": "yingkou",
        "name": "yingkou",
        "parent": "liaoning",
        "adcode": 210800,
        "children": [],
        "dir": "china/liaoning"
      },
      "fuxin": {
        "id": "fuxin",
        "name": "fuxin",
        "parent": "liaoning",
        "adcode": 210900,
        "children": [],
        "dir": "china/liaoning"
      },
      "liaoyang": {
        "id": "liaoyang",
        "name": "liaoyang",
        "parent": "liaoning",
        "adcode": 211000,
        "children": [],
        "dir": "china/liaoning"
      },
      "panjin": {
        "id": "panjin",
        "name": "panjin",
        "parent": "liaoning",
        "adcode": 211100,
        "children": [],
        "dir": "china/liaoning"
      },
      "tieling": {
        "id": "tieling",
        "name": "tieling",
        "parent": "liaoning",
        "adcode": 211200,
        "children": [],
        "dir": "china/liaoning"
      },
      "chaoyangshi": {
        "id": "chaoyangshi",
        "name": "chaoyangshi",
        "parent": "liaoning",
        "adcode": 211300,
        "children": [],
        "dir": "china/liaoning"
      },
      "huludao": {
        "id": "huludao",
        "name": "huludao",
        "parent": "liaoning",
        "adcode": 211400,
        "children": [],
        "dir": "china/liaoning"
      },
      "jilin": {
        "id": "jilin",
        "name": "jilin",
        "parent": "china",
        "adcode": 220000,
        "children": [
          "changchun",
          "jilinshi",
          "siping",
          "liaoyuan",
          "tonghua",
          "baishan",
          "songyuan",
          "baicheng",
          "yanbian"
        ],
        "dir": "china"
      },
      "changchun": {
        "id": "changchun",
        "name": "changchun",
        "parent": "jilin",
        "adcode": 220100,
        "children": [],
        "dir": "china/jilin"
      },
      "jilinshi": {
        "id": "jilinshi",
        "name": "jilinshi",
        "parent": "jilin",
        "adcode": 220200,
        "children": [],
        "dir": "china/jilin"
      },
      "siping": {
        "id": "siping",
        "name": "siping",
        "parent": "jilin",
        "adcode": 220300,
        "children": [],
        "dir": "china/jilin"
      },
      "liaoyuan": {
        "id": "liaoyuan",
        "name": "liaoyuan",
        "parent": "jilin",
        "adcode": 220400,
        "children": [],
        "dir": "china/jilin"
      },
      "tonghua": {
        "id": "tonghua",
        "name": "tonghua",
        "parent": "jilin",
        "adcode": 220500,
        "children": [],
        "dir": "china/jilin"
      },
      "baishan": {
        "id": "baishan",
        "name": "baishan",
        "parent": "jilin",
        "adcode": 220600,
        "children": [],
        "dir": "china/jilin"
      },
      "songyuan": {
        "id": "songyuan",
        "name": "songyuan",
        "parent": "jilin",
        "adcode": 220700,
        "children": [],
        "dir": "china/jilin"
      },
      "baicheng": {
        "id": "baicheng",
        "name": "baicheng",
        "parent": "jilin",
        "adcode": 220800,
        "children": [],
        "dir": "china/jilin"
      },
      "yanbian": {
        "id": "yanbian",
        "name": "yanbian",
        "parent": "jilin",
        "adcode": 222400,
        "children": [],
        "dir": "china/jilin"
      },
      "heilongjiang": {
        "id": "heilongjiang",
        "name": "heilongjiang",
        "parent": "china",
        "adcode": 230000,
        "children": [
          "haerbin",
          "qiqihaer",
          "jixi",
          "hegang",
          "shuangyashan",
          "daqing",
          "yichun",
          "jiamusi",
          "qitaihe",
          "mudanjiang",
          "heihe",
          "suihua",
          "daxinganling"
        ],
        "dir": "china"
      },
      "haerbin": {
        "id": "haerbin",
        "name": "haerbin",
        "parent": "heilongjiang",
        "adcode": 230100,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "qiqihaer": {
        "id": "qiqihaer",
        "name": "qiqihaer",
        "parent": "heilongjiang",
        "adcode": 230200,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "jixi": {
        "id": "jixi",
        "name": "jixi",
        "parent": "heilongjiang",
        "adcode": 230300,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "hegang": {
        "id": "hegang",
        "name": "hegang",
        "parent": "heilongjiang",
        "adcode": 230400,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "shuangyashan": {
        "id": "shuangyashan",
        "name": "shuangyashan",
        "parent": "heilongjiang",
        "adcode": 230500,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "daqing": {
        "id": "daqing",
        "name": "daqing",
        "parent": "heilongjiang",
        "adcode": 230600,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "yichun": {
        "id": "yichun",
        "name": "yichun",
        "parent": "heilongjiang",
        "adcode": 230700,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "jiamusi": {
        "id": "jiamusi",
        "name": "jiamusi",
        "parent": "heilongjiang",
        "adcode": 230800,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "qitaihe": {
        "id": "qitaihe",
        "name": "qitaihe",
        "parent": "heilongjiang",
        "adcode": 230900,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "mudanjiang": {
        "id": "mudanjiang",
        "name": "mudanjiang",
        "parent": "heilongjiang",
        "adcode": 231000,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "heihe": {
        "id": "heihe",
        "name": "heihe",
        "parent": "heilongjiang",
        "adcode": 231100,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "suihua": {
        "id": "suihua",
        "name": "suihua",
        "parent": "heilongjiang",
        "adcode": 231200,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "daxinganling": {
        "id": "daxinganling",
        "name": "daxinganling",
        "parent": "heilongjiang",
        "adcode": 232700,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "shanghai": {
        "id": "shanghai",
        "name": "shanghai",
        "parent": "china",
        "adcode": 310000,
        "children": [],
        "dir": "china"
      },
      "jiangsu": {
        "id": "jiangsu",
        "name": "jiangsu",
        "parent": "china",
        "adcode": 320000,
        "children": [
          "nanjing",
          "wuxi",
          "xuzhou",
          "changzhou",
          "suzhou",
          "nantong",
          "lianyungang",
          "huaian",
          "yancheng",
          "yangzhou",
          "zhenjiang",
          "taizhou",
          "suqian"
        ],
        "dir": "china"
      },
      "nanjing": {
        "id": "nanjing",
        "name": "nanjing",
        "parent": "jiangsu",
        "adcode": 320100,
        "children": [],
        "dir": "china/jiangsu"
      },
      "wuxi": {
        "id": "wuxi",
        "name": "wuxi",
        "parent": "jiangsu",
        "adcode": 320200,
        "children": [],
        "dir": "china/jiangsu"
      },
      "xuzhou": {
        "id": "xuzhou",
        "name": "xuzhou",
        "parent": "jiangsu",
        "adcode": 320300,
        "children": [],
        "dir": "china/jiangsu"
      },
      "changzhou": {
        "id": "changzhou",
        "name": "changzhou",
        "parent": "jiangsu",
        "adcode": 320400,
        "children": [],
        "dir": "china/jiangsu"
      },
      "suzhou": {
        "id": "suzhou",
        "name": "suzhou",
        "parent": "jiangsu",
        "adcode": 320500,
        "children": [],
        "dir": "china/jiangsu"
      },
      "nantong": {
        "id": "nantong",
        "name": "nantong",
        "parent": "jiangsu",
        "adcode": 320600,
        "children": [],
        "dir": "china/jiangsu"
      },
      "lianyungang": {
        "id": "lianyungang",
        "name": "lianyungang",
        "parent": "jiangsu",
        "adcode": 320700,
        "children": [],
        "dir": "china/jiangsu"
      },
      "huaian": {
        "id": "huaian",
        "name": "huaian",
        "parent": "jiangsu",
        "adcode": 320800,
        "children": [],
        "dir": "china/jiangsu"
      },
      "yancheng": {
        "id": "yancheng",
        "name": "yancheng",
        "parent": "jiangsu",
        "adcode": 320900,
        "children": [],
        "dir": "china/jiangsu"
      },
      "yangzhou": {
        "id": "yangzhou",
        "name": "yangzhou",
        "parent": "jiangsu",
        "adcode": 321000,
        "children": [],
        "dir": "china/jiangsu"
      },
      "zhenjiang": {
        "id": "zhenjiang",
        "name": "zhenjiang",
        "parent": "jiangsu",
        "adcode": 321100,
        "children": [],
        "dir": "china/jiangsu"
      },
      "taizhou": {
        "id": "taizhou",
        "name": "taizhou",
        "parent": "jiangsu",
        "adcode": 321200,
        "children": [],
        "dir": "china/jiangsu"
      },
      "suqian": {
        "id": "suqian",
        "name": "suqian",
        "parent": "jiangsu",
        "adcode": 321300,
        "children": [],
        "dir": "china/jiangsu"
      },
      "zhejiang": {
        "id": "zhejiang",
        "name": "zhejiang",
        "parent": "china",
        "adcode": 330000,
        "children": [
          "hangzhou",
          "ningbo",
          "wenzhou",
          "jiaxing",
          "huzhou",
          "shaoxing",
          "jinhua",
          "quzhou",
          "zhoushan",
          "taizhoushi",
          "lishui"
        ],
        "dir": "china"
      },
      "hangzhou": {
        "id": "hangzhou",
        "name": "hangzhou",
        "parent": "zhejiang",
        "adcode": 330100,
        "children": [],
        "dir": "china/zhejiang"
      },
      "ningbo": {
        "id": "ningbo",
        "name": "ningbo",
        "parent": "zhejiang",
        "adcode": 330200,
        "children": [],
        "dir": "china/zhejiang"
      },
      "wenzhou": {
        "id": "wenzhou",
        "name": "wenzhou",
        "parent": "zhejiang",
        "adcode": 330300,
        "children": [],
        "dir": "china/zhejiang"
      },
      "jiaxing": {
        "id": "jiaxing",
        "name": "jiaxing",
        "parent": "zhejiang",
        "adcode": 330400,
        "children": [],
        "dir": "china/zhejiang"
      },
      "huzhou": {
        "id": "huzhou",
        "name": "huzhou",
        "parent": "zhejiang",
        "adcode": 330500,
        "children": [],
        "dir": "china/zhejiang"
      },
      "shaoxing": {
        "id": "shaoxing",
        "name": "shaoxing",
        "parent": "zhejiang",
        "adcode": 330600,
        "children": [],
        "dir": "china/zhejiang"
      },
      "jinhua": {
        "id": "jinhua",
        "name": "jinhua",
        "parent": "zhejiang",
        "adcode": 330700,
        "children": [],
        "dir": "china/zhejiang"
      },
      "quzhou": {
        "id": "quzhou",
        "name": "quzhou",
        "parent": "zhejiang",
        "adcode": 330800,
        "children": [],
        "dir": "china/zhejiang"
      },
      "zhoushan": {
        "id": "zhoushan",
        "name": "zhoushan",
        "parent": "zhejiang",
        "adcode": 330900,
        "children": [],
        "dir": "china/zhejiang"
      },
      "taizhoushi": {
        "id": "taizhoushi",
        "name": "taizhoushi",
        "parent": "zhejiang",
        "adcode": 331000,
        "children": [],
        "dir": "china/zhejiang"
      },
      "lishui": {
        "id": "lishui",
        "name": "lishui",
        "parent": "zhejiang",
        "adcode": 331100,
        "children": [],
        "dir": "china/zhejiang"
      },
      "anhui": {
        "id": "anhui",
        "name": "anhui",
        "parent": "china",
        "adcode": 340000,
        "children": [
          "hefei",
          "wuhu",
          "bengbu",
          "huainan",
          "maanshan",
          "huaibei",
          "tongling",
          "anqing",
          "huangshan",
          "chuzhou",
          "fuyang",
          "suzhoushi",
          "luan",
          "bozhou",
          "chizhou",
          "xuancheng"
        ],
        "dir": "china"
      },
      "hefei": {
        "id": "hefei",
        "name": "hefei",
        "parent": "anhui",
        "adcode": 340100,
        "children": [],
        "dir": "china/anhui"
      },
      "wuhu": {
        "id": "wuhu",
        "name": "wuhu",
        "parent": "anhui",
        "adcode": 340200,
        "children": [],
        "dir": "china/anhui"
      },
      "bengbu": {
        "id": "bengbu",
        "name": "bengbu",
        "parent": "anhui",
        "adcode": 340300,
        "children": [],
        "dir": "china/anhui"
      },
      "huainan": {
        "id": "huainan",
        "name": "huainan",
        "parent": "anhui",
        "adcode": 340400,
        "children": [],
        "dir": "china/anhui"
      },
      "maanshan": {
        "id": "maanshan",
        "name": "maanshan",
        "parent": "anhui",
        "adcode": 340500,
        "children": [],
        "dir": "china/anhui"
      },
      "huaibei": {
        "id": "huaibei",
        "name": "huaibei",
        "parent": "anhui",
        "adcode": 340600,
        "children": [],
        "dir": "china/anhui"
      },
      "tongling": {
        "id": "tongling",
        "name": "tongling",
        "parent": "anhui",
        "adcode": 340700,
        "children": [],
        "dir": "china/anhui"
      },
      "anqing": {
        "id": "anqing",
        "name": "anqing",
        "parent": "anhui",
        "adcode": 340800,
        "children": [],
        "dir": "china/anhui"
      },
      "huangshan": {
        "id": "huangshan",
        "name": "huangshan",
        "parent": "anhui",
        "adcode": 341000,
        "children": [],
        "dir": "china/anhui"
      },
      "chuzhou": {
        "id": "chuzhou",
        "name": "chuzhou",
        "parent": "anhui",
        "adcode": 341100,
        "children": [],
        "dir": "china/anhui"
      },
      "fuyang": {
        "id": "fuyang",
        "name": "fuyang",
        "parent": "anhui",
        "adcode": 341200,
        "children": [],
        "dir": "china/anhui"
      },
      "suzhoushi": {
        "id": "suzhoushi",
        "name": "suzhoushi",
        "parent": "anhui",
        "adcode": 341300,
        "children": [],
        "dir": "china/anhui"
      },
      "luan": {
        "id": "luan",
        "name": "luan",
        "parent": "anhui",
        "adcode": 341500,
        "children": [],
        "dir": "china/anhui"
      },
      "bozhou": {
        "id": "bozhou",
        "name": "bozhou",
        "parent": "anhui",
        "adcode": 341600,
        "children": [],
        "dir": "china/anhui"
      },
      "chizhou": {
        "id": "chizhou",
        "name": "chizhou",
        "parent": "anhui",
        "adcode": 341700,
        "children": [],
        "dir": "china/anhui"
      },
      "xuancheng": {
        "id": "xuancheng",
        "name": "xuancheng",
        "parent": "anhui",
        "adcode": 341800,
        "children": [],
        "dir": "china/anhui"
      },
      "fujian": {
        "id": "fujian",
        "name": "fujian",
        "parent": "china",
        "adcode": 350000,
        "children": [
          "fuzhou",
          "xiamen",
          "putian",
          "sanming",
          "quanzhou",
          "zhangzhou",
          "nanping",
          "longyan",
          "ningde"
        ],
        "dir": "china"
      },
      "fuzhou": {
        "id": "fuzhou",
        "name": "fuzhou",
        "parent": "fujian",
        "adcode": 350100,
        "children": [],
        "dir": "china/fujian"
      },
      "xiamen": {
        "id": "xiamen",
        "name": "xiamen",
        "parent": "fujian",
        "adcode": 350200,
        "children": [],
        "dir": "china/fujian"
      },
      "putian": {
        "id": "putian",
        "name": "putian",
        "parent": "fujian",
        "adcode": 350300,
        "children": [],
        "dir": "china/fujian"
      },
      "sanming": {
        "id": "sanming",
        "name": "sanming",
        "parent": "fujian",
        "adcode": 350400,
        "children": [],
        "dir": "china/fujian"
      },
      "quanzhou": {
        "id": "quanzhou",
        "name": "quanzhou",
        "parent": "fujian",
        "adcode": 350500,
        "children": [],
        "dir": "china/fujian"
      },
      "zhangzhou": {
        "id": "zhangzhou",
        "name": "zhangzhou",
        "parent": "fujian",
        "adcode": 350600,
        "children": [],
        "dir": "china/fujian"
      },
      "nanping": {
        "id": "nanping",
        "name": "nanping",
        "parent": "fujian",
        "adcode": 350700,
        "children": [],
        "dir": "china/fujian"
      },
      "longyan": {
        "id": "longyan",
        "name": "longyan",
        "parent": "fujian",
        "adcode": 350800,
        "children": [],
        "dir": "china/fujian"
      },
      "ningde": {
        "id": "ningde",
        "name": "ningde",
        "parent": "fujian",
        "adcode": 350900,
        "children": [],
        "dir": "china/fujian"
      },
      "jiangxi": {
        "id": "jiangxi",
        "name": "jiangxi",
        "parent": "china",
        "adcode": 360000,
        "children": [
          "nanchang",
          "jingdezhen",
          "pingxiang",
          "jiujiang",
          "xinyu",
          "yingtan",
          "ganzhou",
          "jian",
          "yichunshi",
          "fuzhoushi",
          "shangrao"
        ],
        "dir": "china"
      },
      "nanchang": {
        "id": "nanchang",
        "name": "nanchang",
        "parent": "jiangxi",
        "adcode": 360100,
        "children": [],
        "dir": "china/jiangxi"
      },
      "jingdezhen": {
        "id": "jingdezhen",
        "name": "jingdezhen",
        "parent": "jiangxi",
        "adcode": 360200,
        "children": [],
        "dir": "china/jiangxi"
      },
      "pingxiang": {
        "id": "pingxiang",
        "name": "pingxiang",
        "parent": "jiangxi",
        "adcode": 360300,
        "children": [],
        "dir": "china/jiangxi"
      },
      "jiujiang": {
        "id": "jiujiang",
        "name": "jiujiang",
        "parent": "jiangxi",
        "adcode": 360400,
        "children": [],
        "dir": "china/jiangxi"
      },
      "xinyu": {
        "id": "xinyu",
        "name": "xinyu",
        "parent": "jiangxi",
        "adcode": 360500,
        "children": [],
        "dir": "china/jiangxi"
      },
      "yingtan": {
        "id": "yingtan",
        "name": "yingtan",
        "parent": "jiangxi",
        "adcode": 360600,
        "children": [],
        "dir": "china/jiangxi"
      },
      "ganzhou": {
        "id": "ganzhou",
        "name": "ganzhou",
        "parent": "jiangxi",
        "adcode": 360700,
        "children": [],
        "dir": "china/jiangxi"
      },
      "jian": {
        "id": "jian",
        "name": "jian",
        "parent": "jiangxi",
        "adcode": 360800,
        "children": [],
        "dir": "china/jiangxi"
      },
      "yichunshi": {
        "id": "yichunshi",
        "name": "yichunshi",
        "parent": "jiangxi",
        "adcode": 360900,
        "children": [],
        "dir": "china/jiangxi"
      },
      "fuzhoushi": {
        "id": "fuzhoushi",
        "name": "fuzhoushi",
        "parent": "jiangxi",
        "adcode": 361000,
        "children": [],
        "dir": "china/jiangxi"
      },
      "shangrao": {
        "id": "shangrao",
        "name": "shangrao",
        "parent": "jiangxi",
        "adcode": 361100,
        "children": [],
        "dir": "china/jiangxi"
      },
      "shandong": {
        "id": "shandong",
        "name": "shandong",
        "parent": "china",
        "adcode": 370000,
        "children": [
          "jinan",
          "qingdao",
          "zibo",
          "zaozhuang",
          "dongying",
          "yantai",
          "weifang",
          "jining",
          "taian",
          "weihai",
          "rizhao",
          "linyi",
          "dezhou",
          "liaocheng",
          "binzhou",
          "heze"
        ],
        "dir": "china"
      },
      "jinan": {
        "id": "jinan",
        "name": "jinan",
        "parent": "shandong",
        "adcode": 370100,
        "children": [],
        "dir": "china/shandong"
      },
      "qingdao": {
        "id": "qingdao",
        "name": "qingdao",
        "parent": "shandong",
        "adcode": 370200,
        "children": [],
        "dir": "china/shandong"
      },
      "zibo": {
        "id": "zibo",
        "name": "zibo",
        "parent": "shandong",
        "adcode": 370300,
        "children": [],
        "dir": "china/shandong"
      },
      "zaozhuang": {
        "id": "zaozhuang",
        "name": "zaozhuang",
        "parent": "shandong",
        "adcode": 370400,
        "children": [],
        "dir": "china/shandong"
      },
      "dongying": {
        "id": "dongying",
        "name": "dongying",
        "parent": "shandong",
        "adcode": 370500,
        "children": [],
        "dir": "china/shandong"
      },
      "yantai": {
        "id": "yantai",
        "name": "yantai",
        "parent": "shandong",
        "adcode": 370600,
        "children": [],
        "dir": "china/shandong"
      },
      "weifang": {
        "id": "weifang",
        "name": "weifang",
        "parent": "shandong",
        "adcode": 370700,
        "children": [],
        "dir": "china/shandong"
      },
      "jining": {
        "id": "jining",
        "name": "jining",
        "parent": "shandong",
        "adcode": 370800,
        "children": [],
        "dir": "china/shandong"
      },
      "taian": {
        "id": "taian",
        "name": "taian",
        "parent": "shandong",
        "adcode": 370900,
        "children": [],
        "dir": "china/shandong"
      },
      "weihai": {
        "id": "weihai",
        "name": "weihai",
        "parent": "shandong",
        "adcode": 371000,
        "children": [],
        "dir": "china/shandong"
      },
      "rizhao": {
        "id": "rizhao",
        "name": "rizhao",
        "parent": "shandong",
        "adcode": 371100,
        "children": [],
        "dir": "china/shandong"
      },
      "linyi": {
        "id": "linyi",
        "name": "linyi",
        "parent": "shandong",
        "adcode": 371300,
        "children": [],
        "dir": "china/shandong"
      },
      "dezhou": {
        "id": "dezhou",
        "name": "dezhou",
        "parent": "shandong",
        "adcode": 371400,
        "children": [],
        "dir": "china/shandong"
      },
      "liaocheng": {
        "id": "liaocheng",
        "name": "liaocheng",
        "parent": "shandong",
        "adcode": 371500,
        "children": [],
        "dir": "china/shandong"
      },
      "binzhou": {
        "id": "binzhou",
        "name": "binzhou",
        "parent": "shandong",
        "adcode": 371600,
        "children": [],
        "dir": "china/shandong"
      },
      "heze": {
        "id": "heze",
        "name": "heze",
        "parent": "shandong",
        "adcode": 371700,
        "children": [],
        "dir": "china/shandong"
      },
      "henan": {
        "id": "henan",
        "name": "henan",
        "parent": "china",
        "adcode": 410000,
        "children": [
          "zhengzhou",
          "kaifeng",
          "luoyang",
          "pingdingshan",
          "anyang",
          "hebi",
          "xinxiang",
          "jiaozuo",
          "puyang",
          "xuchang",
          "luohe",
          "sanmenxia",
          "nanyang",
          "shangqiu",
          "xinyang",
          "zhoukou",
          "zhumadian"
        ],
        "dir": "china"
      },
      "zhengzhou": {
        "id": "zhengzhou",
        "name": "zhengzhou",
        "parent": "henan",
        "adcode": 410100,
        "children": [],
        "dir": "china/henan"
      },
      "kaifeng": {
        "id": "kaifeng",
        "name": "kaifeng",
        "parent": "henan",
        "adcode": 410200,
        "children": [],
        "dir": "china/henan"
      },
      "luoyang": {
        "id": "luoyang",
        "name": "luoyang",
        "parent": "henan",
        "adcode": 410300,
        "children": [],
        "dir": "china/henan"
      },
      "pingdingshan": {
        "id": "pingdingshan",
        "name": "pingdingshan",
        "parent": "henan",
        "adcode": 410400,
        "children": [],
        "dir": "china/henan"
      },
      "anyang": {
        "id": "anyang",
        "name": "anyang",
        "parent": "henan",
        "adcode": 410500,
        "children": [],
        "dir": "china/henan"
      },
      "hebi": {
        "id": "hebi",
        "name": "hebi",
        "parent": "henan",
        "adcode": 410600,
        "children": [],
        "dir": "china/henan"
      },
      "xinxiang": {
        "id": "xinxiang",
        "name": "xinxiang",
        "parent": "henan",
        "adcode": 410700,
        "children": [],
        "dir": "china/henan"
      },
      "jiaozuo": {
        "id": "jiaozuo",
        "name": "jiaozuo",
        "parent": "henan",
        "adcode": 410800,
        "children": [],
        "dir": "china/henan"
      },
      "puyang": {
        "id": "puyang",
        "name": "puyang",
        "parent": "henan",
        "adcode": 410900,
        "children": [],
        "dir": "china/henan"
      },
      "xuchang": {
        "id": "xuchang",
        "name": "xuchang",
        "parent": "henan",
        "adcode": 411000,
        "children": [],
        "dir": "china/henan"
      },
      "luohe": {
        "id": "luohe",
        "name": "luohe",
        "parent": "henan",
        "adcode": 411100,
        "children": [],
        "dir": "china/henan"
      },
      "sanmenxia": {
        "id": "sanmenxia",
        "name": "sanmenxia",
        "parent": "henan",
        "adcode": 411200,
        "children": [],
        "dir": "china/henan"
      },
      "nanyang": {
        "id": "nanyang",
        "name": "nanyang",
        "parent": "henan",
        "adcode": 411300,
        "children": [],
        "dir": "china/henan"
      },
      "shangqiu": {
        "id": "shangqiu",
        "name": "shangqiu",
        "parent": "henan",
        "adcode": 411400,
        "children": [],
        "dir": "china/henan"
      },
      "xinyang": {
        "id": "xinyang",
        "name": "xinyang",
        "parent": "henan",
        "adcode": 411500,
        "children": [],
        "dir": "china/henan"
      },
      "zhoukou": {
        "id": "zhoukou",
        "name": "zhoukou",
        "parent": "henan",
        "adcode": 411600,
        "children": [],
        "dir": "china/henan"
      },
      "zhumadian": {
        "id": "zhumadian",
        "name": "zhumadian",
        "parent": "henan",
        "adcode": 411700,
        "children": [],
        "dir": "china/henan"
      },
      "hubei": {
        "id": "hubei",
        "name": "hubei",
        "parent": "china",
        "adcode": 420000,
        "children": [
          "wuhan",
          "huangshi",
          "shiyan",
          "yichang",
          "xiangyang",
          "ezhou",
          "jingmen",
          "xiaogan",
          "jingzhou",
          "huanggang",
          "xianning",
          "suizhou",
          "enshi"
        ],
        "dir": "china"
      },
      "wuhan": {
        "id": "wuhan",
        "name": "wuhan",
        "parent": "hubei",
        "adcode": 420100,
        "children": [],
        "dir": "china/hubei"
      },
      "huangshi": {
        "id": "huangshi",
        "name": "huangshi",
        "parent": "hubei",
        "adcode": 420200,
        "children": [],
        "dir": "china/hubei"
      },
      "shiyan": {
        "id": "shiyan",
        "name": "shiyan",
        "parent": "hubei",
        "adcode": 420300,
        "children": [],
        "dir": "china/hubei"
      },
      "yichang": {
        "id": "yichang",
        "name": "yichang",
        "parent": "hubei",
        "adcode": 420500,
        "children": [],
        "dir": "china/hubei"
      },
      "xiangyang": {
        "id": "xiangyang",
        "name": "xiangyang",
        "parent": "hubei",
        "adcode": 420600,
        "children": [],
        "dir": "china/hubei"
      },
      "ezhou": {
        "id": "ezhou",
        "name": "ezhou",
        "parent": "hubei",
        "adcode": 420700,
        "children": [],
        "dir": "china/hubei"
      },
      "jingmen": {
        "id": "jingmen",
        "name": "jingmen",
        "parent": "hubei",
        "adcode": 420800,
        "children": [],
        "dir": "china/hubei"
      },
      "xiaogan": {
        "id": "xiaogan",
        "name": "xiaogan",
        "parent": "hubei",
        "adcode": 420900,
        "children": [],
        "dir": "china/hubei"
      },
      "jingzhou": {
        "id": "jingzhou",
        "name": "jingzhou",
        "parent": "hubei",
        "adcode": 421000,
        "children": [],
        "dir": "china/hubei"
      },
      "huanggang": {
        "id": "huanggang",
        "name": "huanggang",
        "parent": "hubei",
        "adcode": 421100,
        "children": [],
        "dir": "china/hubei"
      },
      "xianning": {
        "id": "xianning",
        "name": "xianning",
        "parent": "hubei",
        "adcode": 421200,
        "children": [],
        "dir": "china/hubei"
      },
      "suizhou": {
        "id": "suizhou",
        "name": "suizhou",
        "parent": "hubei",
        "adcode": 421300,
        "children": [],
        "dir": "china/hubei"
      },
      "enshi": {
        "id": "enshi",
        "name": "enshi",
        "parent": "hubei",
        "adcode": 422800,
        "children": [],
        "dir": "china/hubei"
      },
      "hunan": {
        "id": "hunan",
        "name": "hunan",
        "parent": "china",
        "adcode": 430000,
        "children": [
          "changsha",
          "zhuzhou",
          "xiangtan",
          "hengyang",
          "shaoyang",
          "yueyang",
          "changde",
          "zhangjiajie",
          "yiyang",
          "chenzhou",
          "yongzhou",
          "huaihua",
          "loudi",
          "xiangxi"
        ],
        "dir": "china"
      },
      "changsha": {
        "id": "changsha",
        "name": "changsha",
        "parent": "hunan",
        "adcode": 430100,
        "children": [],
        "dir": "china/hunan"
      },
      "zhuzhou": {
        "id": "zhuzhou",
        "name": "zhuzhou",
        "parent": "hunan",
        "adcode": 430200,
        "children": [],
        "dir": "china/hunan"
      },
      "xiangtan": {
        "id": "xiangtan",
        "name": "xiangtan",
        "parent": "hunan",
        "adcode": 430300,
        "children": [],
        "dir": "china/hunan"
      },
      "hengyang": {
        "id": "hengyang",
        "name": "hengyang",
        "parent": "hunan",
        "adcode": 430400,
        "children": [],
        "dir": "china/hunan"
      },
      "shaoyang": {
        "id": "shaoyang",
        "name": "shaoyang",
        "parent": "hunan",
        "adcode": 430500,
        "children": [],
        "dir": "china/hunan"
      },
      "yueyang": {
        "id": "yueyang",
        "name": "yueyang",
        "parent": "hunan",
        "adcode": 430600,
        "children": [],
        "dir": "china/hunan"
      },
      "changde": {
        "id": "changde",
        "name": "changde",
        "parent": "hunan",
        "adcode": 430700,
        "children": [],
        "dir": "china/hunan"
      },
      "zhangjiajie": {
        "id": "zhangjiajie",
        "name": "zhangjiajie",
        "parent": "hunan",
        "adcode": 430800,
        "children": [],
        "dir": "china/hunan"
      },
      "yiyang": {
        "id": "yiyang",
        "name": "yiyang",
        "parent": "hunan",
        "adcode": 430900,
        "children": [],
        "dir": "china/hunan"
      },
      "chenzhou": {
        "id": "chenzhou",
        "name": "chenzhou",
        "parent": "hunan",
        "adcode": 431000,
        "children": [],
        "dir": "china/hunan"
      },
      "yongzhou": {
        "id": "yongzhou",
        "name": "yongzhou",
        "parent": "hunan",
        "adcode": 431100,
        "children": [],
        "dir": "china/hunan"
      },
      "huaihua": {
        "id": "huaihua",
        "name": "huaihua",
        "parent": "hunan",
        "adcode": 431200,
        "children": [],
        "dir": "china/hunan"
      },
      "loudi": {
        "id": "loudi",
        "name": "loudi",
        "parent": "hunan",
        "adcode": 431300,
        "children": [],
        "dir": "china/hunan"
      },
      "xiangxi": {
        "id": "xiangxi",
        "name": "xiangxi",
        "parent": "hunan",
        "adcode": 433100,
        "children": [],
        "dir": "china/hunan"
      },
      "guangdong": {
        "id": "guangdong",
        "name": "guangdong",
        "parent": "china",
        "adcode": 440000,
        "children": [
          "guangzhou",
          "shaoguan",
          "shenzhen",
          "zhuhai",
          "shantou",
          "foshan",
          "jiangmen",
          "zhanjiang",
          "maoming",
          "zhaoqing",
          "huizhou",
          "meizhou",
          "shanwei",
          "heyuan",
          "yangjiang",
          "qingyuan",
          "chaozhou",
          "jieyang",
          "yunfu"
        ],
        "dir": "china"
      },
      "guangzhou": {
        "id": "guangzhou",
        "name": "guangzhou",
        "parent": "guangdong",
        "adcode": 440100,
        "children": [],
        "dir": "china/guangdong"
      },
      "shaoguan": {
        "id": "shaoguan",
        "name": "shaoguan",
        "parent": "guangdong",
        "adcode": 440200,
        "children": [],
        "dir": "china/guangdong"
      },
      "shenzhen": {
        "id": "shenzhen",
        "name": "shenzhen",
        "parent": "guangdong",
        "adcode": 440300,
        "children": [],
        "dir": "china/guangdong"
      },
      "zhuhai": {
        "id": "zhuhai",
        "name": "zhuhai",
        "parent": "guangdong",
        "adcode": 440400,
        "children": [],
        "dir": "china/guangdong"
      },
      "shantou": {
        "id": "shantou",
        "name": "shantou",
        "parent": "guangdong",
        "adcode": 440500,
        "children": [],
        "dir": "china/guangdong"
      },
      "foshan": {
        "id": "foshan",
        "name": "foshan",
        "parent": "guangdong",
        "adcode": 440600,
        "children": [],
        "dir": "china/guangdong"
      },
      "jiangmen": {
        "id": "jiangmen",
        "name": "jiangmen",
        "parent": "guangdong",
        "adcode": 440700,
        "children": [],
        "dir": "china/guangdong"
      },
      "zhanjiang": {
        "id": "zhanjiang",
        "name": "zhanjiang",
        "parent": "guangdong",
        "adcode": 440800,
        "children": [],
        "dir": "china/guangdong"
      },
      "maoming": {
        "id": "maoming",
        "name": "maoming",
        "parent": "guangdong",
        "adcode": 440900,
        "children": [],
        "dir": "china/guangdong"
      },
      "zhaoqing": {
        "id": "zhaoqing",
        "name": "zhaoqing",
        "parent": "guangdong",
        "adcode": 441200,
        "children": [],
        "dir": "china/guangdong"
      },
      "huizhou": {
        "id": "huizhou",
        "name": "huizhou",
        "parent": "guangdong",
        "adcode": 441300,
        "children": [],
        "dir": "china/guangdong"
      },
      "meizhou": {
        "id": "meizhou",
        "name": "meizhou",
        "parent": "guangdong",
        "adcode": 441400,
        "children": [],
        "dir": "china/guangdong"
      },
      "shanwei": {
        "id": "shanwei",
        "name": "shanwei",
        "parent": "guangdong",
        "adcode": 441500,
        "children": [],
        "dir": "china/guangdong"
      },
      "heyuan": {
        "id": "heyuan",
        "name": "heyuan",
        "parent": "guangdong",
        "adcode": 441600,
        "children": [],
        "dir": "china/guangdong"
      },
      "yangjiang": {
        "id": "yangjiang",
        "name": "yangjiang",
        "parent": "guangdong",
        "adcode": 441700,
        "children": [],
        "dir": "china/guangdong"
      },
      "qingyuan": {
        "id": "qingyuan",
        "name": "qingyuan",
        "parent": "guangdong",
        "adcode": 441800,
        "children": [],
        "dir": "china/guangdong"
      },
      "chaozhou": {
        "id": "chaozhou",
        "name": "chaozhou",
        "parent": "guangdong",
        "adcode": 445100,
        "children": [],
        "dir": "china/guangdong"
      },
      "jieyang": {
        "id": "jieyang",
        "name": "jieyang",
        "parent": "guangdong",
        "adcode": 445200,
        "children": [],
        "dir": "china/guangdong"
      },
      "yunfu": {
        "id": "yunfu",
        "name": "yunfu",
        "parent": "guangdong",
        "adcode": 445300,
        "children": [],
        "dir": "china/guangdong"
      },
      "guangxi": {
        "id": "guangxi",
        "name": "guangxi",
        "parent": "china",
        "adcode": 450000,
        "children": [
          "nanning",
          "liuzhou",
          "guilin",
          "wuzhou",
          "beihai",
          "fangchenggang",
          "qinzhou",
          "guigang",
          "yulin",
          "baise",
          "hezhou",
          "hechi",
          "laibin",
          "chongzuo"
        ],
        "dir": "china"
      },
      "nanning": {
        "id": "nanning",
        "name": "nanning",
        "parent": "guangxi",
        "adcode": 450100,
        "children": [],
        "dir": "china/guangxi"
      },
      "liuzhou": {
        "id": "liuzhou",
        "name": "liuzhou",
        "parent": "guangxi",
        "adcode": 450200,
        "children": [],
        "dir": "china/guangxi"
      },
      "guilin": {
        "id": "guilin",
        "name": "guilin",
        "parent": "guangxi",
        "adcode": 450300,
        "children": [],
        "dir": "china/guangxi"
      },
      "wuzhou": {
        "id": "wuzhou",
        "name": "wuzhou",
        "parent": "guangxi",
        "adcode": 450400,
        "children": [],
        "dir": "china/guangxi"
      },
      "beihai": {
        "id": "beihai",
        "name": "beihai",
        "parent": "guangxi",
        "adcode": 450500,
        "children": [],
        "dir": "china/guangxi"
      },
      "fangchenggang": {
        "id": "fangchenggang",
        "name": "fangchenggang",
        "parent": "guangxi",
        "adcode": 450600,
        "children": [],
        "dir": "china/guangxi"
      },
      "qinzhou": {
        "id": "qinzhou",
        "name": "qinzhou",
        "parent": "guangxi",
        "adcode": 450700,
        "children": [],
        "dir": "china/guangxi"
      },
      "guigang": {
        "id": "guigang",
        "name": "guigang",
        "parent": "guangxi",
        "adcode": 450800,
        "children": [],
        "dir": "china/guangxi"
      },
      "yulin": {
        "id": "yulin",
        "name": "yulin",
        "parent": "guangxi",
        "adcode": 450900,
        "children": [],
        "dir": "china/guangxi"
      },
      "baise": {
        "id": "baise",
        "name": "baise",
        "parent": "guangxi",
        "adcode": 451000,
        "children": [],
        "dir": "china/guangxi"
      },
      "hezhou": {
        "id": "hezhou",
        "name": "hezhou",
        "parent": "guangxi",
        "adcode": 451100,
        "children": [],
        "dir": "china/guangxi"
      },
      "hechi": {
        "id": "hechi",
        "name": "hechi",
        "parent": "guangxi",
        "adcode": 451200,
        "children": [],
        "dir": "china/guangxi"
      },
      "laibin": {
        "id": "laibin",
        "name": "laibin",
        "parent": "guangxi",
        "adcode": 451300,
        "children": [],
        "dir": "china/guangxi"
      },
      "chongzuo": {
        "id": "chongzuo",
        "name": "chongzuo",
        "parent": "guangxi",
        "adcode": 451400,
        "children": [],
        "dir": "china/guangxi"
      },
      "hainan": {
        "id": "hainan",
        "name": "hainan",
        "parent": "china",
        "adcode": 460000,
        "children": [
          "haikou",
          "sanya",
          "sansha"
        ],
        "dir": "china"
      },
      "haikou": {
        "id": "haikou",
        "name": "haikou",
        "parent": "hainan",
        "adcode": 460100,
        "children": [],
        "dir": "china/hainan"
      },
      "sanya": {
        "id": "sanya",
        "name": "sanya",
        "parent": "hainan",
        "adcode": 460200,
        "children": [],
        "dir": "china/hainan"
      },
      "sansha": {
        "id": "sansha",
        "name": "sansha",
        "parent": "hainan",
        "adcode": 460300,
        "children": [],
        "dir": "china/hainan"
      },
      "chongqing": {
        "id": "chongqing",
        "name": "chongqing",
        "parent": "china",
        "adcode": 500000,
        "children": [],
        "dir": "china"
      },
      "sichuan": {
        "id": "sichuan",
        "name": "sichuan",
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
        "dir": "china"
      },
      "chengdu": {
        "id": "chengdu",
        "name": "成都",
        "parent": "sichuan",
        "adcode": 510100,
        "children": [],
        "dir": "china/sichuan"
      },
      "zigong": {
        "id": "zigong",
        "name": "自贡市",
        "parent": "sichuan",
        "adcode": 510300,
        "children": [],
        "dir": "china/sichuan"
      },
      "panzhihua": {
        "id": "panzhihua",
        "name": "攀枝花市",
        "parent": "sichuan",
        "adcode": 510400,
        "children": [],
        "dir": "china/sichuan"
      },
      "luzhou": {
        "id": "luzhou",
        "name": "泸州市",
        "parent": "sichuan",
        "adcode": 510500,
        "children": [],
        "dir": "china/sichuan"
      },
      "deyang": {
        "id": "deyang",
        "name": "德阳市",
        "parent": "sichuan",
        "adcode": 510600,
        "children": [],
        "dir": "china/sichuan"
      },
      "mianyang": {
        "id": "mianyang",
        "name": "绵阳市",
        "parent": "sichuan",
        "adcode": 510700,
        "children": [],
        "dir": "china/sichuan"
      },
      "guangyuan": {
        "id": "guangyuan",
        "name": "广元市",
        "parent": "sichuan",
        "adcode": 510800,
        "children": [],
        "dir": "china/sichuan"
      },
      "suining": {
        "id": "suining",
        "name": "遂宁市",
        "parent": "sichuan",
        "adcode": 510900,
        "children": [],
        "dir": "china/sichuan"
      },
      "neijiang": {
        "id": "neijiang",
        "name": "内江市",
        "parent": "sichuan",
        "adcode": 511000,
        "children": [],
        "dir": "china/sichuan"
      },
      "leshan": {
        "id": "leshan",
        "name": "乐山市",
        "parent": "sichuan",
        "adcode": 511100,
        "children": [],
        "dir": "china/sichuan"
      },
      "nanchong": {
        "id": "nanchong",
        "name": "南充市",
        "parent": "sichuan",
        "adcode": 511300,
        "children": [],
        "dir": "china/sichuan"
      },
      "meishan": {
        "id": "meishan",
        "name": "眉山市",
        "parent": "sichuan",
        "adcode": 511400,
        "children": [],
        "dir": "china/sichuan"
      },
      "yibin": {
        "id": "yibin",
        "name": "宜宾市",
        "parent": "sichuan",
        "adcode": 511500,
        "children": [],
        "dir": "china/sichuan"
      },
      "guangan": {
        "id": "guangan",
        "name": "广安市",
        "parent": "sichuan",
        "adcode": 511600,
        "children": [],
        "dir": "china/sichuan"
      },
      "dazhou": {
        "id": "dazhou",
        "name": "达州市",
        "parent": "sichuan",
        "adcode": 511700,
        "children": [],
        "dir": "china/sichuan"
      },
      "yaan": {
        "id": "yaan",
        "name": "雅安市",
        "parent": "sichuan",
        "adcode": 511800,
        "children": [],
        "dir": "china/sichuan"
      },
      "bazhong": {
        "id": "bazhong",
        "name": "巴中市",
        "parent": "sichuan",
        "adcode": 511900,
        "children": [],
        "dir": "china/sichuan"
      },
      "ziyang": {
        "id": "ziyang",
        "name": "资阳市",
        "parent": "sichuan",
        "adcode": 512000,
        "children": [],
        "dir": "china/sichuan"
      },
      "aba": {
        "id": "aba",
        "name": "阿坝藏族羌族自治州",
        "parent": "sichuan",
        "adcode": 513200,
        "children": [],
        "dir": "china/sichuan"
      },
      "ganzi": {
        "id": "ganzi",
        "name": "甘孜藏族自治州",
        "parent": "sichuan",
        "adcode": 513300,
        "children": [],
        "dir": "china/sichuan"
      },
      "liangshan": {
        "id": "liangshan",
        "name": "凉山彝族自治州",
        "parent": "sichuan",
        "adcode": 513400,
        "children": [],
        "dir": "china/sichuan"
      },
      "guizhou": {
        "id": "guizhou",
        "name": "guizhou",
        "parent": "china",
        "adcode": 520000,
        "children": [
          "guiyang",
          "liupanshui",
          "zunyi",
          "anshun",
          "bijie",
          "tongren",
          "qianxinan",
          "qiandongnan",
          "qiannan"
        ],
        "dir": "china"
      },
      "guiyang": {
        "id": "guiyang",
        "name": "guiyang",
        "parent": "guizhou",
        "adcode": 520100,
        "children": [],
        "dir": "china/guizhou"
      },
      "liupanshui": {
        "id": "liupanshui",
        "name": "liupanshui",
        "parent": "guizhou",
        "adcode": 520200,
        "children": [],
        "dir": "china/guizhou"
      },
      "zunyi": {
        "id": "zunyi",
        "name": "zunyi",
        "parent": "guizhou",
        "adcode": 520300,
        "children": [],
        "dir": "china/guizhou"
      },
      "anshun": {
        "id": "anshun",
        "name": "anshun",
        "parent": "guizhou",
        "adcode": 520400,
        "children": [],
        "dir": "china/guizhou"
      },
      "bijie": {
        "id": "bijie",
        "name": "bijie",
        "parent": "guizhou",
        "adcode": 520500,
        "children": [],
        "dir": "china/guizhou"
      },
      "tongren": {
        "id": "tongren",
        "name": "tongren",
        "parent": "guizhou",
        "adcode": 520600,
        "children": [],
        "dir": "china/guizhou"
      },
      "qianxinan": {
        "id": "qianxinan",
        "name": "qianxinan",
        "parent": "guizhou",
        "adcode": 522300,
        "children": [],
        "dir": "china/guizhou"
      },
      "qiandongnan": {
        "id": "qiandongnan",
        "name": "qiandongnan",
        "parent": "guizhou",
        "adcode": 522600,
        "children": [],
        "dir": "china/guizhou"
      },
      "qiannan": {
        "id": "qiannan",
        "name": "qiannan",
        "parent": "guizhou",
        "adcode": 522700,
        "children": [],
        "dir": "china/guizhou"
      },
      "yunnan": {
        "id": "yunnan",
        "name": "yunnan",
        "parent": "china",
        "adcode": 530000,
        "children": [
          "kunming",
          "qujing",
          "yuxi",
          "baoshanshi",
          "zhaotong",
          "lijiang",
          "puer",
          "lincang",
          "chuxiong",
          "honghe",
          "wenshan",
          "xishuangbanna",
          "dali",
          "dehong",
          "nujiang",
          "diqing"
        ],
        "dir": "china"
      },
      "kunming": {
        "id": "kunming",
        "name": "kunming",
        "parent": "yunnan",
        "adcode": 530100,
        "children": [],
        "dir": "china/yunnan"
      },
      "qujing": {
        "id": "qujing",
        "name": "qujing",
        "parent": "yunnan",
        "adcode": 530300,
        "children": [],
        "dir": "china/yunnan"
      },
      "yuxi": {
        "id": "yuxi",
        "name": "yuxi",
        "parent": "yunnan",
        "adcode": 530400,
        "children": [],
        "dir": "china/yunnan"
      },
      "baoshanshi": {
        "id": "baoshanshi",
        "name": "baoshanshi",
        "parent": "yunnan",
        "adcode": 530500,
        "children": [],
        "dir": "china/yunnan"
      },
      "zhaotong": {
        "id": "zhaotong",
        "name": "zhaotong",
        "parent": "yunnan",
        "adcode": 530600,
        "children": [],
        "dir": "china/yunnan"
      },
      "lijiang": {
        "id": "lijiang",
        "name": "lijiang",
        "parent": "yunnan",
        "adcode": 530700,
        "children": [],
        "dir": "china/yunnan"
      },
      "puer": {
        "id": "puer",
        "name": "puer",
        "parent": "yunnan",
        "adcode": 530800,
        "children": [],
        "dir": "china/yunnan"
      },
      "lincang": {
        "id": "lincang",
        "name": "lincang",
        "parent": "yunnan",
        "adcode": 530900,
        "children": [],
        "dir": "china/yunnan"
      },
      "chuxiong": {
        "id": "chuxiong",
        "name": "chuxiong",
        "parent": "yunnan",
        "adcode": 532300,
        "children": [],
        "dir": "china/yunnan"
      },
      "honghe": {
        "id": "honghe",
        "name": "honghe",
        "parent": "yunnan",
        "adcode": 532500,
        "children": [],
        "dir": "china/yunnan"
      },
      "wenshan": {
        "id": "wenshan",
        "name": "wenshan",
        "parent": "yunnan",
        "adcode": 532600,
        "children": [],
        "dir": "china/yunnan"
      },
      "xishuangbanna": {
        "id": "xishuangbanna",
        "name": "xishuangbanna",
        "parent": "yunnan",
        "adcode": 532800,
        "children": [],
        "dir": "china/yunnan"
      },
      "dali": {
        "id": "dali",
        "name": "dali",
        "parent": "yunnan",
        "adcode": 532900,
        "children": [],
        "dir": "china/yunnan"
      },
      "dehong": {
        "id": "dehong",
        "name": "dehong",
        "parent": "yunnan",
        "adcode": 533100,
        "children": [],
        "dir": "china/yunnan"
      },
      "nujiang": {
        "id": "nujiang",
        "name": "nujiang",
        "parent": "yunnan",
        "adcode": 533300,
        "children": [],
        "dir": "china/yunnan"
      },
      "diqing": {
        "id": "diqing",
        "name": "diqing",
        "parent": "yunnan",
        "adcode": 533400,
        "children": [],
        "dir": "china/yunnan"
      },
      "xizang": {
        "id": "xizang",
        "name": "xizang",
        "parent": "china",
        "adcode": 540000,
        "children": [
          "lasa",
          "rikaze",
          "changdou",
          "linzhi",
          "shannan",
          "naqu",
          "ali"
        ],
        "dir": "china"
      },
      "lasa": {
        "id": "lasa",
        "name": "lasa",
        "parent": "xizang",
        "adcode": 540100,
        "children": [],
        "dir": "china/xizang"
      },
      "rikaze": {
        "id": "rikaze",
        "name": "rikaze",
        "parent": "xizang",
        "adcode": 540200,
        "children": [],
        "dir": "china/xizang"
      },
      "changdou": {
        "id": "changdou",
        "name": "changdou",
        "parent": "xizang",
        "adcode": 540300,
        "children": [],
        "dir": "china/xizang"
      },
      "linzhi": {
        "id": "linzhi",
        "name": "linzhi",
        "parent": "xizang",
        "adcode": 540400,
        "children": [],
        "dir": "china/xizang"
      },
      "shannan": {
        "id": "shannan",
        "name": "shannan",
        "parent": "xizang",
        "adcode": 540500,
        "children": [],
        "dir": "china/xizang"
      },
      "naqu": {
        "id": "naqu",
        "name": "naqu",
        "parent": "xizang",
        "adcode": 540600,
        "children": [],
        "dir": "china/xizang"
      },
      "ali": {
        "id": "ali",
        "name": "ali",
        "parent": "xizang",
        "adcode": 542500,
        "children": [],
        "dir": "china/xizang"
      },
      "shaanxi": {
        "id": "shaanxi",
        "name": "shaanxi",
        "parent": "china",
        "adcode": 610000,
        "children": [
          "xian",
          "tongchuan",
          "baoji",
          "xianyang",
          "weinan",
          "yanan",
          "hanzhong",
          "yulinshi",
          "ankang",
          "shangluo"
        ],
        "dir": "china"
      },
      "xian": {
        "id": "xian",
        "name": "xian",
        "parent": "shaanxi",
        "adcode": 610100,
        "children": [],
        "dir": "china/shaanxi"
      },
      "tongchuan": {
        "id": "tongchuan",
        "name": "tongchuan",
        "parent": "shaanxi",
        "adcode": 610200,
        "children": [],
        "dir": "china/shaanxi"
      },
      "baoji": {
        "id": "baoji",
        "name": "baoji",
        "parent": "shaanxi",
        "adcode": 610300,
        "children": [],
        "dir": "china/shaanxi"
      },
      "xianyang": {
        "id": "xianyang",
        "name": "xianyang",
        "parent": "shaanxi",
        "adcode": 610400,
        "children": [],
        "dir": "china/shaanxi"
      },
      "weinan": {
        "id": "weinan",
        "name": "weinan",
        "parent": "shaanxi",
        "adcode": 610500,
        "children": [],
        "dir": "china/shaanxi"
      },
      "yanan": {
        "id": "yanan",
        "name": "yanan",
        "parent": "shaanxi",
        "adcode": 610600,
        "children": [],
        "dir": "china/shaanxi"
      },
      "hanzhong": {
        "id": "hanzhong",
        "name": "hanzhong",
        "parent": "shaanxi",
        "adcode": 610700,
        "children": [],
        "dir": "china/shaanxi"
      },
      "yulinshi": {
        "id": "yulinshi",
        "name": "yulinshi",
        "parent": "shaanxi",
        "adcode": 610800,
        "children": [],
        "dir": "china/shaanxi"
      },
      "ankang": {
        "id": "ankang",
        "name": "ankang",
        "parent": "shaanxi",
        "adcode": 610900,
        "children": [],
        "dir": "china/shaanxi"
      },
      "shangluo": {
        "id": "shangluo",
        "name": "shangluo",
        "parent": "shaanxi",
        "adcode": 611000,
        "children": [],
        "dir": "china/shaanxi"
      },
      "gansu": {
        "id": "gansu",
        "name": "gansu",
        "parent": "china",
        "adcode": 620000,
        "children": [
          "lanzhou",
          "jinchang",
          "baiyin",
          "tianshui",
          "wuwei",
          "zhangye",
          "pingliang",
          "jiuquan",
          "qingyang",
          "dingxi",
          "longnan",
          "linxia",
          "gannan"
        ],
        "dir": "china"
      },
      "lanzhou": {
        "id": "lanzhou",
        "name": "lanzhou",
        "parent": "gansu",
        "adcode": 620100,
        "children": [],
        "dir": "china/gansu"
      },
      "jinchang": {
        "id": "jinchang",
        "name": "jinchang",
        "parent": "gansu",
        "adcode": 620300,
        "children": [],
        "dir": "china/gansu"
      },
      "baiyin": {
        "id": "baiyin",
        "name": "baiyin",
        "parent": "gansu",
        "adcode": 620400,
        "children": [],
        "dir": "china/gansu"
      },
      "tianshui": {
        "id": "tianshui",
        "name": "tianshui",
        "parent": "gansu",
        "adcode": 620500,
        "children": [],
        "dir": "china/gansu"
      },
      "wuwei": {
        "id": "wuwei",
        "name": "wuwei",
        "parent": "gansu",
        "adcode": 620600,
        "children": [],
        "dir": "china/gansu"
      },
      "zhangye": {
        "id": "zhangye",
        "name": "zhangye",
        "parent": "gansu",
        "adcode": 620700,
        "children": [],
        "dir": "china/gansu"
      },
      "pingliang": {
        "id": "pingliang",
        "name": "pingliang",
        "parent": "gansu",
        "adcode": 620800,
        "children": [],
        "dir": "china/gansu"
      },
      "jiuquan": {
        "id": "jiuquan",
        "name": "jiuquan",
        "parent": "gansu",
        "adcode": 620900,
        "children": [],
        "dir": "china/gansu"
      },
      "qingyang": {
        "id": "qingyang",
        "name": "qingyang",
        "parent": "gansu",
        "adcode": 621000,
        "children": [],
        "dir": "china/gansu"
      },
      "dingxi": {
        "id": "dingxi",
        "name": "dingxi",
        "parent": "gansu",
        "adcode": 621100,
        "children": [],
        "dir": "china/gansu"
      },
      "longnan": {
        "id": "longnan",
        "name": "longnan",
        "parent": "gansu",
        "adcode": 621200,
        "children": [],
        "dir": "china/gansu"
      },
      "linxia": {
        "id": "linxia",
        "name": "linxia",
        "parent": "gansu",
        "adcode": 622900,
        "children": [],
        "dir": "china/gansu"
      },
      "gannan": {
        "id": "gannan",
        "name": "gannan",
        "parent": "gansu",
        "adcode": 623000,
        "children": [],
        "dir": "china/gansu"
      },
      "qinghai": {
        "id": "qinghai",
        "name": "qinghai",
        "parent": "china",
        "adcode": 630000,
        "children": [
          "xining",
          "haidong",
          "haibei",
          "huangnan",
          "hainanzhou",
          "guoluo",
          "yushu",
          "haixi"
        ],
        "dir": "china"
      },
      "xining": {
        "id": "xining",
        "name": "xining",
        "parent": "qinghai",
        "adcode": 630100,
        "children": [],
        "dir": "china/qinghai"
      },
      "haidong": {
        "id": "haidong",
        "name": "haidong",
        "parent": "qinghai",
        "adcode": 630200,
        "children": [],
        "dir": "china/qinghai"
      },
      "haibei": {
        "id": "haibei",
        "name": "haibei",
        "parent": "qinghai",
        "adcode": 632200,
        "children": [],
        "dir": "china/qinghai"
      },
      "huangnan": {
        "id": "huangnan",
        "name": "huangnan",
        "parent": "qinghai",
        "adcode": 632300,
        "children": [],
        "dir": "china/qinghai"
      },
      "hainanzhou": {
        "id": "hainanzhou",
        "name": "hainanzhou",
        "parent": "qinghai",
        "adcode": 632500,
        "children": [],
        "dir": "china/qinghai"
      },
      "guoluo": {
        "id": "guoluo",
        "name": "guoluo",
        "parent": "qinghai",
        "adcode": 632600,
        "children": [],
        "dir": "china/qinghai"
      },
      "yushu": {
        "id": "yushu",
        "name": "yushu",
        "parent": "qinghai",
        "adcode": 632700,
        "children": [],
        "dir": "china/qinghai"
      },
      "haixi": {
        "id": "haixi",
        "name": "haixi",
        "parent": "qinghai",
        "adcode": 632800,
        "children": [],
        "dir": "china/qinghai"
      },
      "ningxia": {
        "id": "ningxia",
        "name": "ningxia",
        "parent": "china",
        "adcode": 640000,
        "children": [
          "yinchuan",
          "shizuishan",
          "wuzhong",
          "guyuan",
          "zhongwei"
        ],
        "dir": "china"
      },
      "yinchuan": {
        "id": "yinchuan",
        "name": "yinchuan",
        "parent": "ningxia",
        "adcode": 640100,
        "children": [],
        "dir": "china/ningxia"
      },
      "shizuishan": {
        "id": "shizuishan",
        "name": "shizuishan",
        "parent": "ningxia",
        "adcode": 640200,
        "children": [],
        "dir": "china/ningxia"
      },
      "wuzhong": {
        "id": "wuzhong",
        "name": "wuzhong",
        "parent": "ningxia",
        "adcode": 640300,
        "children": [],
        "dir": "china/ningxia"
      },
      "guyuan": {
        "id": "guyuan",
        "name": "guyuan",
        "parent": "ningxia",
        "adcode": 640400,
        "children": [],
        "dir": "china/ningxia"
      },
      "zhongwei": {
        "id": "zhongwei",
        "name": "zhongwei",
        "parent": "ningxia",
        "adcode": 640500,
        "children": [],
        "dir": "china/ningxia"
      },
      "xinjiang": {
        "id": "xinjiang",
        "name": "xinjiang",
        "parent": "china",
        "adcode": 650000,
        "children": [
          "wulumuqi",
          "kelamayi",
          "tulufan",
          "hami",
          "changji",
          "boertala",
          "bayinguoleng",
          "akesu",
          "kezilesukeerkezi",
          "kashen",
          "hetian",
          "yilihasake",
          "tacheng",
          "aletai"
        ],
        "dir": "china"
      },
      "wulumuqi": {
        "id": "wulumuqi",
        "name": "wulumuqi",
        "parent": "xinjiang",
        "adcode": 650100,
        "children": [],
        "dir": "china/xinjiang"
      },
      "kelamayi": {
        "id": "kelamayi",
        "name": "kelamayi",
        "parent": "xinjiang",
        "adcode": 650200,
        "children": [],
        "dir": "china/xinjiang"
      },
      "tulufan": {
        "id": "tulufan",
        "name": "tulufan",
        "parent": "xinjiang",
        "adcode": 650400,
        "children": [],
        "dir": "china/xinjiang"
      },
      "hami": {
        "id": "hami",
        "name": "hami",
        "parent": "xinjiang",
        "adcode": 650500,
        "children": [],
        "dir": "china/xinjiang"
      },
      "changji": {
        "id": "changji",
        "name": "changji",
        "parent": "xinjiang",
        "adcode": 652300,
        "children": [],
        "dir": "china/xinjiang"
      },
      "boertala": {
        "id": "boertala",
        "name": "boertala",
        "parent": "xinjiang",
        "adcode": 652700,
        "children": [],
        "dir": "china/xinjiang"
      },
      "bayinguoleng": {
        "id": "bayinguoleng",
        "name": "bayinguoleng",
        "parent": "xinjiang",
        "adcode": 652800,
        "children": [],
        "dir": "china/xinjiang"
      },
      "akesu": {
        "id": "akesu",
        "name": "akesu",
        "parent": "xinjiang",
        "adcode": 652900,
        "children": [],
        "dir": "china/xinjiang"
      },
      "kezilesukeerkezi": {
        "id": "kezilesukeerkezi",
        "name": "kezilesukeerkezi",
        "parent": "xinjiang",
        "adcode": 653000,
        "children": [],
        "dir": "china/xinjiang"
      },
      "kashen": {
        "id": "kashen",
        "name": "kashen",
        "parent": "xinjiang",
        "adcode": 653100,
        "children": [],
        "dir": "china/xinjiang"
      },
      "hetian": {
        "id": "hetian",
        "name": "hetian",
        "parent": "xinjiang",
        "adcode": 653200,
        "children": [],
        "dir": "china/xinjiang"
      },
      "yilihasake": {
        "id": "yilihasake",
        "name": "yilihasake",
        "parent": "xinjiang",
        "adcode": 654000,
        "children": [],
        "dir": "china/xinjiang"
      },
      "tacheng": {
        "id": "tacheng",
        "name": "tacheng",
        "parent": "xinjiang",
        "adcode": 654200,
        "children": [],
        "dir": "china/xinjiang"
      },
      "aletai": {
        "id": "aletai",
        "name": "aletai",
        "parent": "xinjiang",
        "adcode": 654300,
        "children": [],
        "dir": "china/xinjiang"
      },
      "taiwan": {
        "id": "taiwan",
        "name": "taiwan",
        "parent": "china",
        "adcode": 710000,
        "children": [],
        "dir": "china"
      },
      "hongkong": {
        "id": "hongkong",
        "name": "hongkong",
        "parent": "china",
        "adcode": 810000,
        "children": [],
        "dir": "china"
      }
    }
  };
  /* ↑↑↑ 生成内容结束 ↑↑↑ */

  global.MAP_REGISTRY = REGISTRY;
})(window);
