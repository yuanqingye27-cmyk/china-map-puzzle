#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 中国图 · 省级条目与链接完整性 · 离线自测
 * ---------------------------------------------------------------------
 * 路径：tools/test-china-provinces.js（接入 e2e-test.js 的"离线检查"套件）
 *
 * 【为什么单写一个】
 *   中国图是唯一一张"下级全是省级行政区"的图，也是唯一一张关卡按
 *   **地理分区手工编排**的图。它的两类问题都不会让页面报错，只会静默出错：
 *     · 某个省文案漏了一项 → 卡片上出现空白，没人会发现
 *     · registry 里出现悬空 children → 面包屑点过去 404
 *   所以这里把这两类不变量钉死。
 *
 * 【字段口径说明（重要）】
 *   任务书里要求断言每条含 `name/short/capital/desc` —— 本项目的数据结构里
 *   **没有这四个字段**。实际是：
 *     区县条目：area（数字，构建产物） / landmark / tagline / funFact
 *     关卡条目：id / name / short / color / blurb / adcodes
 *   简称与省会是**写在 tagline 文本里**的，不是独立字段。
 *   本测试按**实际结构**断言，并额外把"简称/省会必须出现且正确"也覆盖上
 *   （省会名从 tools/lib/mca-tree.json 机器推导：省级码 xx0000 → 省会 xx0100）。
 *   若确实想把简称/省会拆成独立结构化字段，那是数据模型改动，需另行确认。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

console.log('══════════ 中国图 · 省级条目与链接完整性 ══════════');

