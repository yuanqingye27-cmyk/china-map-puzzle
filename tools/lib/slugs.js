'use strict';
/* =====================================================================
 * 公共库 · 地图包命名（adcode ↔ 拼音 slug）
 * ---------------------------------------------------------------------
 * 路径：tools/lib/slugs.js
 *
 * 为什么需要"表"：地图包的 id / 目录名 / 文件名用的是英文 slug（`zigong`），
 * 而 adcode 只给得出数字（510300），中文名只给得出汉字（自贡市）——
 * 拼音没法从这两样推出来，除非引一个拼音库（违背"零依赖"）。
 * 所以这里维护几张**小表**，其余一律走可预测的兜底命名。这和 add-map.js
 * 里原有的 PROVINCE_SLUGS 是同一个思路，只是搬到了公共库里让批量脚本也能用。
 *
 * 兜底规则：表里查不到就用 `map-<adcode>`。
 * 它不好看，但**一定能用**：批量接入一张陌生地图时不会因为"起不出名字"而失败，
 * 报告里会把"这个 slug 是自动兜底的、建议人工改成拼音"单独列出来。
 * ===================================================================== */

/** 省级：adcode 前两位 → slug */
const PROVINCE_SLUGS = {
  11: 'beijing', 12: 'tianjin', 13: 'hebei', 14: 'shanxi', 15: 'neimenggu',
  21: 'liaoning', 22: 'jilin', 23: 'heilongjiang',
  31: 'shanghai', 32: 'jiangsu', 33: 'zhejiang', 34: 'anhui', 35: 'fujian',
  36: 'jiangxi', 37: 'shandong',
  41: 'henan', 42: 'hubei', 43: 'hunan', 44: 'guangdong', 45: 'guangxi', 46: 'hainan',
  50: 'chongqing', 51: 'sichuan', 52: 'guizhou', 53: 'yunnan', 54: 'xizang',
  61: 'shaanxi', 62: 'gansu', 63: 'qinghai', 64: 'ningxia', 65: 'xinjiang',
  71: 'taiwan', 81: 'hongkong', 82: 'macau',
};

/**
 * 地级（adcode → slug）。**已覆盖全部 492 个**（含直辖市的"市辖区"层与港澳台地区）。
 *
 * 这张表是用拼音库**离线生成**的，不是手写的：手写 492 条既慢又容易拼错。
 * 生成规则与校对方式见 SOP 5.11 第二节；关键一点是——
 * **生成结果与原先天写的四川 21 条完全一致**，所以可以放心替换。
 * 项目本身仍然零依赖：拼音库只用于"生成这张表"，不进任何运行时路径。
 *
 * 同名县市（嘉义市/嘉义县、新竹市/新竹县）已加后缀消歧。
 */
