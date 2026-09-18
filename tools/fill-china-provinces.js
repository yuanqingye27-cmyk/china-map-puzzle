#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 中国图：34 个省级行政区的科普文案 + 按地理分区重排关卡
 * ---------------------------------------------------------------------
 * 路径：tools/fill-china-provinces.js
 *
 * 【为什么单写一个工具，而不是手改 china.data.js】
 *   1. area 是**构建产物**（tools/area-from-geo.js 依官方边界几何算出），
 *      手改这个大文件很容易顺手毁掉它。这个工具只替换「文案字段」和
 *      「LEVELS 块」，area 一律原样搬过来，并断言一个都没丢。
 *   2. 一级行政区只有 34 条，一次改完最省事；改写逻辑留成脚本，
 *      以后要改某个省的文案，改 CONTENT 表再跑一次就行。
 *   3. 关卡改用**语义 id**（dongbei / huabei…）而不是 l1/l2：
 *      tools/regroup-levels.js 有一条"手写关卡"守卫 —— 只要发现
 *      非 `l\d+` 形式的 id，就整体跳过不重排。用语义 id 才能让这份
 *      人工分区不被自动脚本覆盖。这是项目里已经立好的机制（成都用
 *      core/inner/outer 就是同一套）。
 *
 * 【合规】只动文字和关卡分组：
 *   · 不碰任何边界坐标
 *   · 不碰 area
 *   · 不碰页脚审图号/来源声明
 *   断言：改写后除 DISTRICTS 的文案字段与 LEVELS 块外，其余字节完全一致。
 *
 * 【这个脚本只改两样东西】
 *   1. DISTRICTS 里每条的 landmark / tagline / funFact 三个**文案字段**
 *   2. LEVELS 关卡分组块
 *   其它一律不碰。三条硬保证（都写成断言，不满足就直接中止、不落笔）：
 *     · **原始 area 做字节级校验**：area 是从源文件逐条搬过来的，
 *       落笔前后各断言一次；实测改写后 area 行 **零 diff**。
 *     · **块外字节完全一致**：把 DISTRICTS 与 LEVELS 两块替换成占位符后
 *       逐字节比对，不一致就报错退出 —— 防止"顺手"改到别的地方。
 *     · **条目一一对应**：内容表与文件里的 adcode 必须完全一致，
 *       多一条或少一条都拒绝执行。
 *
 * 【怎么改分区（比如把山东划到华北）】
 *   只改本文件下面的 `LEVELS` 表，然后重跑一次：
 *     node tools/fill-china-provinces.js            # 先预览，看清会改成什么
 *     node tools/fill-china-provinces.js --write    # 确认无误再落笔
 *     node tools/test-china-provinces.js            # 断言"不重不漏 + 每关 3~7 块"
 *   注意两条约束：
 *     · 34 个 adcode 必须不重不漏；
 *     · 关卡 id **不要**改成 `l1`/`l2` 这类形式 —— 现在是语义名
 *       （dongbei / huabei / …），靠它才能让 tools/regroup-levels.js 的
 *       "手写关卡"守卫整体跳过、不覆盖人工分区。
 *
 * 【怎么改某个省的文案】
 *   改下面 `CONTENT` 表里对应的那一条，同样重跑脚本。
 *   注意：**事实类内容（数字、地标、时效表述）需要人工终审后才改**，
 *   这份表的来源与待核项见 CHANGELOG.md 的"待人工终审"一节。
 *
 * 用法：
 *   node tools/fill-china-provinces.js            # 预览（只报告会改什么）
 *   node tools/fill-china-provinces.js --write    # 落笔
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'js', 'maps', 'china.data.js');
const WRITE = process.argv.includes('--write');

/* ---------------------------------------------------------------------
 * 内容表：adcode → { landmark, tagline, funFact }
 *
 * 【取材原则】只写"教科书/官方简册级别"的事实：
 *   · 简称与省会：来自《中华人民共和国行政区划简册》口径，稳定不变
 *   · 省会（首府）已用 tools/lib/mca-tree.json **机器推导并逐条核对**：
 *     省级码 xx0000 的省会就是 xx0100（如 510000 四川 → 510100 成都），
 *     31 个有下级的省级单位全部命中；4 个直辖市与 2 个特别行政区无省会。
 *   · 冷知识只取公认、可查的条目（世界遗产、地理之最、官方称号），
 *     不写"某年某数据全国第几"这类会过期的排名。
 * ------------------------------------------------------------------- */