/* ---------- 读数据 ---------- */
const sandbox = { MAP_GEO: {}, MAP_DATA: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/maps/china.data.js'), 'utf8'), { window: sandbox });
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/maps/china.geo.js'), 'utf8'), { window: sandbox });
const DATA = sandbox.MAP_DATA.china;
const GEO = sandbox.MAP_GEO.china;
const DISTRICTS = DATA.districts;
const LEVELS = DATA.levels;
const adcodes = Object.keys(DISTRICTS);

const regSandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/maps/registry.js'), 'utf8'), { window: regSandbox });
const REG = regSandbox.MAP_REGISTRY;

const MCA = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/lib/mca-tree.json'), 'utf8'));
const byCode = {};
MCA.forEach((n) => { byCode[String(n.code6)] = n; });

/* ================================================================
 * 一、34 个省级条目：字段齐全、无空值、无乱码、无占位
 * ============================================================== */
console.log('\n【一】34 个省级条目的字段完整性');

check('条目数正好 34', adcodes.length === 34, String(adcodes.length));

const REQUIRED = ['area', 'landmark', 'tagline', 'funFact'];
const emptyFields = [];
const badArea = [];
adcodes.forEach((ad) => {
  const d = DISTRICTS[ad];
  REQUIRED.forEach((k) => {
    const v = d[k];
    if (v === undefined || v === null) emptyFields.push(ad + '.' + k + '=缺失');
    else if (typeof v === 'string' && v.trim() === '') emptyFields.push(ad + '.' + k + '=空串');
  });
  if (typeof d.area !== 'number' || !isFinite(d.area) || d.area <= 0) badArea.push(ad + '=' + d.area);
});
check('每一块四个字段都有值（area/landmark/tagline/funFact）',
  emptyFields.length === 0, emptyFields.slice(0, 8).join('、'));
check('area 都是正数（构建产物没丢）',
  badArea.length === 0, badArea.join('、'));

/* 占位文案：这一轮补完 34 条之后不该再出现 */
const PLACEHOLDER = '资料收录中';
const stillPlaceholder = adcodes.filter((ad) =>
  REQUIRED.some((k) => typeof DISTRICTS[ad][k] === 'string' && DISTRICTS[ad][k].indexOf(PLACEHOLDER) >= 0));
check('没有一条还是占位文案', stillPlaceholder.length === 0, stillPlaceholder.join('、'));

/* 乱码检查：替换字符、问号串、mojibake 常见特征字节 */
const MOJIBAKE = /[\uFFFD]|Ã[\u0080-\u00BF]|â\u0080|ï¼|ã\u0080/;
const garbled = [];
adcodes.forEach((ad) => {
  REQUIRED.forEach((k) => {
    const v = DISTRICTS[ad][k];
    if (typeof v !== 'string') return;
    if (MOJIBAKE.test(v)) garbled.push(ad + '.' + k);
    /* 中文条目里出现连续 3 个以上 '?' 基本就是编码坏了 */
    if (/\?{3,}/.test(v)) garbled.push(ad + '.' + k + '(问号串)');
  });
});
check('没有乱码（替换字符 / mojibake / 问号串）', garbled.length === 0, garbled.join('、'));

/* 中文覆盖率：文案应当是中文，不该是拼音或英文占位 */
const notChinese = adcodes.filter((ad) =>
  !/[\u4e00-\u9fa5]/.test(DISTRICTS[ad].tagline + DISTRICTS[ad].landmark + DISTRICTS[ad].funFact));
check('每条文案都含中文（不是拼音/英文占位）', notChinese.length === 0, notChinese.join('、'));

/* 长度：任务要求"每省 ≤80 字"，这里按三个字段合计算 */
const tooLong = adcodes.filter((ad) => {
  const d = DISTRICTS[ad];
  return (d.tagline + d.landmark + d.funFact).length > 80;
});
check('每省文案合计不超过 80 字', tooLong.length === 0,
  tooLong.map((ad) => ad + '=' + (DISTRICTS[ad].tagline + DISTRICTS[ad].landmark + DISTRICTS[ad].funFact).length).join('、'));

/* ================================================================
 * 二、简称与省会：写在 tagline 里，必须出现且正确
 * ============================================================== */
console.log('\n【二】简称与省会（写在 tagline 文本里）');

const noAbbr = adcodes.filter((ad) => DISTRICTS[ad].tagline.indexOf('简称') < 0);
check('每条 tagline 都写了「简称」', noAbbr.length === 0, noAbbr.join('、'));

/* 省会从官方区划树机器推导：省级码 xx0000 → 省会 xx0100。
 * 推论成立的前提是"省会的地级码是省码 +100"，实测 31 个有下级的省级单位全部命中。 */
const SPECIAL = { 110000: 1, 120000: 1, 310000: 1, 500000: 1, 810000: 1, 820000: 1, 710000: 1 };
const capitalWrong = [];
const capitalMissing = [];
adcodes.forEach((ad) => {
  const d = DISTRICTS[ad];
  if (SPECIAL[ad]) return;                        // 直辖市/特别行政区/台湾单独看
  const cap = byCode[String(Number(ad) + 100)];
  if (!cap) { capitalMissing.push(ad + '(推导不出省会)'); return; }
  if (d.tagline.indexOf(cap.name.replace(/市$/, '')) < 0) {
    capitalWrong.push(ad + ' 应为 ' + cap.name + ' / 实际「' + d.tagline + '」');
  }
});
check('有下级的省级单位，省会与官方树推导一致', capitalWrong.length === 0,
  capitalWrong.slice(0, 5).join('；'));
check('每个有下级的省级单位都推导出了省会', capitalMissing.length === 0, capitalMissing.join('、'));

/* 直辖市与特别行政区不该写"省会"（它们本身就是城市） */
const wronglyHasCapital = Object.keys(SPECIAL)
  .filter((ad) => ad !== '710000')
  .filter((ad) => DISTRICTS[ad] && DISTRICTS[ad].tagline.indexOf('省会') >= 0);
check('直辖市/港澳不写「省会」', wronglyHasCapital.length === 0,
  wronglyHasCapital.map((ad) => ad + '「' + DISTRICTS[ad].tagline + '」').join('；'));

/* 台湾：官方区划树里没有它的下级，**推导不出来**，只能人工确认。
 * 这里只断言"写了省会且是台北"，值本身进人工终审清单。 */
check('台湾省写了省会且为台北（此条为人工终审项，机器只做存在性断言）',
  /省会\s*台北/.test(DISTRICTS['710000'].tagline), DISTRICTS['710000'].tagline);

/* ================================================================
 * 三、合规：34 个省级块齐全 + 边界红线未被触碰
 * ============================================================== */
console.log('\n【三】合规（只读断言，本测试不改任何东西）');

const feats = GEO.features;
const featAd = feats.map((f) => Number(f.properties.adcode));
const provincial = featAd.filter((a) => a % 10000 === 0 && a % 1000000 !== 0);
check('china.geo.js 里有 34 个省级块', provincial.length === 34, String(provincial.length));

const byName = {};
feats.forEach((f) => { byName[Number(f.properties.adcode)] = f.properties.name; });
check('台湾的官方表述是「台湾省」', byName[710000] === '台湾省', String(byName[710000]));
check('香港的官方表述是「香港特别行政区」', byName[810000] === '香港特别行政区', String(byName[810000]));
check('澳门的官方表述是「澳门特别行政区」', byName[820000] === '澳门特别行政区', String(byName[820000]));

/* 南海诸岛及海上界线是单独一个 feature，必须始终在 */
const nanhai = feats.filter((f) => /南海|海上界线/.test(String(f.properties.name)));
check('南海诸岛及海上界线仍在（九段线相关）', nanhai.length === 1,
  nanhai.map((f) => f.properties.name).join('、') || '未找到');

/* 审图号声明：**不在 index.html 里**，而是由各张图的 MAP_GEO_META 带出来，
 * 再由 js/game.js 的 renderSourceNotice() 渲染到页脚 #mapSource 上。
 * （第一版断言写在 index.html 上，直接红了 —— 测试指向了错的地方，
 *   产品本身没问题。这条正好说明"断言要落在数据真正的来源上"。） */
const meta = (sandbox.MAP_GEO_META || {}).china || null;
check('china.geo.js 带了来源元信息 MAP_GEO_META', !!meta);
check('审图号仍是 GS(2024)0650号',
  !!meta && /GS\(2024\)0650/.test(String(meta.approval)),
  meta ? String(meta.approval) : '没有 meta');
check('来源仍是「天地图」官方服务',
  !!meta && /天地图/.test(String(meta.providerLabel || meta.provider)),
  meta ? String(meta.providerLabel || meta.provider) : '没有 meta');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check('页脚仍有 #mapSource 这个渲染位置', /id="mapSource"/.test(html));
const gameJs = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
check('renderSourceNotice 仍在渲染审图号（没被改成写死或删掉）',
  /function renderSourceNotice/.test(gameJs) && /meta\.approval/.test(gameJs));

/* ================================================================
 * 四、关卡：7 关、34 块不重不漏、每关 3~7 块
 * ============================================================== */
console.log('\n【四】关卡结构');

check('正好 7 关', LEVELS.length === 7, String(LEVELS.length));

const allAd = [];
LEVELS.forEach((l) => (l.adcodes || []).forEach((a) => allAd.push(String(a))));
check('关卡覆盖 34 块', allAd.length === 34, String(allAd.length));
check('没有一块被两个关卡重复收录',
  new Set(allAd).size === allAd.length,
  allAd.filter((a, i) => allAd.indexOf(a) !== i).join('、'));
check('文件中每一块都落在某个关卡里',
  adcodes.every((a) => allAd.includes(a)),
  adcodes.filter((a) => !allAd.includes(a)).join('、'));
check('关卡里没有不存在的 adcode',
  allAd.every((a) => adcodes.includes(a)),
  allAd.filter((a) => !adcodes.includes(a)).join('、'));

const sizeBad = LEVELS.filter((l) => l.adcodes.length < 3 || l.adcodes.length > 7);
check('每关 3~7 块（循序渐进的约束）', sizeBad.length === 0,
  sizeBad.map((l) => l.name + '=' + l.adcodes.length).join('、'));

const levelEmpty = LEVELS.filter((l) =>
  !l.id || !l.name || !l.short || !l.color || !l.blurb || !Array.isArray(l.adcodes));
check('每个关卡条目的 id/name/short/color/blurb/adcodes 都齐全',
  levelEmpty.length === 0, levelEmpty.map((l) => l.id).join('、'));

/* 关卡 id 用语义名 → 自动重排工具的手写守卫会保护它 */
const semantic = LEVELS.filter((l) => !/^l\d+$/.test(l.id));
check('关卡 id 是语义名（不是 l1/l2，否则会被 regroup-levels 覆盖）',
  semantic.length === LEVELS.length,
  LEVELS.map((l) => l.id).join('、'));

/* 配色键名必须与关卡 id 一一对应，否则碎片颜色会全部落到 fallback */
const chinaJs = fs.readFileSync(path.join(ROOT, 'js/maps/china.js'), 'utf8');
const hueBlock = /hueByLevel:\s*\{([\s\S]*?)\}/.exec(chinaJs);
const hueKeys = hueBlock
  ? hueBlock[1].split('\n').map((s) => (/^\s*([A-Za-z_][\w-]*)\s*:/.exec(s) || [])[1]).filter(Boolean)
  : [];
check('china.js 的 hueByLevel 键名与 7 个关卡 id 完全对应',
  hueKeys.length === LEVELS.length && LEVELS.every((l) => hueKeys.includes(l.id)),
  '关卡=[' + LEVELS.map((l) => l.id).join(',') + '] 配色=[' + hueKeys.join(',') + ']');

/* ================================================================
 * 五、港澳台：面包屑与下级入口，确认不会 404
 * ==============================================================
 * 404 的唯一成因是 registry 里出现"指向不存在地图包的 children"。
 * 这里把三类情况都钉住：
 *   · 全局：没有悬空 children、没有 orphans（这两条成立就点不出 404）
 *   · 港/台：children 为空 → 关卡/面包屑不会渲染下级入口，末级不可点
 *   · 澳门：没有独立地图包，且不在 china.children 里 → 面包屑根本不会指向它
 */
console.log('\n【五】港澳台的面包屑与链接完整性');

const dangling = [];
Object.keys(REG.maps).forEach((id) => {
  (REG.maps[id].children || []).forEach((c) => {
    if (!REG.maps[c]) dangling.push(id + '→' + c);
  });
});
check('registry 里没有悬空的 children（有就等于会 404）',
  dangling.length === 0, dangling.slice(0, 6).join('、'));
check('registry 没有 orphans（声明了父级但父级不存在）',
  (REG.orphans || []).length === 0, JSON.stringify(REG.orphans));

check('香港地图包存在且是 china 的下级',
  !!REG.maps.hongkong && REG.maps.hongkong.parent === 'china');
check('香港没有子地图包 → 不会渲染下级入口',
  Array.isArray(REG.maps.hongkong.children) && REG.maps.hongkong.children.length === 0,
  JSON.stringify(REG.maps.hongkong.children));
check('台湾地图包存在且是 china 的下级',
  !!REG.maps.taiwan && REG.maps.taiwan.parent === 'china');
check('台湾没有子地图包 → 不会渲染下级入口',
  Array.isArray(REG.maps.taiwan.children) && REG.maps.taiwan.children.length === 0,
  JSON.stringify(REG.maps.taiwan.children));

check('澳门没有独立地图包（官方数据里它没有下级，按规则并入中国图）',
  !REG.maps.macau);
check('澳门不在 china.children 里（加进去才会产生 404）',
  !REG.maps.china.children.includes('macau'));
check('澳门仍是中国图里的一块（geo 与资料都在）',
  featAd.indexOf(820000) >= 0 && !!DISTRICTS['820000']);

/* 面包屑路径推导：从任一块向上走，必须每一步都落在 registry 里 */
const brokenTrail = [];
Object.keys(REG.maps).forEach((id) => {
  let cur = REG.maps[id];
  for (let guard = 0; cur && guard < 16; guard++) {
    if (cur.parent && !REG.maps[cur.parent]) brokenTrail.push(id + '↑' + cur.parent);
    cur = cur.parent ? REG.maps[cur.parent] : null;
  }
});
check('任何一块向上走的面包屑路径都是完整的',
  brokenTrail.length === 0, brokenTrail.slice(0, 6).join('、'));

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