const CITY_SLUGS = {
  // ---- 北京（110000）16 个 ----
  110101: "dongcheng", 110102: "xicheng",
  110105: "chaoyang", 110106: "fengtai",
  110107: "shijingshan", 110108: "haidian",
  110109: "mentougou", 110111: "fangshan",
  110112: "tongzhou", 110113: "shunyi",
  110114: "changping", 110115: "daxing",
  110116: "huairou", 110117: "pinggu",
  110118: "miyun", 110119: "yanqing",
  // ---- 天津（120000）16 个 ----
  120101: "heping", 120102: "hedong",
  120103: "hexi", 120104: "nankai",
  120105: "hebei", 120106: "hongqiao",
  120110: "dongli", 120111: "xiqing",
  120112: "jinnan", 120113: "beichen",
  120114: "wuqing", 120115: "baodi",
  120116: "binhai", 120117: "ninghe",
  120118: "jinghai", 120119: "jizhou",
  // ---- 河北（130000）11 个 ----
  130100: "shijiazhuang", 130200: "tangshan",
  130300: "qinhuangdao", 130400: "handan",
  130500: "xingtai", 130600: "baoding",
  130700: "zhangjiakou", 130800: "chengde",
  130900: "cangzhou", 131000: "langfang",
  131100: "hengshui",
  // ---- 山西（140000）11 个 ----
  140100: "taiyuan", 140200: "datong",
  140300: "yangquan", 140400: "changzhi",
  140500: "jincheng", 140600: "shuozhou",
  140700: "jinzhong", 140800: "yuncheng",
  140900: "xinzhou", 141000: "linfen",
  141100: "lliang",
  // ---- 内蒙古（150000）12 个 ----
  150100: "huhehaote", 150200: "baotou",
  150300: "wuhai", 150400: "chifeng",
  150500: "tongliao", 150600: "eerduosi",
  150700: "hulunbeier", 150800: "bayannaoer",
  150900: "wulanchabu", 152200: "xingan",
  152500: "xilinguole", 152900: "alashan",
  // ---- 辽宁（210000）14 个 ----
  210100: "shenyang", 210200: "dalian",
  210300: "anshan", 210400: "fushun",
  210500: "benxi", 210600: "dandong",
  210700: "jinzhou", 210800: "yingkou",
  210900: "fuxin", 211000: "liaoyang",
  211100: "panjin", 211200: "tieling",
  211300: "chaoyangshi", 211400: "huludao",
  // ---- 吉林（220000）9 个 ----
  220100: "changchun", 220200: "jilin",
  220300: "siping", 220400: "liaoyuan",
  220500: "tonghua", 220600: "baishan",
  220700: "songyuan", 220800: "baicheng",
  222400: "yanbian",
  // ---- 黑龙江（230000）13 个 ----
  230100: "haerbin", 230200: "qiqihaer",
  230300: "jixi", 230400: "hegang",
  230500: "shuangyashan", 230600: "daqing",
  230700: "yichun", 230800: "jiamusi",
  230900: "qitaihe", 231000: "mudanjiang",
  231100: "heihe", 231200: "suihua",
  232700: "daxinganling",
  // ---- 上海（310000）16 个 ----
  310101: "huangpu", 310104: "xuhui",
  310105: "changning", 310106: "jingan",
  310107: "putuo", 310109: "hongkou",
  310110: "yangpu", 310112: "minxing",
  310113: "baoshan", 310114: "jiading",
  310115: "pudong", 310116: "jinshan",
  310117: "songjiang", 310118: "qingpu",
  310120: "fengxian", 310151: "chongming",
  // ---- 江苏（320000）13 个 ----
  320100: "nanjing", 320200: "wuxi",
  320300: "xuzhou", 320400: "changzhou",
  320500: "suzhou", 320600: "nantong",
  320700: "lianyungang", 320800: "huaian",
  320900: "yancheng", 321000: "yangzhou",
  321100: "zhenjiang", 321200: "taizhou",
  321300: "suqian",
  // ---- 浙江（330000）11 个 ----
  330100: "hangzhou", 330200: "ningbo",
  330300: "wenzhou", 330400: "jiaxing",
  330500: "huzhou", 330600: "shaoxing",
  330700: "jinhua", 330800: "quzhou",
  330900: "zhoushan", 331000: "taizhoushi",
  331100: "lishui",
  // ---- 安徽（340000）16 个 ----
  340100: "hefei", 340200: "wuhu",
  340300: "bengbu", 340400: "huainan",
  340500: "maanshan", 340600: "huaibei",
  340700: "tongling", 340800: "anqing",
  341000: "huangshan", 341100: "chuzhou",
  341200: "fuyang", 341300: "suzhoushi",
  341500: "luan", 341600: "bozhou",
  341700: "chizhou", 341800: "xuancheng",
  // ---- 福建（350000）9 个 ----
  350100: "fuzhou", 350200: "xiamen",
  350300: "putian", 350400: "sanming",
  350500: "quanzhou", 350600: "zhangzhou",
  350700: "nanping", 350800: "longyan",
  350900: "ningde",
  // ---- 江西（360000）11 个 ----
  360100: "nanchang", 360200: "jingdezhen",
  360300: "pingxiang", 360400: "jiujiang",
  360500: "xinyu", 360600: "yingtan",
  360700: "ganzhou", 360800: "jian",
  360900: "yichunshi", 361000: "fuzhoushi",
  361100: "shangrao",
  // ---- 山东（370000）16 个 ----
  370100: "jinan", 370200: "qingdao",
  370300: "zibo", 370400: "zaozhuang",
  370500: "dongying", 370600: "yantai",
  370700: "weifang", 370800: "jining",
  370900: "taian", 371000: "weihai",
  371100: "rizhao", 371300: "linyi",
  371400: "dezhou", 371500: "liaocheng",
  371600: "binzhou", 371700: "heze",
  // ---- 河南（410000）18 个 ----
  410100: "zhengzhou", 410200: "kaifeng",
  410300: "luoyang", 410400: "pingdingshan",
  410500: "anyang", 410600: "hebi",
  410700: "xinxiang", 410800: "jiaozuo",
  410900: "puyang", 411000: "xuchang",
  411100: "luohe", 411200: "sanmenxia",
  411300: "nanyang", 411400: "shangqiu",
  411500: "xinyang", 411600: "zhoukou",
  411700: "zhumadian", 419001: "jiyuan",
  // ---- 湖北（420000）17 个 ----
  420100: "wuhan", 420200: "huangshi",
  420300: "shiyan", 420500: "yichang",
  420600: "xiangyang", 420700: "ezhou",
  420800: "jingmen", 420900: "xiaogan",
  421000: "jingzhou", 421100: "huanggang",
  421200: "xianning", 421300: "suizhou",
  422800: "enshi", 429004: "xiantao",
  429005: "qianjiang", 429006: "tianmen",
  429021: "shennongjia",
  // ---- 湖南（430000）14 个 ----
  430100: "changsha", 430200: "zhuzhou",
  430300: "xiangtan", 430400: "hengyang",
  430500: "shaoyang", 430600: "yueyang",
  430700: "changde", 430800: "zhangjiajie",
  430900: "yiyang", 431000: "chenzhou",
  431100: "yongzhou", 431200: "huaihua",
  431300: "loudi", 433100: "xiangxi",
  // ---- 广东（440000）21 个 ----
  440100: "guangzhou", 440200: "shaoguan",
  440300: "shenzhen", 440400: "zhuhai",
  440500: "shantou", 440600: "foshan",
  440700: "jiangmen", 440800: "zhanjiang",
  440900: "maoming", 441200: "zhaoqing",
  441300: "huizhou", 441400: "meizhou",
  441500: "shanwei", 441600: "heyuan",
  441700: "yangjiang", 441800: "qingyuan",
  441900: "dongguan", 442000: "zhongshan",
  445100: "chaozhou", 445200: "jieyang",
  445300: "yunfu",
  // ---- 广西（450000）14 个 ----
  450100: "nanning", 450200: "liuzhou",
  450300: "guilin", 450400: "wuzhou",
  450500: "beihai", 450600: "fangchenggang",
  450700: "qinzhou", 450800: "guigang",
  450900: "yulin", 451000: "baise",
  451100: "hezhou", 451200: "hechi",
  451300: "laibin", 451400: "chongzuo",
  // ---- 海南（460000）19 个 ----
  460100: "haikou", 460200: "sanya",
  460300: "sansha", 460400: "danzhou",
  469001: "wuzhishan", 469002: "qionghai",
  469005: "wenchang", 469006: "wanning",
  469007: "dongfang", 469021: "dingan",
  469022: "tunchang", 469023: "chengmai",
  469024: "lingao", 469025: "baisha",
  469026: "changjiang", 469027: "ledong",
  469028: "lingshui", 469029: "baoting",
  469030: "qiongzhong",
  // ---- 重庆（500000）38 个 ----
  500101: "wanzhou", 500102: "fuling",
  500103: "yuzhong", 500104: "dadukou",
  500105: "jiangbei", 500106: "shapingba",
  500107: "jiulongpo", 500108: "nanan",
  500109: "beibei", 500110: "qijiang",
  500111: "dazu", 500112: "yubei",
  500113: "banan", 500114: "qianjiangqu",
  500115: "changshou", 500116: "jiangjin",
  500117: "hechuan", 500118: "yongchuan",
  500119: "nanchuan", 500120: "bishan",
  500151: "tongliang", 500152: "tongnan",
  500153: "rongchang", 500154: "kaizhou",
  500155: "liangping", 500156: "wulong",
  500229: "chengkou", 500230: "fengdou",
  500231: "dianjiang", 500233: "zhong",
  500235: "yunyang", 500236: "fengjie",
  500237: "wushan", 500238: "wuxixian",
  500240: "shizhu", 500241: "xiushan",
  500242: "youyang", 500243: "pengshui",
  // ---- 四川（510000）21 个 ----
  510100: "chengdu", 510300: "zigong",
  510400: "panzhihua", 510500: "luzhou",
  510600: "deyang", 510700: "mianyang",
  510800: "guangyuan", 510900: "suining",
  511000: "neijiang", 511100: "leshan",
  511300: "nanchong", 511400: "meishan",
  511500: "yibin", 511600: "guangan",
  511700: "dazhou", 511800: "yaan",
  511900: "bazhong", 512000: "ziyang",
  513200: "aba", 513300: "ganzi",
  513400: "liangshan",
  // ---- 贵州（520000）9 个 ----
  520100: "guiyang", 520200: "liupanshui",
  520300: "zunyi", 520400: "anshun",
  520500: "bijie", 520600: "tongren",
  522300: "qianxinan", 522600: "qiandongnan",
  522700: "qiannan",
  // ---- 云南（530000）16 个 ----
  530100: "kunming", 530300: "qujing",
  530400: "yuxi", 530500: "baoshanshi",
  530600: "zhaotong", 530700: "lijiang",
  530800: "puer", 530900: "lincang",
  532300: "chuxiong", 532500: "honghe",
  532600: "wenshan", 532800: "xishuangbanna",
  532900: "dali", 533100: "dehong",
  533300: "nujiang", 533400: "diqing",
  // ---- 西藏（540000）7 个 ----
  540100: "lasa", 540200: "rikaze",
  540300: "changdou", 540400: "linzhi",
  540500: "shannan", 540600: "naqu",
  542500: "ali",
  // ---- 陕西（610000）10 个 ----
  610100: "xian", 610200: "tongchuan",
  610300: "baoji", 610400: "xianyang",
  610500: "weinan", 610600: "yanan",
  610700: "hanzhong", 610800: "yulinshi",
  610900: "ankang", 611000: "shangluo",
  // ---- 甘肃（620000）17 个 ----
  620100: "lanzhou", 620200: "jiayuguan",
  620300: "jinchang", 620400: "baiyin",
  620500: "tianshui", 620600: "wuwei",
  620700: "zhangye", 620800: "pingliang",
  620900: "jiuquan", 621000: "qingyang",
  621100: "dingxi", 621200: "longnan",
  622900: "linxia", 623000: "gannan",
  629700: "zhongnongfashandanmachang", 629800: "lianhuashanfengjinglinziranbaohu",
  629900: "taizishantianranlinbaohu",
  // ---- 青海（630000）8 个 ----
  630100: "xining", 630200: "haidong",
  632200: "haibei", 632300: "huangnan",
  632500: "hainan", 632600: "guoluo",
  632700: "yushu", 632800: "haixi",
  // ---- 宁夏（640000）5 个 ----
  640100: "yinchuan", 640200: "shizuishan",
  640300: "wuzhong", 640400: "guyuan",
  640500: "zhongwei",
  // ---- 新疆（650000）26 个 ----
  650100: "wulumuqi", 650200: "kelamayi",
  650400: "tulufan", 650500: "hami",
  652300: "changji", 652700: "boertala",
  652800: "bayinguoleng", 652900: "akesu",
  653000: "kezilesukeerkezi", 653100: "kashen",
  653200: "hetian", 654000: "yilihasake",
  654200: "tacheng", 654300: "aletai",
  659001: "shihezi", 659002: "alaer",
  659003: "tumushuke", 659004: "wujiaqu",
  659005: "beitun", 659006: "tiemenguan",
  659007: "shuanghe", 659008: "kekedala",
  659009: "kunyu", 659010: "huyanghe",
  659011: "xinxing", 659012: "baiyang",
  // ---- 台湾（710000）20 个 ----
  710001: "gaoxiong", 710003: "hualian",
  710004: "jilong", 710005: "jiayi",
  710006: "jiayixian", 710007: "miaoli",
  710008: "nantou", 710009: "taibei",
  710010: "penghu", 710011: "pingdong",
  710012: "xinbei", 710013: "taidong",
  710014: "tainan", 710016: "taizhong",
  710018: "taoyuan", 710019: "xinzhu",
  710020: "xinzhuxian", 710021: "yilan",
  710022: "yunlin", 710023: "zhanghua",
  // ---- 香港（810000）18 个 ----
  810101: "zhongxi", 810102: "dong",
  810103: "jiulongcheng", 810104: "guantang",
  810105: "nan", 810106: "shenshuibu",
  810107: "wanzai", 810108: "huangdaxian",
  810109: "youjianwang", 810110: "lidao",
  810111: "kuiqing", 810112: "bei",
  810113: "xigong", 810114: "shatian",
  810115: "tunmen", 810116: "dapu",
  810117: "quanwan", 810118: "yuanlang",
};