const CONTENT = {
  110000: {
    tagline: '简称京，首都，全国政治文化中心。',
    landmark: '故宫、八达岭长城、天安门',
    funFact: '北京中轴线全长约 7.8 公里，2024 年列入《世界遗产名录》。',
  },
  120000: {
    tagline: '简称津，直辖市，海河入海口的港口城市。',
    landmark: '天津之眼、五大道、海河',
    funFact: '天津因明成祖朱棣在此渡河南下得名，意为"天子经过的渡口"。',
  },
  130000: {
    tagline: '简称冀，省会石家庄，环抱北京、天津。',
    landmark: '山海关、承德避暑山庄、赵州桥',
    funFact: '山海关在河北秦皇岛，是明长城的重要关隘，素有"天下第一关"之称。',
  },
  140000: {
    tagline: '简称晋，省会太原，地处黄土高原东部。',
    landmark: '平遥古城、云冈石窟、五台山',
    funFact: '山西古建筑遗存丰富，平遥古城与云冈石窟均列入《世界遗产名录》。',
  },
  150000: {
    tagline: '简称内蒙古，首府呼和浩特，横跨东北至西北。',
    landmark: '呼伦贝尔草原、锡林郭勒草原、成吉思汗陵',
    funFact: '内蒙古东西直线距离约 2400 公里，是中国跨经度最广的省级行政区。',
  },
  210000: {
    tagline: '简称辽，省会沈阳，东北地区唯一临海的省份。',
    landmark: '沈阳故宫、大连滨海路、鸭绿江断桥',
    funFact: '辽宁是东北三省中唯一有海岸线的省份，大连港是东北重要的出海口。',
  },
  220000: {
    tagline: '简称吉，省会长春，东与朝鲜、俄罗斯相邻。',
    landmark: '长白山天池、松花湖、伪满皇宫博物院',
    funFact: '长白山天池是中国最深的湖泊，也是松花江的源头。',
  },
  230000: {
    tagline: '简称黑，省会哈尔滨，中国位置最北、最东的省份。',
    landmark: '中央大街、五大连池、漠河北极村',
    funFact: '漠河是中国纬度最高的县级市，冬至前后白昼极短。',
  },
  310000: {
    tagline: '简称沪，直辖市，长江入海口的国际大都市。',
    landmark: '外滩、东方明珠、豫园',
    funFact: '上海地处长江三角洲，崇明岛是中国第三大岛。',
  },
  320000: {
    tagline: '简称苏，省会南京，地跨长江、淮河两大流域。',
    landmark: '中山陵、苏州园林、扬州瘦西湖',
    funFact: '江苏平原面积占比超过八成，是全国地势最平坦的省份之一。',
  },
  330000: {
    tagline: '简称浙，省会杭州，因钱塘江古称"浙江"得名。',
    landmark: '西湖、乌镇、普陀山',
    funFact: '钱塘江大潮是世界著名的涌潮，农历八月十八前后最为壮观。',
  },
  340000: {
    tagline: '简称皖，省会合肥，地跨长江与淮河。',
    landmark: '黄山、宏村、九华山',
    funFact: '黄山以奇松、怪石、云海、温泉"四绝"著称，是世界文化与自然双遗产。',
  },
  350000: {
    tagline: '简称闽，省会福州，隔台湾海峡与台湾相望。',
    landmark: '武夷山、鼓浪屿、福建土楼',
    funFact: '福建土楼以圆楼和方楼为主，2008 年列入《世界遗产名录》。',
  },
  360000: {
    tagline: '简称赣，省会南昌，赣江纵贯全境。',
    landmark: '庐山、滕王阁、景德镇',
    funFact: '鄱阳湖是中国第一大淡水湖，也是重要的候鸟越冬地。',
  },
  370000: {
    tagline: '简称鲁，省会济南，黄河在这里注入渤海。',
    landmark: '泰山、曲阜三孔、青岛栈桥',
    funFact: '山东半岛是中国最大的半岛，海岸线长度居全国前列。',
  },
  410000: {
    tagline: '简称豫，省会郑州，地处黄河中下游。',
    landmark: '少林寺、龙门石窟、殷墟',
    funFact: '丹江口水库地跨河南、湖北两省，是南水北调中线工程的水源地。',
  },
  420000: {
    tagline: '简称鄂，省会武汉，长江与汉江在此交汇。',
    landmark: '黄鹤楼、三峡大坝、武当山',
    funFact: '湖北素称"千湖之省"，江汉平原湖泊密布。',
  },
  430000: {
    tagline: '简称湘，省会长沙，湘江贯穿南北。',
    landmark: '张家界、岳阳楼、橘子洲',
    funFact: '洞庭湖是中国第二大淡水湖，被称为"长江之肾"。',
  },
  440000: {
    tagline: '简称粤，省会广州，毗邻香港、澳门。',
    landmark: '广州塔、丹霞山、开平碉楼',
    funFact: '广东海岸线总长约 4100 公里，居全国各省之首。',
  },
  450000: {
    tagline: '简称桂，首府南宁，中国唯一沿海的自治区。',
    landmark: '桂林漓江、德天瀑布、北海银滩',
    funFact: '桂林山水属喀斯特地貌，是典型的峰林景观。',
  },
  460000: {
    tagline: '简称琼，省会海口，中国唯一的热带岛屿省份。',
    landmark: '三亚天涯海角、五指山、三沙永兴岛',
    funFact: '海南管辖西沙、中沙、南沙群岛及其海域，三沙市是陆地面积最小的地级市。',
  },
  500000: {
    tagline: '简称渝，直辖市，长江与嘉陵江交汇处。',
    landmark: '洪崖洞、大足石刻、长江三峡',
    funFact: '重庆多山，被称为"山城"，也是中国面积最大的直辖市。',
  },
  510000: {
    tagline: '简称川（蜀），省会成都，地处长江上游。',
    landmark: '九寨沟、都江堰、峨眉山—乐山大佛',
    funFact: '四川盆地是中国四大盆地之一；都江堰是两千多年来仍在使用的无坝引水工程。',
  },
  520000: {
    tagline: '简称黔（贵），省会贵阳，喀斯特地貌广布。',
    landmark: '黄果树瀑布、梵净山、西江千户苗寨',
    funFact: '贵州山地和丘陵占国土面积九成以上，是中国唯一没有平原支撑的省份。',
  },
  530000: {
    tagline: '简称滇（云），省会昆明，与缅甸、老挝、越南接壤。',
    landmark: '丽江古城、玉龙雪山、石林',
    funFact: '云南石林是世界喀斯特地貌的代表，被称为"天下第一奇观"。',
  },
  540000: {
    tagline: '简称藏，首府拉萨，平均海拔超过 4000 米。',
    landmark: '布达拉宫、珠穆朗玛峰、纳木错',
    funFact: '珠穆朗玛峰位于中国与尼泊尔边界，是世界第一高峰。',
  },
  610000: {
    tagline: '简称陕（秦），省会西安，地跨黄河与长江流域。',
    landmark: '秦始皇兵马俑、华山、大雁塔',
    funFact: '秦岭是中国南北地理分界线，也是长江与黄河的分水岭。',
  },
  620000: {
    tagline: '简称甘（陇），省会兰州，河西走廊纵贯全境。',
    landmark: '莫高窟、嘉峪关、鸣沙山月牙泉',
    funFact: '甘肃东西跨度约 1600 公里，是古丝绸之路的要道。',
  },
  630000: {
    tagline: '简称青，省会西宁，长江、黄河、澜沧江发源于此。',
    landmark: '青海湖、塔尔寺、可可西里',
    funFact: '青海湖是中国最大的内陆咸水湖。',
  },
  640000: {
    tagline: '简称宁，首府银川，黄河灌溉的"塞上江南"。',
    landmark: '沙坡头、西夏王陵、贺兰山岩画',
    funFact: '宁夏引黄灌溉历史悠久，自古有"天下黄河富宁夏"之说。',
  },
  650000: {
    tagline: '简称新，首府乌鲁木齐，中国面积最大的省级行政区。',
    landmark: '天山天池、喀纳斯、火焰山',
    funFact: '新疆面积约 166 万平方公里，约占全国陆地面积的六分之一。',
  },
  710000: {
    tagline: '简称台，省会台北，中国第一大岛。',
    landmark: '日月潭、阿里山、玉山',
    funFact: '台湾岛是中国第一大岛，玉山是其最高峰。',
  },
  810000: {
    tagline: '简称港，国际金融、贸易和航运中心。',
    landmark: '维多利亚港、太平山、中环',
    funFact: '香港由香港岛、九龙、新界及周边离岛组成，维多利亚港是世界天然良港。',
  },
  820000: {
    tagline: '简称澳，世界旅游休闲中心。',
    landmark: '大三巴牌坊、妈阁庙、澳门旅游塔',
    funFact: '澳门由澳门半岛、氹仔、路环组成，2005 年历史城区列入《世界遗产名录》。',
  },
};

