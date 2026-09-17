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
        "name": "中华人民共和国",
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
        "name": "北京市",
        "parent": "china",
        "adcode": 110000,
        "children": [],
        "dir": "china"
      },
      "tianjin": {
        "id": "tianjin",
        "name": "天津市",
        "parent": "china",
        "adcode": 120000,
        "children": [],
        "dir": "china"
      },
      "hebei": {
        "id": "hebei",
        "name": "河北省",
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
        "name": "石家庄市",
        "parent": "hebei",
        "adcode": 130100,
        "children": [],
        "dir": "china/hebei"
      },
      "tangshan": {
        "id": "tangshan",
        "name": "唐山市",
        "parent": "hebei",
        "adcode": 130200,
        "children": [],
        "dir": "china/hebei"
      },
      "qinhuangdao": {
        "id": "qinhuangdao",
        "name": "秦皇岛市",
        "parent": "hebei",
        "adcode": 130300,
        "children": [],
        "dir": "china/hebei"
      },
      "handan": {
        "id": "handan",
        "name": "邯郸市",
        "parent": "hebei",
        "adcode": 130400,
        "children": [],
        "dir": "china/hebei"
      },
      "xingtai": {
        "id": "xingtai",
        "name": "邢台市",
        "parent": "hebei",
        "adcode": 130500,
        "children": [],
        "dir": "china/hebei"
      },
      "baoding": {
        "id": "baoding",
        "name": "保定市",
        "parent": "hebei",
        "adcode": 130600,
        "children": [],
        "dir": "china/hebei"
      },
      "zhangjiakou": {
        "id": "zhangjiakou",
        "name": "张家口市",
        "parent": "hebei",
        "adcode": 130700,
        "children": [],
        "dir": "china/hebei"
      },
      "chengde": {
        "id": "chengde",
        "name": "承德市",
        "parent": "hebei",
        "adcode": 130800,
        "children": [],
        "dir": "china/hebei"
      },
      "cangzhou": {
        "id": "cangzhou",
        "name": "沧州市",
        "parent": "hebei",
        "adcode": 130900,
        "children": [],
        "dir": "china/hebei"
      },
      "langfang": {
        "id": "langfang",
        "name": "廊坊市",
        "parent": "hebei",
        "adcode": 131000,
        "children": [],
        "dir": "china/hebei"
      },
      "hengshui": {
        "id": "hengshui",
        "name": "衡水市",
        "parent": "hebei",
        "adcode": 131100,
        "children": [],
        "dir": "china/hebei"
      },
      "shanxi": {
        "id": "shanxi",
        "name": "山西省",
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
        "name": "太原市",
        "parent": "shanxi",
        "adcode": 140100,
        "children": [],
        "dir": "china/shanxi"
      },
      "datong": {
        "id": "datong",
        "name": "大同市",
        "parent": "shanxi",
        "adcode": 140200,
        "children": [],
        "dir": "china/shanxi"
      },
      "yangquan": {
        "id": "yangquan",
        "name": "阳泉市",
        "parent": "shanxi",
        "adcode": 140300,
        "children": [],
        "dir": "china/shanxi"
      },
      "changzhi": {
        "id": "changzhi",
        "name": "长治市",
        "parent": "shanxi",
        "adcode": 140400,
        "children": [],
        "dir": "china/shanxi"
      },
      "jincheng": {
        "id": "jincheng",
        "name": "晋城市",
        "parent": "shanxi",
        "adcode": 140500,
        "children": [],
        "dir": "china/shanxi"
      },
      "shuozhou": {
        "id": "shuozhou",
        "name": "朔州市",
        "parent": "shanxi",
        "adcode": 140600,
        "children": [],
        "dir": "china/shanxi"
      },
      "jinzhong": {
        "id": "jinzhong",
        "name": "晋中市",
        "parent": "shanxi",
        "adcode": 140700,
        "children": [],
        "dir": "china/shanxi"
      },
      "yuncheng": {
        "id": "yuncheng",
        "name": "运城市",
        "parent": "shanxi",
        "adcode": 140800,
        "children": [],
        "dir": "china/shanxi"
      },
      "xinzhou": {
        "id": "xinzhou",
        "name": "忻州市",
        "parent": "shanxi",
        "adcode": 140900,
        "children": [],
        "dir": "china/shanxi"
      },
      "linfen": {
        "id": "linfen",
        "name": "临汾市",
        "parent": "shanxi",
        "adcode": 141000,
        "children": [],
        "dir": "china/shanxi"
      },
      "lliang": {
        "id": "lliang",
        "name": "吕梁市",
        "parent": "shanxi",
        "adcode": 141100,
        "children": [],
        "dir": "china/shanxi"
      },
      "neimenggu": {
        "id": "neimenggu",
        "name": "内蒙古自治区",
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
        "name": "呼和浩特市",
        "parent": "neimenggu",
        "adcode": 150100,
        "children": [],
        "dir": "china/neimenggu"
      },
      "baotou": {
        "id": "baotou",
        "name": "包头市",
        "parent": "neimenggu",
        "adcode": 150200,
        "children": [],
        "dir": "china/neimenggu"
      },
      "wuhai": {
        "id": "wuhai",
        "name": "乌海市",
        "parent": "neimenggu",
        "adcode": 150300,
        "children": [],
        "dir": "china/neimenggu"
      },
      "chifeng": {
        "id": "chifeng",
        "name": "赤峰市",
        "parent": "neimenggu",
        "adcode": 150400,
        "children": [],
        "dir": "china/neimenggu"
      },
      "tongliao": {
        "id": "tongliao",
        "name": "通辽市",
        "parent": "neimenggu",
        "adcode": 150500,
        "children": [],
        "dir": "china/neimenggu"
      },
      "eerduosi": {
        "id": "eerduosi",
        "name": "鄂尔多斯市",
        "parent": "neimenggu",
        "adcode": 150600,
        "children": [],
        "dir": "china/neimenggu"
      },
      "hulunbeier": {
        "id": "hulunbeier",
        "name": "呼伦贝尔市",
        "parent": "neimenggu",
        "adcode": 150700,
        "children": [],
        "dir": "china/neimenggu"
      },
      "bayannaoer": {
        "id": "bayannaoer",
        "name": "巴彦淖尔市",
        "parent": "neimenggu",
        "adcode": 150800,
        "children": [],
        "dir": "china/neimenggu"
      },
      "wulanchabu": {
        "id": "wulanchabu",
        "name": "乌兰察布市",
        "parent": "neimenggu",
        "adcode": 150900,
        "children": [],
        "dir": "china/neimenggu"
      },
      "xingan": {
        "id": "xingan",
        "name": "兴安盟",
        "parent": "neimenggu",
        "adcode": 152200,
        "children": [],
        "dir": "china/neimenggu"
      },
      "xilinguole": {
        "id": "xilinguole",
        "name": "锡林郭勒盟",
        "parent": "neimenggu",
        "adcode": 152500,
        "children": [],
        "dir": "china/neimenggu"
      },
      "alashan": {
        "id": "alashan",
        "name": "阿拉善盟",
        "parent": "neimenggu",
        "adcode": 152900,
        "children": [],
        "dir": "china/neimenggu"
      },
      "liaoning": {
        "id": "liaoning",
        "name": "辽宁省",
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
        "name": "沈阳市",
        "parent": "liaoning",
        "adcode": 210100,
        "children": [],
        "dir": "china/liaoning"
      },
      "dalian": {
        "id": "dalian",
        "name": "大连市",
        "parent": "liaoning",
        "adcode": 210200,
        "children": [],
        "dir": "china/liaoning"
      },
      "anshan": {
        "id": "anshan",
        "name": "鞍山市",
        "parent": "liaoning",
        "adcode": 210300,
        "children": [],
        "dir": "china/liaoning"
      },
      "fushun": {
        "id": "fushun",
        "name": "抚顺市",
        "parent": "liaoning",
        "adcode": 210400,
        "children": [],
        "dir": "china/liaoning"
      },
      "benxi": {
        "id": "benxi",
        "name": "本溪市",
        "parent": "liaoning",
        "adcode": 210500,
        "children": [],
        "dir": "china/liaoning"
      },
      "dandong": {
        "id": "dandong",
        "name": "丹东市",
        "parent": "liaoning",
        "adcode": 210600,
        "children": [],
        "dir": "china/liaoning"
      },
      "jinzhou": {
        "id": "jinzhou",
        "name": "锦州市",
        "parent": "liaoning",
        "adcode": 210700,
        "children": [],
        "dir": "china/liaoning"
      },
      "yingkou": {
        "id": "yingkou",
        "name": "营口市",
        "parent": "liaoning",
        "adcode": 210800,
        "children": [],
        "dir": "china/liaoning"
      },
      "fuxin": {
        "id": "fuxin",
        "name": "阜新市",
        "parent": "liaoning",
        "adcode": 210900,
        "children": [],
        "dir": "china/liaoning"
      },
      "liaoyang": {
        "id": "liaoyang",
        "name": "辽阳市",
        "parent": "liaoning",
        "adcode": 211000,
        "children": [],
        "dir": "china/liaoning"
      },
      "panjin": {
        "id": "panjin",
        "name": "盘锦市",
        "parent": "liaoning",
        "adcode": 211100,
        "children": [],
        "dir": "china/liaoning"
      },
      "tieling": {
        "id": "tieling",
        "name": "铁岭市",
        "parent": "liaoning",
        "adcode": 211200,
        "children": [],
        "dir": "china/liaoning"
      },
      "chaoyangshi": {
        "id": "chaoyangshi",
        "name": "朝阳市",
        "parent": "liaoning",
        "adcode": 211300,
        "children": [],
        "dir": "china/liaoning"
      },
      "huludao": {
        "id": "huludao",
        "name": "葫芦岛市",
        "parent": "liaoning",
        "adcode": 211400,
        "children": [],
        "dir": "china/liaoning"
      },
      "jilin": {
        "id": "jilin",
        "name": "吉林省",
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
        "name": "长春市",
        "parent": "jilin",
        "adcode": 220100,
        "children": [],
        "dir": "china/jilin"
      },
      "jilinshi": {
        "id": "jilinshi",
        "name": "吉林市",
        "parent": "jilin",
        "adcode": 220200,
        "children": [],
        "dir": "china/jilin"
      },
      "siping": {
        "id": "siping",
        "name": "四平市",
        "parent": "jilin",
        "adcode": 220300,
        "children": [],
        "dir": "china/jilin"
      },
      "liaoyuan": {
        "id": "liaoyuan",
        "name": "辽源市",
        "parent": "jilin",
        "adcode": 220400,
        "children": [],
        "dir": "china/jilin"
      },
      "tonghua": {
        "id": "tonghua",
        "name": "通化市",
        "parent": "jilin",
        "adcode": 220500,
        "children": [],
        "dir": "china/jilin"
      },
      "baishan": {
        "id": "baishan",
        "name": "白山市",
        "parent": "jilin",
        "adcode": 220600,
        "children": [],
        "dir": "china/jilin"
      },
      "songyuan": {
        "id": "songyuan",
        "name": "松原市",
        "parent": "jilin",
        "adcode": 220700,
        "children": [],
        "dir": "china/jilin"
      },
      "baicheng": {
        "id": "baicheng",
        "name": "白城市",
        "parent": "jilin",
        "adcode": 220800,
        "children": [],
        "dir": "china/jilin"
      },
      "yanbian": {
        "id": "yanbian",
        "name": "延边朝鲜族自治州",
        "parent": "jilin",
        "adcode": 222400,
        "children": [],
        "dir": "china/jilin"
      },
      "heilongjiang": {
        "id": "heilongjiang",
        "name": "黑龙江省",
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
        "name": "哈尔滨市",
        "parent": "heilongjiang",
        "adcode": 230100,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "qiqihaer": {
        "id": "qiqihaer",
        "name": "齐齐哈尔市",
        "parent": "heilongjiang",
        "adcode": 230200,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "jixi": {
        "id": "jixi",
        "name": "鸡西市",
        "parent": "heilongjiang",
        "adcode": 230300,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "hegang": {
        "id": "hegang",
        "name": "鹤岗市",
        "parent": "heilongjiang",
        "adcode": 230400,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "shuangyashan": {
        "id": "shuangyashan",
        "name": "双鸭山市",
        "parent": "heilongjiang",
        "adcode": 230500,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "daqing": {
        "id": "daqing",
        "name": "大庆市",
        "parent": "heilongjiang",
        "adcode": 230600,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "yichun": {
        "id": "yichun",
        "name": "伊春市",
        "parent": "heilongjiang",
        "adcode": 230700,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "jiamusi": {
        "id": "jiamusi",
        "name": "佳木斯市",
        "parent": "heilongjiang",
        "adcode": 230800,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "qitaihe": {
        "id": "qitaihe",
        "name": "七台河市",
        "parent": "heilongjiang",
        "adcode": 230900,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "mudanjiang": {
        "id": "mudanjiang",
        "name": "牡丹江市",
        "parent": "heilongjiang",
        "adcode": 231000,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "heihe": {
        "id": "heihe",
        "name": "黑河市",
        "parent": "heilongjiang",
        "adcode": 231100,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "suihua": {
        "id": "suihua",
        "name": "绥化市",
        "parent": "heilongjiang",
        "adcode": 231200,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "daxinganling": {
        "id": "daxinganling",
        "name": "大兴安岭地区",
        "parent": "heilongjiang",
        "adcode": 232700,
        "children": [],
        "dir": "china/heilongjiang"
      },
      "shanghai": {
        "id": "shanghai",
        "name": "上海市",
        "parent": "china",
        "adcode": 310000,
        "children": [],
        "dir": "china"
      },
      "jiangsu": {
        "id": "jiangsu",
        "name": "江苏省",
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
        "name": "南京市",
        "parent": "jiangsu",
        "adcode": 320100,
        "children": [],
        "dir": "china/jiangsu"
      },
      "wuxi": {
        "id": "wuxi",
        "name": "无锡市",
        "parent": "jiangsu",
        "adcode": 320200,
        "children": [],
        "dir": "china/jiangsu"
      },
      "xuzhou": {
        "id": "xuzhou",
        "name": "徐州市",
        "parent": "jiangsu",
        "adcode": 320300,
        "children": [],
        "dir": "china/jiangsu"
      },
      "changzhou": {
        "id": "changzhou",
        "name": "常州市",
        "parent": "jiangsu",
        "adcode": 320400,
        "children": [],
        "dir": "china/jiangsu"
      },
      "suzhou": {
        "id": "suzhou",
        "name": "苏州市",
        "parent": "jiangsu",
        "adcode": 320500,
        "children": [],
        "dir": "china/jiangsu"
      },
      "nantong": {
        "id": "nantong",
        "name": "南通市",
        "parent": "jiangsu",
        "adcode": 320600,
        "children": [],
        "dir": "china/jiangsu"
      },
      "lianyungang": {
        "id": "lianyungang",
        "name": "连云港市",
        "parent": "jiangsu",
        "adcode": 320700,
        "children": [],
        "dir": "china/jiangsu"
      },
      "huaian": {
        "id": "huaian",
        "name": "淮安市",
        "parent": "jiangsu",
        "adcode": 320800,
        "children": [],
        "dir": "china/jiangsu"
      },
      "yancheng": {
        "id": "yancheng",
        "name": "盐城市",
        "parent": "jiangsu",
        "adcode": 320900,
        "children": [],
        "dir": "china/jiangsu"
      },
      "yangzhou": {
        "id": "yangzhou",
        "name": "扬州市",
        "parent": "jiangsu",
        "adcode": 321000,
        "children": [],
        "dir": "china/jiangsu"
      },
      "zhenjiang": {
        "id": "zhenjiang",
        "name": "镇江市",
        "parent": "jiangsu",
        "adcode": 321100,
        "children": [],
        "dir": "china/jiangsu"
      },
      "taizhou": {
        "id": "taizhou",
        "name": "泰州市",
        "parent": "jiangsu",
        "adcode": 321200,
        "children": [],
        "dir": "china/jiangsu"
      },
      "suqian": {
        "id": "suqian",
        "name": "宿迁市",
        "parent": "jiangsu",
        "adcode": 321300,
        "children": [],
        "dir": "china/jiangsu"
      },
      "zhejiang": {
        "id": "zhejiang",
        "name": "浙江省",
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
        "name": "杭州市",
        "parent": "zhejiang",
        "adcode": 330100,
        "children": [],
        "dir": "china/zhejiang"
      },
      "ningbo": {
        "id": "ningbo",
        "name": "宁波市",
        "parent": "zhejiang",
        "adcode": 330200,
        "children": [],
        "dir": "china/zhejiang"
      },
      "wenzhou": {
        "id": "wenzhou",
        "name": "温州市",
        "parent": "zhejiang",
        "adcode": 330300,
        "children": [],
        "dir": "china/zhejiang"
      },
      "jiaxing": {
        "id": "jiaxing",
        "name": "嘉兴市",
        "parent": "zhejiang",
        "adcode": 330400,
        "children": [],
        "dir": "china/zhejiang"
      },
      "huzhou": {
        "id": "huzhou",
        "name": "湖州市",
        "parent": "zhejiang",
        "adcode": 330500,
        "children": [],
        "dir": "china/zhejiang"
      },
      "shaoxing": {
        "id": "shaoxing",
        "name": "绍兴市",
        "parent": "zhejiang",
        "adcode": 330600,
        "children": [],
        "dir": "china/zhejiang"
      },
      "jinhua": {
        "id": "jinhua",
        "name": "金华市",
        "parent": "zhejiang",
        "adcode": 330700,
        "children": [],
        "dir": "china/zhejiang"
      },
      "quzhou": {
        "id": "quzhou",
        "name": "衢州市",
        "parent": "zhejiang",
        "adcode": 330800,
        "children": [],
        "dir": "china/zhejiang"
      },
      "zhoushan": {
        "id": "zhoushan",
        "name": "舟山市",
        "parent": "zhejiang",
        "adcode": 330900,
        "children": [],
        "dir": "china/zhejiang"
      },
      "taizhoushi": {
        "id": "taizhoushi",
        "name": "台州市",
        "parent": "zhejiang",
        "adcode": 331000,
        "children": [],
        "dir": "china/zhejiang"
      },
      "lishui": {
        "id": "lishui",
        "name": "丽水市",
        "parent": "zhejiang",
        "adcode": 331100,
        "children": [],
        "dir": "china/zhejiang"
      },
      "anhui": {
        "id": "anhui",
        "name": "安徽省",
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
        "name": "合肥市",
        "parent": "anhui",
        "adcode": 340100,
        "children": [],
        "dir": "china/anhui"
      },
      "wuhu": {
        "id": "wuhu",
        "name": "芜湖市",
        "parent": "anhui",
        "adcode": 340200,
        "children": [],
        "dir": "china/anhui"
      },
      "bengbu": {
        "id": "bengbu",
        "name": "蚌埠市",
        "parent": "anhui",
        "adcode": 340300,
        "children": [],
        "dir": "china/anhui"
      },
      "huainan": {
        "id": "huainan",
        "name": "淮南市",
        "parent": "anhui",
        "adcode": 340400,
        "children": [],
        "dir": "china/anhui"
      },
      "maanshan": {
        "id": "maanshan",
        "name": "马鞍山市",
        "parent": "anhui",
        "adcode": 340500,
        "children": [],
        "dir": "china/anhui"
      },
      "huaibei": {
        "id": "huaibei",
        "name": "淮北市",
        "parent": "anhui",
        "adcode": 340600,
        "children": [],
        "dir": "china/anhui"
      },
      "tongling": {
        "id": "tongling",
        "name": "铜陵市",
        "parent": "anhui",
        "adcode": 340700,
        "children": [],
        "dir": "china/anhui"
      },
      "anqing": {
        "id": "anqing",
        "name": "安庆市",
        "parent": "anhui",
        "adcode": 340800,
        "children": [],
        "dir": "china/anhui"
      },
      "huangshan": {
        "id": "huangshan",
        "name": "黄山市",
        "parent": "anhui",
        "adcode": 341000,
        "children": [],
        "dir": "china/anhui"
      },
      "chuzhou": {
        "id": "chuzhou",
        "name": "滁州市",
        "parent": "anhui",
        "adcode": 341100,
        "children": [],
        "dir": "china/anhui"
      },
      "fuyang": {
        "id": "fuyang",
        "name": "阜阳市",
        "parent": "anhui",
        "adcode": 341200,
        "children": [],
        "dir": "china/anhui"
      },
      "suzhoushi": {
        "id": "suzhoushi",
        "name": "宿州市",
        "parent": "anhui",
        "adcode": 341300,
        "children": [],
        "dir": "china/anhui"
      },
      "luan": {
        "id": "luan",
        "name": "六安市",
        "parent": "anhui",
        "adcode": 341500,
        "children": [],
        "dir": "china/anhui"
      },
      "bozhou": {
        "id": "bozhou",
        "name": "亳州市",
        "parent": "anhui",
        "adcode": 341600,
        "children": [],
        "dir": "china/anhui"
      },
      "chizhou": {
        "id": "chizhou",
        "name": "池州市",
        "parent": "anhui",
        "adcode": 341700,
        "children": [],
        "dir": "china/anhui"
      },
      "xuancheng": {
        "id": "xuancheng",
        "name": "宣城市",
        "parent": "anhui",
        "adcode": 341800,
        "children": [],
        "dir": "china/anhui"
      },
      "fujian": {
        "id": "fujian",
        "name": "福建省",
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
        "name": "福州市",
        "parent": "fujian",
        "adcode": 350100,
        "children": [],
        "dir": "china/fujian"
      },
      "xiamen": {
        "id": "xiamen",
        "name": "厦门市",
        "parent": "fujian",
        "adcode": 350200,
        "children": [],
        "dir": "china/fujian"
      },
      "putian": {
        "id": "putian",
        "name": "莆田市",
        "parent": "fujian",
        "adcode": 350300,
        "children": [],
        "dir": "china/fujian"
      },
      "sanming": {
        "id": "sanming",
        "name": "三明市",
        "parent": "fujian",
        "adcode": 350400,
        "children": [],
        "dir": "china/fujian"
      },
      "quanzhou": {
        "id": "quanzhou",
        "name": "泉州市",
        "parent": "fujian",
        "adcode": 350500,
        "children": [],
        "dir": "china/fujian"
      },
      "zhangzhou": {
        "id": "zhangzhou",
        "name": "漳州市",
        "parent": "fujian",
        "adcode": 350600,
        "children": [],
        "dir": "china/fujian"
      },
      "nanping": {
        "id": "nanping",
        "name": "南平市",
        "parent": "fujian",
        "adcode": 350700,
        "children": [],
        "dir": "china/fujian"
      },
      "longyan": {
        "id": "longyan",
        "name": "龙岩市",
        "parent": "fujian",
        "adcode": 350800,
        "children": [],
        "dir": "china/fujian"
      },
      "ningde": {
        "id": "ningde",
        "name": "宁德市",
        "parent": "fujian",
        "adcode": 350900,
        "children": [],
        "dir": "china/fujian"
      },
      "jiangxi": {
        "id": "jiangxi",
        "name": "江西省",
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
        "name": "南昌市",
        "parent": "jiangxi",
        "adcode": 360100,
        "children": [],
        "dir": "china/jiangxi"
      },
      "jingdezhen": {
        "id": "jingdezhen",
        "name": "景德镇市",
        "parent": "jiangxi",
        "adcode": 360200,
        "children": [],
        "dir": "china/jiangxi"
      },
      "pingxiang": {
        "id": "pingxiang",
        "name": "萍乡市",
        "parent": "jiangxi",
        "adcode": 360300,
        "children": [],
        "dir": "china/jiangxi"
      },
      "jiujiang": {
        "id": "jiujiang",
        "name": "九江市",
        "parent": "jiangxi",
        "adcode": 360400,
        "children": [],
        "dir": "china/jiangxi"
      },
      "xinyu": {
        "id": "xinyu",
        "name": "新余市",
        "parent": "jiangxi",
        "adcode": 360500,
        "children": [],
        "dir": "china/jiangxi"
      },
      "yingtan": {
        "id": "yingtan",
        "name": "鹰潭市",
        "parent": "jiangxi",
        "adcode": 360600,
        "children": [],
        "dir": "china/jiangxi"
      },
      "ganzhou": {
        "id": "ganzhou",
        "name": "赣州市",
        "parent": "jiangxi",
        "adcode": 360700,
        "children": [],
        "dir": "china/jiangxi"
      },
      "jian": {
        "id": "jian",
        "name": "吉安市",
        "parent": "jiangxi",
        "adcode": 360800,
        "children": [],
        "dir": "china/jiangxi"
      },
      "yichunshi": {
        "id": "yichunshi",
        "name": "宜春市",
        "parent": "jiangxi",
        "adcode": 360900,
        "children": [],
        "dir": "china/jiangxi"
      },
      "fuzhoushi": {
        "id": "fuzhoushi",
        "name": "抚州市",
        "parent": "jiangxi",
        "adcode": 361000,
        "children": [],
        "dir": "china/jiangxi"
      },
      "shangrao": {
        "id": "shangrao",
        "name": "上饶市",
        "parent": "jiangxi",
        "adcode": 361100,
        "children": [],
        "dir": "china/jiangxi"
      },
      "shandong": {
        "id": "shandong",
        "name": "山东省",
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
        "name": "济南市",
        "parent": "shandong",
        "adcode": 370100,
        "children": [],
        "dir": "china/shandong"
      },
      "qingdao": {
        "id": "qingdao",
        "name": "青岛市",
        "parent": "shandong",
        "adcode": 370200,
        "children": [],
        "dir": "china/shandong"
      },
      "zibo": {
        "id": "zibo",
        "name": "淄博市",
        "parent": "shandong",
        "adcode": 370300,
        "children": [],
        "dir": "china/shandong"
      },
      "zaozhuang": {
        "id": "zaozhuang",
        "name": "枣庄市",
        "parent": "shandong",
        "adcode": 370400,
        "children": [],
        "dir": "china/shandong"
      },
      "dongying": {
        "id": "dongying",
        "name": "东营市",
        "parent": "shandong",
        "adcode": 370500,
        "children": [],
        "dir": "china/shandong"
      },
      "yantai": {
        "id": "yantai",
        "name": "烟台市",
        "parent": "shandong",
        "adcode": 370600,
        "children": [],
        "dir": "china/shandong"
      },
      "weifang": {
        "id": "weifang",
        "name": "潍坊市",
        "parent": "shandong",
        "adcode": 370700,
        "children": [],
        "dir": "china/shandong"
      },
      "jining": {
        "id": "jining",
        "name": "济宁市",
        "parent": "shandong",
        "adcode": 370800,
        "children": [],
        "dir": "china/shandong"
      },
      "taian": {
        "id": "taian",
        "name": "泰安市",
        "parent": "shandong",
        "adcode": 370900,
        "children": [],
        "dir": "china/shandong"
      },
      "weihai": {
        "id": "weihai",
        "name": "威海市",
        "parent": "shandong",
        "adcode": 371000,
        "children": [],
        "dir": "china/shandong"
      },
      "rizhao": {
        "id": "rizhao",
        "name": "日照市",
        "parent": "shandong",
        "adcode": 371100,
        "children": [],
        "dir": "china/shandong"
      },
      "linyi": {
        "id": "linyi",
        "name": "临沂市",
        "parent": "shandong",
        "adcode": 371300,
        "children": [],
        "dir": "china/shandong"
      },
      "dezhou": {
        "id": "dezhou",
        "name": "德州市",
        "parent": "shandong",
        "adcode": 371400,
        "children": [],
        "dir": "china/shandong"
      },
      "liaocheng": {
        "id": "liaocheng",
        "name": "聊城市",
        "parent": "shandong",
        "adcode": 371500,
        "children": [],
        "dir": "china/shandong"
      },
      "binzhou": {
        "id": "binzhou",
        "name": "滨州市",
        "parent": "shandong",
        "adcode": 371600,
        "children": [],
        "dir": "china/shandong"
      },
      "heze": {
        "id": "heze",
        "name": "菏泽市",
        "parent": "shandong",
        "adcode": 371700,
        "children": [],
        "dir": "china/shandong"
      },
      "henan": {
        "id": "henan",
        "name": "河南省",
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
        "name": "郑州市",
        "parent": "henan",
        "adcode": 410100,
        "children": [],
        "dir": "china/henan"
      },
      "kaifeng": {
        "id": "kaifeng",
        "name": "开封市",
        "parent": "henan",
        "adcode": 410200,
        "children": [],
        "dir": "china/henan"
      },
      "luoyang": {
        "id": "luoyang",
        "name": "洛阳市",
        "parent": "henan",
        "adcode": 410300,
        "children": [],
        "dir": "china/henan"
      },
      "pingdingshan": {
        "id": "pingdingshan",
        "name": "平顶山市",
        "parent": "henan",
        "adcode": 410400,
        "children": [],
        "dir": "china/henan"
      },
      "anyang": {
        "id": "anyang",
        "name": "安阳市",
        "parent": "henan",
        "adcode": 410500,
        "children": [],
        "dir": "china/henan"
      },
      "hebi": {
        "id": "hebi",
        "name": "鹤壁市",
        "parent": "henan",
        "adcode": 410600,
        "children": [],
        "dir": "china/henan"
      },
      "xinxiang": {
        "id": "xinxiang",
        "name": "新乡市",
        "parent": "henan",
        "adcode": 410700,
        "children": [],
        "dir": "china/henan"
      },
      "jiaozuo": {
        "id": "jiaozuo",
        "name": "焦作市",
        "parent": "henan",
        "adcode": 410800,
        "children": [],
        "dir": "china/henan"
      },
      "puyang": {
        "id": "puyang",
        "name": "濮阳市",
        "parent": "henan",
        "adcode": 410900,
        "children": [],
        "dir": "china/henan"
      },
      "xuchang": {
        "id": "xuchang",
        "name": "许昌市",
        "parent": "henan",
        "adcode": 411000,
        "children": [],
        "dir": "china/henan"
      },
      "luohe": {
        "id": "luohe",
        "name": "漯河市",
        "parent": "henan",
        "adcode": 411100,
        "children": [],
        "dir": "china/henan"
      },
      "sanmenxia": {
        "id": "sanmenxia",
        "name": "三门峡市",
        "parent": "henan",
        "adcode": 411200,
        "children": [],
        "dir": "china/henan"
      },
      "nanyang": {
        "id": "nanyang",
        "name": "南阳市",
        "parent": "henan",
        "adcode": 411300,
        "children": [],
        "dir": "china/henan"
      },
      "shangqiu": {
        "id": "shangqiu",
        "name": "商丘市",
        "parent": "henan",
        "adcode": 411400,
        "children": [],
        "dir": "china/henan"
      },
      "xinyang": {
        "id": "xinyang",
        "name": "信阳市",
        "parent": "henan",
        "adcode": 411500,
        "children": [],
        "dir": "china/henan"
      },
      "zhoukou": {
        "id": "zhoukou",
        "name": "周口市",
        "parent": "henan",
        "adcode": 411600,
        "children": [],
        "dir": "china/henan"
      },
      "zhumadian": {
        "id": "zhumadian",
        "name": "驻马店市",
        "parent": "henan",
        "adcode": 411700,
        "children": [],
        "dir": "china/henan"
      },
      "hubei": {
        "id": "hubei",
        "name": "湖北省",
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
        "name": "武汉市",
        "parent": "hubei",
        "adcode": 420100,
        "children": [],
        "dir": "china/hubei"
      },
      "huangshi": {
        "id": "huangshi",
        "name": "黄石市",
        "parent": "hubei",
        "adcode": 420200,
        "children": [],
        "dir": "china/hubei"
      },
      "shiyan": {
        "id": "shiyan",
        "name": "十堰市",
        "parent": "hubei",
        "adcode": 420300,
        "children": [],
        "dir": "china/hubei"
      },
      "yichang": {
        "id": "yichang",
        "name": "宜昌市",
        "parent": "hubei",
        "adcode": 420500,
        "children": [],
        "dir": "china/hubei"
      },
      "xiangyang": {
        "id": "xiangyang",
        "name": "襄阳市",
        "parent": "hubei",
        "adcode": 420600,
        "children": [],
        "dir": "china/hubei"
      },
      "ezhou": {
        "id": "ezhou",
        "name": "鄂州市",
        "parent": "hubei",
        "adcode": 420700,
        "children": [],
        "dir": "china/hubei"
      },
      "jingmen": {
        "id": "jingmen",
        "name": "荆门市",
        "parent": "hubei",
        "adcode": 420800,
        "children": [],
        "dir": "china/hubei"
      },
      "xiaogan": {
        "id": "xiaogan",
        "name": "孝感市",
        "parent": "hubei",
        "adcode": 420900,
        "children": [],
        "dir": "china/hubei"
      },
      "jingzhou": {
        "id": "jingzhou",
        "name": "荆州市",
        "parent": "hubei",
        "adcode": 421000,
        "children": [],
        "dir": "china/hubei"
      },
      "huanggang": {
        "id": "huanggang",
        "name": "黄冈市",
        "parent": "hubei",
        "adcode": 421100,
        "children": [],
        "dir": "china/hubei"
      },
      "xianning": {
        "id": "xianning",
        "name": "咸宁市",
        "parent": "hubei",
        "adcode": 421200,
        "children": [],
        "dir": "china/hubei"
      },
      "suizhou": {
        "id": "suizhou",
        "name": "随州市",
        "parent": "hubei",
        "adcode": 421300,
        "children": [],
        "dir": "china/hubei"
      },
      "enshi": {
        "id": "enshi",
        "name": "恩施土家族苗族自治州",
        "parent": "hubei",
        "adcode": 422800,
        "children": [],
        "dir": "china/hubei"
      },
      "hunan": {
        "id": "hunan",
        "name": "湖南省",
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
        "name": "长沙市",
        "parent": "hunan",
        "adcode": 430100,
        "children": [],
        "dir": "china/hunan"
      },
      "zhuzhou": {
        "id": "zhuzhou",
        "name": "株洲市",
        "parent": "hunan",
        "adcode": 430200,
        "children": [],
        "dir": "china/hunan"
      },
      "xiangtan": {
        "id": "xiangtan",
        "name": "湘潭市",
        "parent": "hunan",
        "adcode": 430300,
        "children": [],
        "dir": "china/hunan"
      },
      "hengyang": {
        "id": "hengyang",
        "name": "衡阳市",
        "parent": "hunan",
        "adcode": 430400,
        "children": [],
        "dir": "china/hunan"
      },
      "shaoyang": {
        "id": "shaoyang",
        "name": "邵阳市",
        "parent": "hunan",
        "adcode": 430500,
        "children": [],
        "dir": "china/hunan"
      },
      "yueyang": {
        "id": "yueyang",
        "name": "岳阳市",
        "parent": "hunan",
        "adcode": 430600,
        "children": [],
        "dir": "china/hunan"
      },
      "changde": {
        "id": "changde",
        "name": "常德市",
        "parent": "hunan",
        "adcode": 430700,
        "children": [],
        "dir": "china/hunan"
      },
      "zhangjiajie": {
        "id": "zhangjiajie",
        "name": "张家界市",
        "parent": "hunan",
        "adcode": 430800,
        "children": [],
        "dir": "china/hunan"
      },
      "yiyang": {
        "id": "yiyang",
        "name": "益阳市",
        "parent": "hunan",
        "adcode": 430900,
        "children": [],
        "dir": "china/hunan"
      },
      "chenzhou": {
        "id": "chenzhou",
        "name": "郴州市",
        "parent": "hunan",
        "adcode": 431000,
        "children": [],
        "dir": "china/hunan"
      },
      "yongzhou": {
        "id": "yongzhou",
        "name": "永州市",
        "parent": "hunan",
        "adcode": 431100,
        "children": [],
        "dir": "china/hunan"
      },
      "huaihua": {
        "id": "huaihua",
        "name": "怀化市",
        "parent": "hunan",
        "adcode": 431200,
        "children": [],
        "dir": "china/hunan"
      },
      "loudi": {
        "id": "loudi",
        "name": "娄底市",
        "parent": "hunan",
        "adcode": 431300,
        "children": [],
        "dir": "china/hunan"
      },
      "xiangxi": {
        "id": "xiangxi",
        "name": "湘西土家族苗族自治州",
        "parent": "hunan",
        "adcode": 433100,
        "children": [],
        "dir": "china/hunan"
      },
      "guangdong": {
        "id": "guangdong",
        "name": "广东省",
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
        "name": "广州市",
        "parent": "guangdong",
        "adcode": 440100,
        "children": [],
        "dir": "china/guangdong"
      },
      "shaoguan": {
        "id": "shaoguan",
        "name": "韶关市",
        "parent": "guangdong",
        "adcode": 440200,
        "children": [],
        "dir": "china/guangdong"
      },
      "shenzhen": {
        "id": "shenzhen",
        "name": "深圳市",
        "parent": "guangdong",
        "adcode": 440300,
        "children": [],
        "dir": "china/guangdong"
      },
      "zhuhai": {
        "id": "zhuhai",
        "name": "珠海市",
        "parent": "guangdong",
        "adcode": 440400,
        "children": [],
        "dir": "china/guangdong"
      },
      "shantou": {
        "id": "shantou",
        "name": "汕头市",
        "parent": "guangdong",
        "adcode": 440500,
        "children": [],
        "dir": "china/guangdong"
      },
      "foshan": {
        "id": "foshan",
        "name": "佛山市",
        "parent": "guangdong",
        "adcode": 440600,
        "children": [],
        "dir": "china/guangdong"
      },
      "jiangmen": {
        "id": "jiangmen",
        "name": "江门市",
        "parent": "guangdong",
        "adcode": 440700,
        "children": [],
        "dir": "china/guangdong"
      },
      "zhanjiang": {
        "id": "zhanjiang",
        "name": "湛江市",
        "parent": "guangdong",
        "adcode": 440800,
        "children": [],
        "dir": "china/guangdong"
      },
      "maoming": {
        "id": "maoming",
        "name": "茂名市",
        "parent": "guangdong",
        "adcode": 440900,
        "children": [],
        "dir": "china/guangdong"
      },
      "zhaoqing": {
        "id": "zhaoqing",
        "name": "肇庆市",
        "parent": "guangdong",
        "adcode": 441200,
        "children": [],
        "dir": "china/guangdong"
      },
      "huizhou": {
        "id": "huizhou",
        "name": "惠州市",
        "parent": "guangdong",
        "adcode": 441300,
        "children": [],
        "dir": "china/guangdong"
      },
      "meizhou": {
        "id": "meizhou",
        "name": "梅州市",
        "parent": "guangdong",
        "adcode": 441400,
        "children": [],
        "dir": "china/guangdong"
      },
      "shanwei": {
        "id": "shanwei",
        "name": "汕尾市",
        "parent": "guangdong",
        "adcode": 441500,
        "children": [],
        "dir": "china/guangdong"
      },
      "heyuan": {
        "id": "heyuan",
        "name": "河源市",
        "parent": "guangdong",
        "adcode": 441600,
        "children": [],
        "dir": "china/guangdong"
      },
      "yangjiang": {
        "id": "yangjiang",
        "name": "阳江市",
        "parent": "guangdong",
        "adcode": 441700,
        "children": [],
        "dir": "china/guangdong"
      },
      "qingyuan": {
        "id": "qingyuan",
        "name": "清远市",
        "parent": "guangdong",
        "adcode": 441800,
        "children": [],
        "dir": "china/guangdong"
      },
      "chaozhou": {
        "id": "chaozhou",
        "name": "潮州市",
        "parent": "guangdong",
        "adcode": 445100,
        "children": [],
        "dir": "china/guangdong"
      },
      "jieyang": {
        "id": "jieyang",
        "name": "揭阳市",
        "parent": "guangdong",
        "adcode": 445200,
        "children": [],
        "dir": "china/guangdong"
      },
      "yunfu": {
        "id": "yunfu",
        "name": "云浮市",
        "parent": "guangdong",
        "adcode": 445300,
        "children": [],
        "dir": "china/guangdong"
      },
      "guangxi": {
        "id": "guangxi",
        "name": "广西壮族自治区",
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
        "name": "南宁市",
        "parent": "guangxi",
        "adcode": 450100,
        "children": [],
        "dir": "china/guangxi"
      },
      "liuzhou": {
        "id": "liuzhou",
        "name": "柳州市",
        "parent": "guangxi",
        "adcode": 450200,
        "children": [],
        "dir": "china/guangxi"
      },
      "guilin": {
        "id": "guilin",
        "name": "桂林市",
        "parent": "guangxi",
        "adcode": 450300,
        "children": [],
        "dir": "china/guangxi"
      },
      "wuzhou": {
        "id": "wuzhou",
        "name": "梧州市",
        "parent": "guangxi",
        "adcode": 450400,
        "children": [],
        "dir": "china/guangxi"
      },
      "beihai": {
        "id": "beihai",
        "name": "北海市",
        "parent": "guangxi",
        "adcode": 450500,
        "children": [],
        "dir": "china/guangxi"
      },
      "fangchenggang": {
        "id": "fangchenggang",
        "name": "防城港市",
        "parent": "guangxi",
        "adcode": 450600,
        "children": [],
        "dir": "china/guangxi"
      },
      "qinzhou": {
        "id": "qinzhou",
        "name": "钦州市",
        "parent": "guangxi",
        "adcode": 450700,
        "children": [],
        "dir": "china/guangxi"
      },
      "guigang": {
        "id": "guigang",
        "name": "贵港市",
        "parent": "guangxi",
        "adcode": 450800,
        "children": [],
        "dir": "china/guangxi"
      },
      "yulin": {
        "id": "yulin",
        "name": "玉林市",
        "parent": "guangxi",
        "adcode": 450900,
        "children": [],
        "dir": "china/guangxi"
      },
      "baise": {
        "id": "baise",
        "name": "百色市",
        "parent": "guangxi",
        "adcode": 451000,
        "children": [],
        "dir": "china/guangxi"
      },
      "hezhou": {
        "id": "hezhou",
        "name": "贺州市",
        "parent": "guangxi",
        "adcode": 451100,
        "children": [],
        "dir": "china/guangxi"
      },
      "hechi": {
        "id": "hechi",
        "name": "河池市",
        "parent": "guangxi",
        "adcode": 451200,
        "children": [],
        "dir": "china/guangxi"
      },
      "laibin": {
        "id": "laibin",
        "name": "来宾市",
        "parent": "guangxi",
        "adcode": 451300,
        "children": [],
        "dir": "china/guangxi"
      },
      "chongzuo": {
        "id": "chongzuo",
        "name": "崇左市",
        "parent": "guangxi",
        "adcode": 451400,
        "children": [],
        "dir": "china/guangxi"
      },
      "hainan": {
        "id": "hainan",
        "name": "海南省",
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
        "name": "海口市",
        "parent": "hainan",
        "adcode": 460100,
        "children": [],
        "dir": "china/hainan"
      },
      "sanya": {
        "id": "sanya",
        "name": "三亚市",
        "parent": "hainan",
        "adcode": 460200,
        "children": [],
        "dir": "china/hainan"
      },
      "sansha": {
        "id": "sansha",
        "name": "三沙市",
        "parent": "hainan",
        "adcode": 460300,
        "children": [],
        "dir": "china/hainan"
      },
      "chongqing": {
        "id": "chongqing",
        "name": "重庆市",
        "parent": "china",
        "adcode": 500000,
        "children": [],
        "dir": "china"
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
        "dir": "china"
      },
      "chengdu": {
        "id": "chengdu",
        "name": "成都市",
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
        "name": "贵州省",
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
        "name": "贵阳市",
        "parent": "guizhou",
        "adcode": 520100,
        "children": [],
        "dir": "china/guizhou"
      },
      "liupanshui": {
        "id": "liupanshui",
        "name": "六盘水市",
        "parent": "guizhou",
        "adcode": 520200,
        "children": [],
        "dir": "china/guizhou"
      },
      "zunyi": {
        "id": "zunyi",
        "name": "遵义市",
        "parent": "guizhou",
        "adcode": 520300,
        "children": [],
        "dir": "china/guizhou"
      },
      "anshun": {
        "id": "anshun",
        "name": "安顺市",
        "parent": "guizhou",
        "adcode": 520400,
        "children": [],
        "dir": "china/guizhou"
      },
      "bijie": {
        "id": "bijie",
        "name": "毕节市",
        "parent": "guizhou",
        "adcode": 520500,
        "children": [],
        "dir": "china/guizhou"
      },
      "tongren": {
        "id": "tongren",
        "name": "铜仁市",
        "parent": "guizhou",
        "adcode": 520600,
        "children": [],
        "dir": "china/guizhou"
      },
      "qianxinan": {
        "id": "qianxinan",
        "name": "黔西南布依族苗族自治州",
        "parent": "guizhou",
        "adcode": 522300,
        "children": [],
        "dir": "china/guizhou"
      },
      "qiandongnan": {
        "id": "qiandongnan",
        "name": "黔东南苗族侗族自治州",
        "parent": "guizhou",
        "adcode": 522600,
        "children": [],
        "dir": "china/guizhou"
      },
      "qiannan": {
        "id": "qiannan",
        "name": "黔南布依族苗族自治州",
        "parent": "guizhou",
        "adcode": 522700,
        "children": [],
        "dir": "china/guizhou"
      },
      "yunnan": {
        "id": "yunnan",
        "name": "云南省",
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
        "name": "昆明市",
        "parent": "yunnan",
        "adcode": 530100,
        "children": [],
        "dir": "china/yunnan"
      },
      "qujing": {
        "id": "qujing",
        "name": "曲靖市",
        "parent": "yunnan",
        "adcode": 530300,
        "children": [],
        "dir": "china/yunnan"
      },
      "yuxi": {
        "id": "yuxi",
        "name": "玉溪市",
        "parent": "yunnan",
        "adcode": 530400,
        "children": [],
        "dir": "china/yunnan"
      },
      "baoshanshi": {
        "id": "baoshanshi",
        "name": "保山市",
        "parent": "yunnan",
        "adcode": 530500,
        "children": [],
        "dir": "china/yunnan"
      },
      "zhaotong": {
        "id": "zhaotong",
        "name": "昭通市",
        "parent": "yunnan",
        "adcode": 530600,
        "children": [],
        "dir": "china/yunnan"
      },
      "lijiang": {
        "id": "lijiang",
        "name": "丽江市",
        "parent": "yunnan",
        "adcode": 530700,
        "children": [],
        "dir": "china/yunnan"
      },
      "puer": {
        "id": "puer",
        "name": "普洱市",
        "parent": "yunnan",
        "adcode": 530800,
        "children": [],
        "dir": "china/yunnan"
      },
      "lincang": {
        "id": "lincang",
        "name": "临沧市",
        "parent": "yunnan",
        "adcode": 530900,
        "children": [],
        "dir": "china/yunnan"
      },
      "chuxiong": {
        "id": "chuxiong",
        "name": "楚雄彝族自治州",
        "parent": "yunnan",
        "adcode": 532300,
        "children": [],
        "dir": "china/yunnan"
      },
      "honghe": {
        "id": "honghe",
        "name": "红河哈尼族彝族自治州",
        "parent": "yunnan",
        "adcode": 532500,
        "children": [],
        "dir": "china/yunnan"
      },
      "wenshan": {
        "id": "wenshan",
        "name": "文山壮族苗族自治州",
        "parent": "yunnan",
        "adcode": 532600,
        "children": [],
        "dir": "china/yunnan"
      },
      "xishuangbanna": {
        "id": "xishuangbanna",
        "name": "西双版纳傣族自治州",
        "parent": "yunnan",
        "adcode": 532800,
        "children": [],
        "dir": "china/yunnan"
      },
      "dali": {
        "id": "dali",
        "name": "大理白族自治州",
        "parent": "yunnan",
        "adcode": 532900,
        "children": [],
        "dir": "china/yunnan"
      },
      "dehong": {
        "id": "dehong",
        "name": "德宏傣族景颇族自治州",
        "parent": "yunnan",
        "adcode": 533100,
        "children": [],
        "dir": "china/yunnan"
      },
      "nujiang": {
        "id": "nujiang",
        "name": "怒江傈僳族自治州",
        "parent": "yunnan",
        "adcode": 533300,
        "children": [],
        "dir": "china/yunnan"
      },
      "diqing": {
        "id": "diqing",
        "name": "迪庆藏族自治州",
        "parent": "yunnan",
        "adcode": 533400,
        "children": [],
        "dir": "china/yunnan"
      },
      "xizang": {
        "id": "xizang",
        "name": "西藏自治区",
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
        "name": "拉萨市",
        "parent": "xizang",
        "adcode": 540100,
        "children": [],
        "dir": "china/xizang"
      },
      "rikaze": {
        "id": "rikaze",
        "name": "日喀则市",
        "parent": "xizang",
        "adcode": 540200,
        "children": [],
        "dir": "china/xizang"
      },
      "changdou": {
        "id": "changdou",
        "name": "昌都市",
        "parent": "xizang",
        "adcode": 540300,
        "children": [],
        "dir": "china/xizang"
      },
      "linzhi": {
        "id": "linzhi",
        "name": "林芝市",
        "parent": "xizang",
        "adcode": 540400,
        "children": [],
        "dir": "china/xizang"
      },
      "shannan": {
        "id": "shannan",
        "name": "山南市",
        "parent": "xizang",
        "adcode": 540500,
        "children": [],
        "dir": "china/xizang"
      },
      "naqu": {
        "id": "naqu",
        "name": "那曲市",
        "parent": "xizang",
        "adcode": 540600,
        "children": [],
        "dir": "china/xizang"
      },
      "ali": {
        "id": "ali",
        "name": "阿里地区",
        "parent": "xizang",
        "adcode": 542500,
        "children": [],
        "dir": "china/xizang"
      },
      "shaanxi": {
        "id": "shaanxi",
        "name": "陕西省",
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
        "name": "西安市",
        "parent": "shaanxi",
        "adcode": 610100,
        "children": [],
        "dir": "china/shaanxi"
      },
      "tongchuan": {
        "id": "tongchuan",
        "name": "铜川市",
        "parent": "shaanxi",
        "adcode": 610200,
        "children": [],
        "dir": "china/shaanxi"
      },
      "baoji": {
        "id": "baoji",
        "name": "宝鸡市",
        "parent": "shaanxi",
        "adcode": 610300,
        "children": [],
        "dir": "china/shaanxi"
      },
      "xianyang": {
        "id": "xianyang",
        "name": "咸阳市",
        "parent": "shaanxi",
        "adcode": 610400,
        "children": [],
        "dir": "china/shaanxi"
      },
      "weinan": {
        "id": "weinan",
        "name": "渭南市",
        "parent": "shaanxi",
        "adcode": 610500,
        "children": [],
        "dir": "china/shaanxi"
      },
      "yanan": {
        "id": "yanan",
        "name": "延安市",
        "parent": "shaanxi",
        "adcode": 610600,
        "children": [],
        "dir": "china/shaanxi"
      },
      "hanzhong": {
        "id": "hanzhong",
        "name": "汉中市",
        "parent": "shaanxi",
        "adcode": 610700,
        "children": [],
        "dir": "china/shaanxi"
      },
      "yulinshi": {
        "id": "yulinshi",
        "name": "榆林市",
        "parent": "shaanxi",
        "adcode": 610800,
        "children": [],
        "dir": "china/shaanxi"
      },
      "ankang": {
        "id": "ankang",
        "name": "安康市",
        "parent": "shaanxi",
        "adcode": 610900,
        "children": [],
        "dir": "china/shaanxi"
      },
      "shangluo": {
        "id": "shangluo",
        "name": "商洛市",
        "parent": "shaanxi",
        "adcode": 611000,
        "children": [],
        "dir": "china/shaanxi"
      },
      "gansu": {
        "id": "gansu",
        "name": "甘肃省",
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
        "name": "兰州市",
        "parent": "gansu",
        "adcode": 620100,
        "children": [],
        "dir": "china/gansu"
      },
      "jinchang": {
        "id": "jinchang",
        "name": "金昌市",
        "parent": "gansu",
        "adcode": 620300,
        "children": [],
        "dir": "china/gansu"
      },
      "baiyin": {
        "id": "baiyin",
        "name": "白银市",
        "parent": "gansu",
        "adcode": 620400,
        "children": [],
        "dir": "china/gansu"
      },
      "tianshui": {
        "id": "tianshui",
        "name": "天水市",
        "parent": "gansu",
        "adcode": 620500,
        "children": [],
        "dir": "china/gansu"
      },
      "wuwei": {
        "id": "wuwei",
        "name": "武威市",
        "parent": "gansu",
        "adcode": 620600,
        "children": [],
        "dir": "china/gansu"
      },
      "zhangye": {
        "id": "zhangye",
        "name": "张掖市",
        "parent": "gansu",
        "adcode": 620700,
        "children": [],
        "dir": "china/gansu"
      },
      "pingliang": {
        "id": "pingliang",
        "name": "平凉市",
        "parent": "gansu",
        "adcode": 620800,
        "children": [],
        "dir": "china/gansu"
      },
      "jiuquan": {
        "id": "jiuquan",
        "name": "酒泉市",
        "parent": "gansu",
        "adcode": 620900,
        "children": [],
        "dir": "china/gansu"
      },
      "qingyang": {
        "id": "qingyang",
        "name": "庆阳市",
        "parent": "gansu",
        "adcode": 621000,
        "children": [],
        "dir": "china/gansu"
      },
      "dingxi": {
        "id": "dingxi",
        "name": "定西市",
        "parent": "gansu",
        "adcode": 621100,
        "children": [],
        "dir": "china/gansu"
      },
      "longnan": {
        "id": "longnan",
        "name": "陇南市",
        "parent": "gansu",
        "adcode": 621200,
        "children": [],
        "dir": "china/gansu"
      },
      "linxia": {
        "id": "linxia",
        "name": "临夏回族自治州",
        "parent": "gansu",
        "adcode": 622900,
        "children": [],
        "dir": "china/gansu"
      },
      "gannan": {
        "id": "gannan",
        "name": "甘南藏族自治州",
        "parent": "gansu",
        "adcode": 623000,
        "children": [],
        "dir": "china/gansu"
      },
      "qinghai": {
        "id": "qinghai",
        "name": "青海省",
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
        "name": "西宁市",
        "parent": "qinghai",
        "adcode": 630100,
        "children": [],
        "dir": "china/qinghai"
      },
      "haidong": {
        "id": "haidong",
        "name": "海东市",
        "parent": "qinghai",
        "adcode": 630200,
        "children": [],
        "dir": "china/qinghai"
      },
      "haibei": {
        "id": "haibei",
        "name": "海北藏族自治州",
        "parent": "qinghai",
        "adcode": 632200,
        "children": [],
        "dir": "china/qinghai"
      },
      "huangnan": {
        "id": "huangnan",
        "name": "黄南藏族自治州",
        "parent": "qinghai",
        "adcode": 632300,
        "children": [],
        "dir": "china/qinghai"
      },
      "hainanzhou": {
        "id": "hainanzhou",
        "name": "海南藏族自治州",
        "parent": "qinghai",
        "adcode": 632500,
        "children": [],
        "dir": "china/qinghai"
      },
      "guoluo": {
        "id": "guoluo",
        "name": "果洛藏族自治州",
        "parent": "qinghai",
        "adcode": 632600,
        "children": [],
        "dir": "china/qinghai"
      },
      "yushu": {
        "id": "yushu",
        "name": "玉树藏族自治州",
        "parent": "qinghai",
        "adcode": 632700,
        "children": [],
        "dir": "china/qinghai"
      },
      "haixi": {
        "id": "haixi",
        "name": "海西蒙古族藏族自治州",
        "parent": "qinghai",
        "adcode": 632800,
        "children": [],
        "dir": "china/qinghai"
      },
      "ningxia": {
        "id": "ningxia",
        "name": "宁夏回族自治区",
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
        "name": "银川市",
        "parent": "ningxia",
        "adcode": 640100,
        "children": [],
        "dir": "china/ningxia"
      },
      "shizuishan": {
        "id": "shizuishan",
        "name": "石嘴山市",
        "parent": "ningxia",
        "adcode": 640200,
        "children": [],
        "dir": "china/ningxia"
      },
      "wuzhong": {
        "id": "wuzhong",
        "name": "吴忠市",
        "parent": "ningxia",
        "adcode": 640300,
        "children": [],
        "dir": "china/ningxia"
      },
      "guyuan": {
        "id": "guyuan",
        "name": "固原市",
        "parent": "ningxia",
        "adcode": 640400,
        "children": [],
        "dir": "china/ningxia"
      },
      "zhongwei": {
        "id": "zhongwei",
        "name": "中卫市",
        "parent": "ningxia",
        "adcode": 640500,
        "children": [],
        "dir": "china/ningxia"
      },
      "xinjiang": {
        "id": "xinjiang",
        "name": "新疆维吾尔自治区",
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
        "name": "乌鲁木齐市",
        "parent": "xinjiang",
        "adcode": 650100,
        "children": [],
        "dir": "china/xinjiang"
      },
      "kelamayi": {
        "id": "kelamayi",
        "name": "克拉玛依市",
        "parent": "xinjiang",
        "adcode": 650200,
        "children": [],
        "dir": "china/xinjiang"
      },
      "tulufan": {
        "id": "tulufan",
        "name": "吐鲁番市",
        "parent": "xinjiang",
        "adcode": 650400,
        "children": [],
        "dir": "china/xinjiang"
      },
      "hami": {
        "id": "hami",
        "name": "哈密市",
        "parent": "xinjiang",
        "adcode": 650500,
        "children": [],
        "dir": "china/xinjiang"
      },
      "changji": {
        "id": "changji",
        "name": "昌吉回族自治州",
        "parent": "xinjiang",
        "adcode": 652300,
        "children": [],
        "dir": "china/xinjiang"
      },
      "boertala": {
        "id": "boertala",
        "name": "博尔塔拉蒙古自治州",
        "parent": "xinjiang",
        "adcode": 652700,
        "children": [],
        "dir": "china/xinjiang"
      },
      "bayinguoleng": {
        "id": "bayinguoleng",
        "name": "巴音郭楞蒙古自治州",
        "parent": "xinjiang",
        "adcode": 652800,
        "children": [],
        "dir": "china/xinjiang"
      },
      "akesu": {
        "id": "akesu",
        "name": "阿克苏地区",
        "parent": "xinjiang",
        "adcode": 652900,
        "children": [],
        "dir": "china/xinjiang"
      },
      "kezilesukeerkezi": {
        "id": "kezilesukeerkezi",
        "name": "克孜勒苏柯尔克孜自治州",
        "parent": "xinjiang",
        "adcode": 653000,
        "children": [],
        "dir": "china/xinjiang"
      },
      "kashen": {
        "id": "kashen",
        "name": "喀什地区",
        "parent": "xinjiang",
        "adcode": 653100,
        "children": [],
        "dir": "china/xinjiang"
      },
      "hetian": {
        "id": "hetian",
        "name": "和田地区",
        "parent": "xinjiang",
        "adcode": 653200,
        "children": [],
        "dir": "china/xinjiang"
      },
      "yilihasake": {
        "id": "yilihasake",
        "name": "伊犁哈萨克自治州",
        "parent": "xinjiang",
        "adcode": 654000,
        "children": [],
        "dir": "china/xinjiang"
      },
      "tacheng": {
        "id": "tacheng",
        "name": "塔城地区",
        "parent": "xinjiang",
        "adcode": 654200,
        "children": [],
        "dir": "china/xinjiang"
      },
      "aletai": {
        "id": "aletai",
        "name": "阿勒泰地区",
        "parent": "xinjiang",
        "adcode": 654300,
        "children": [],
        "dir": "china/xinjiang"
      },
      "taiwan": {
        "id": "taiwan",
        "name": "台湾省",
        "parent": "china",
        "adcode": 710000,
        "children": [],
        "dir": "china"
      },
      "hongkong": {
        "id": "hongkong",
        "name": "香港特别行政区",
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