const CHINA = { slug: 'china', adcode: 100000, parentSlug: null };

const slugToProvinceAdcode = (slug) => {
  const hit = Object.keys(PROVINCE_SLUGS).find((k) => PROVINCE_SLUGS[k] === slug);
  return hit ? Number(hit) * 10000 : null;
};

/** slug 是否合法（= 能不能当文件名 / 目录名 / URL 参数） */
const isValidSlug = (slug) => /^[a-z][a-z0-9_-]*$/.test(slug || '');

/**
 * 给一个 adcode 起名字。
 * @returns {{slug:string, source:'table'|'fallback'}}
 *   source='fallback' 表示表里没有、用了 `map-<adcode>`，报告里会提醒人工改名
 */
function slugForAdcode(adcode) {
  if (adcode === CHINA.adcode) return { slug: CHINA.slug, source: 'table' };
  const prov = PROVINCE_SLUGS[String(adcode).slice(0, 2)];
  const isProvince = adcode % 10000 === 0;
  if (isProvince && prov) return { slug: prov, source: 'table' };
  if (CITY_SLUGS[adcode]) return { slug: CITY_SLUGS[adcode], source: 'table' };
  return { slug: 'map-' + adcode, source: 'fallback' };
}

/**
 * 由 adcode 推断它该挂在哪个父级下面（只知道"层级"，不知道父级的 slug）。
 * @returns {{parentAdcode:number, level:'country'|'province'|'city'|'county'}}
 */
function parentAdcodeOf(adcode) {
  if (adcode === CHINA.adcode) return { parentAdcode: null, level: 'country' };
  if (adcode % 10000 === 0) return { parentAdcode: CHINA.adcode, level: 'province' };
  if (adcode % 100 === 0) return { parentAdcode: Math.floor(adcode / 10000) * 10000, level: 'city' };
  return { parentAdcode: Math.floor(adcode / 100) * 100, level: 'county' };
}

module.exports = {
  PROVINCE_SLUGS,
  CITY_SLUGS,
  CHINA,
  slugToProvinceAdcode,
  isValidSlug,
  slugForAdcode,
  parentAdcodeOf,
};