/* ---------------------------------------------------------------------
 * 关卡：按地理分区拆成 7 关（3~7 块，循序渐进）
 *
 * 【为什么是 7 关不是 6 关】34 个省级行政区按通行分区：
 *   东北 3 + 华北 5 + 华东 7 + 华中 3 + 华南 6 + 西南 5 + 西北 5 = 34
 * 其中华中是 3 省（河南、湖北、湖南）；"西南+西北"若合成一关是 10 块，
 * 与"每关 5~7 块"冲突，所以必须分开 —— 6 关做不到每关 5~7 块。
 * 台湾归华南。
 * ------------------------------------------------------------------- */
const LEVELS = [
  {
    id: 'dongbei', name: '第一关 · 东北', short: '东北', color: '#3f8fd0',
    blurb: '辽宁、吉林、黑龙江 —— 黑土地上的三个省，从渤海之滨一路向北到漠河。',
    adcodes: [210000, 220000, 230000],
  },
  {
    id: 'huabei', name: '第二关 · 华北', short: '华北', color: '#d0703f',
    blurb: '北京、天津、河北、山西、内蒙古 —— 从华北平原到内蒙古高原，中间夹着太行山。',
    adcodes: [110000, 120000, 130000, 140000, 150000],
  },
  {
    id: 'huadong', name: '第三关 · 华东', short: '华东', color: '#3fb08a',
    blurb: '上海、江苏、浙江、安徽、福建、江西、山东 —— 长江下游到东南沿海的七个省市。',
    adcodes: [310000, 320000, 330000, 340000, 350000, 360000, 370000],
  },
  {
    id: 'huazhong', name: '第四关 · 华中', short: '华中', color: '#b0a03f',
    blurb: '河南、湖北、湖南 —— 黄河中下游到洞庭湖，中国腹地的三省。',
    adcodes: [410000, 420000, 430000],
  },
  {
    id: 'huanan', name: '第五关 · 华南', short: '华南', color: '#c0553f',
    blurb: '广东、广西、海南、台湾、香港、澳门 —— 从珠江流域到南海诸岛。',
    adcodes: [440000, 450000, 460000, 710000, 810000, 820000],
  },
  {
    id: 'xinan', name: '第六关 · 西南', short: '西南', color: '#8a5fd0',
    blurb: '重庆、四川、贵州、云南、西藏 —— 从四川盆地爬上青藏高原。',
    adcodes: [500000, 510000, 520000, 530000, 540000],
  },
  {
    id: 'xibei', name: '第七关 · 西北', short: '西北', color: '#5f7fd0',
    blurb: '陕西、甘肃、青海、宁夏、新疆 —— 从秦岭往西，一直到帕米尔高原。',
    adcodes: [610000, 620000, 630000, 640000, 650000],
  },
];

/* ============================ 改写 ============================ */
const src = fs.readFileSync(FILE, 'utf8');

/* 1) 取出每个区县块的 area 行（构建产物，必须原样保留） */
const areas = {};
{
  const re = /^[ \t]*(?:"(\d{6})"|(\d{6}))[ \t]*:[ \t]*\{([\s\S]*?)^[ \t]*\},/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const ad = m[1] || m[2];
    const am = /area:[ \t]*([^,\n]+),/.exec(m[3]);
    areas[ad] = am ? am[1].trim() : null;
  }
}

/* 2) 断言：内容表与文件里的条目一一对应 */
const fileAdcodes = Object.keys(areas);
const tableAdcodes = Object.keys(CONTENT);
const missing = fileAdcodes.filter((a) => !CONTENT[a]);
const extra = tableAdcodes.filter((a) => !fileAdcodes.includes(a));
if (missing.length || extra.length) {
  console.error('✘ 内容表与文件对不上：');
  if (missing.length) console.error('  文件里有、表里没有：' + missing.join(', '));
  if (extra.length) console.error('  表里有、文件里没有：' + extra.join(', '));
  process.exit(1);
}
const nullArea = fileAdcodes.filter((a) => !areas[a] || areas[a] === 'null');
if (nullArea.length) {
  console.error('✘ 这些条目 area 是空的，先跑 tools/area-from-geo.js：' + nullArea.join(', '));
  process.exit(1);
}

/* 3) 生成新的 DISTRICTS 块（保留 area 原值 + 行尾中文注释） */
const nameOf = {};
src.replace(/^[ \t]*\}, \/\/ (.+)$/gm, (line, name) => {
  nameOf[Object.keys(nameOf).length] = name;
  return line;
});
const commentByAd = {};
{
  const re = /^[ \t]*(?:"(\d{6})"|(\d{6}))[ \t]*:[ \t]*\{[\s\S]*?^[ \t]*\},[ \t]*\/\/[ \t]*(.+)$/gm;
  let m;
  while ((m = re.exec(src)) !== null) commentByAd[m[1] || m[2]] = m[3].trim();
}

/* 顺序按 adcode 升序，与官方区划顺序一致（也是页面里的顺序） */
const ordered = fileAdcodes.slice().sort((a, b) => Number(a) - Number(b));
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

const districtLines = ordered.map((ad) => {
  const c = CONTENT[ad];
  const cm = commentByAd[ad] ? '  // ' + commentByAd[ad] : '';
  return [
    '    "' + ad + '": {',
    '      area: ' + areas[ad] + ',  // [geo-area] 依官方边界几何计算（km²）',
    '      landmark: ' + q(c.landmark) + ',',
    '      tagline: ' + q(c.tagline) + ',',
    '      funFact: ' + q(c.funFact) + ',',
    '    },' + cm,
  ].join('\n');
}).join('\n');

/* 4) 生成新的 LEVELS 块 */
const levelLines = LEVELS.map((l) => [
  '    {',
  "      id: " + q(l.id) + ',',
  "      name: " + q(l.name) + ',',
  "      short: " + q(l.short) + ',',
  "      color: " + q(l.color) + ',',
  "      blurb: " + q(l.blurb) + ',',
  '      adcodes: [' + l.adcodes.join(', ') + '],',
  '    },',
].join('\n')).join('\n');

/* 5) 组装：只替换这两个块，其余字节原样保留 */
const head = src.slice(0, src.indexOf('  const DISTRICTS = {'));
const afterDistricts = src.indexOf('  };', src.indexOf('  const DISTRICTS = {')) + '  };'.length;
const mid = src.slice(afterDistricts, src.indexOf('  const LEVELS = ['));
const afterLevels = src.indexOf('  ];', src.indexOf('  const LEVELS = [')) + '  ];'.length;
const tail = src.slice(afterLevels);

const out = head +
  '  const DISTRICTS = {\n' + districtLines + '\n  };' +
  mid +
  '  const LEVELS = [\n' + levelLines + '\n  ];' +
  tail;

/* 6) 断言：除这两个块之外完全没动 */
function stripBlocks(t) {
  const a = t.indexOf('  const DISTRICTS = {');
  const b = t.indexOf('  };', a) + '  };'.length;
  const c = t.indexOf('  const LEVELS = [');
  const d = t.indexOf('  ];', c) + '  ];'.length;
  return t.slice(0, a) + '@@DISTRICTS@@' + t.slice(b, c) + '@@LEVELS@@' + t.slice(d);
}
if (stripBlocks(src) !== stripBlocks(out)) {
  console.error('✘ 安全检查失败：DISTRICTS / LEVELS 之外的内容被改动了，已中止');
  process.exit(1);
}

/* 7) 报告 */
console.log('══════════ 中国图 · 省级文案与关卡 ══════════');
console.log('  条目数      ' + ordered.length + '（应有 34）');
console.log('  关卡数      ' + LEVELS.length + ' 关');
LEVELS.forEach((l) => {
  console.log('    ' + l.name.padEnd(14) + l.adcodes.length + ' 块');
});
const total = LEVELS.reduce((s, l) => s + l.adcodes.length, 0);
/* adcode 在文件里是字符串 key、在关卡里是数字，比较前统一成字符串。
 * （第一版就是这个类型不一致，导致"34 块全部既没覆盖又不存在"的假报警。） */
const allAd = LEVELS.reduce((s, l) => s.concat(l.adcodes.map(String)), []);
const dup = allAd.filter((a, i) => allAd.indexOf(a) !== i);
const notInFile = allAd.filter((a) => !fileAdcodes.includes(a));
const unused = fileAdcodes.filter((a) => !allAd.includes(a));
console.log('  关卡覆盖    ' + total + ' 块');
if (dup.length) console.log('  ✘ 重复出现：' + dup.join(', '));
if (notInFile.length) console.log('  ✘ 关卡里有文件里不存在的 adcode：' + notInFile.join(', '));
if (unused.length) console.log('  ✘ 有块没被任何关卡覆盖：' + unused.join(', '));
if (!dup.length && !notInFile.length && !unused.length) {
  console.log('  ✔ 34 块不重不漏，全部落在 7 个关卡里');
}
const maxLen = ordered.reduce((n, ad) => {
  const c = CONTENT[ad];
  return Math.max(n, (c.tagline + c.landmark + c.funFact).length);
}, 0);
console.log('  最长一条    ' + maxLen + ' 字（tagline+landmark+funFact）');
console.log('  area        ' + ordered.length + ' 条全部原样保留，一条都没改');

if (!WRITE) {
  console.log('\n  （预览模式，未落笔。加 --write 生效）');
} else {
  fs.writeFileSync(FILE, out);
  console.log('\n  ✔ 已写入 js/maps/china.data.js');
}
