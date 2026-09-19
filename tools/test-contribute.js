#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 众包纠错 · 离线自测
 * ---------------------------------------------------------------------
 * 路径：tools/test-contribute.js（接入 e2e-test.js 的"离线检查"套件）
 *
 * 【为什么必须测】
 * 这个模块唯一的产出是"给用户看的文本和链接"。它错了不会崩，
 * 只会静默地把人送到一个 404 的 Issue 页面，或者让维护者收到一条
 * 定位不到字段的反馈 —— 两种失败都不会报错，只能靠断言钉住。
 *
 * 尤其要钉住的三件事：
 *   1. 没配 repo 时**不许**给出死链（宁可降级成复制剪贴板）
 *   2. adcode 必须出现在正文里（它是唯一能把反馈对回数据的钥匙）
 *   3. 中文和换行必须被正确 URL 编码（否则 GitHub 会截断）
 * ===================================================================== */

const path = require('path');

require(path.join(__dirname, '..', 'js', 'contribute.js'));
const C = globalThis.MapContribute;

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

console.log('══════════ 众包纠错 · 离线自测 ══════════');

/** 一份"资料完整"的样本：用来测纠错路径 */
const FULL = {
  mapId: 'leshan',
  mapName: '乐山市',
  adcode: 511112,
  districtName: '五通桥区',
  levelIndex: 0,
  levelName: '市辖区',
  current: {
    area: 465,
    landmark: '五通桥古镇、小西湖',
    tagline: '因盐而兴的老工业区，也是远近闻名的水乡。',
    funFact: '五通桥因盐业兴盛，当地把穿城而过的水面称作"小西湖"。',
  },
};

/** 一份"全是占位"的样本：用来测补资料路径 */
const EMPTY = {
  mapId: 'leshan',
  mapName: '乐山市',
  adcode: 511133,
  districtName: '马边彝族自治县',
  levelIndex: 1,
  levelName: '县',
  current: {},
};

/* ---------- 配置与降级：没配仓库就不许产生死链 ---------- */
{
  C.configure({ repo: '', email: '', site: '' });
  check('repo 为空 → isRepoReady() = false', C.isRepoReady() === false);
  check('repo 为空 → issueUrl() 返回空串（不给死链）', C.issueUrl(FULL) === '', C.issueUrl(FULL));
  check('email 为空 → mailtoUrl() 返回空串', C.mailtoUrl(FULL) === '');
  check('此时剪贴板文案仍然可用（兜底通道不能断）',
    C.clipboardText(FULL).indexOf('五通桥区') >= 0);

  C.configure({ repo: 'someone/map-puzzle' });
  check('repo 合法 → isRepoReady() = true', C.isRepoReady() === true);
  check('repo 带空格 → 仍然判为不可用',
    (C.configure({ repo: 'someone / map-puzzle' }), C.isRepoReady() === false));
  C.configure({ repo: 'someone/map-puzzle' });
}

/* ---------- 标题：纠错 vs 补资料要能一眼分清 ---------- */
{
  check('资料齐全 → 标题是「资料纠错」', C.title(FULL).indexOf('[资料纠错]') === 0, C.title(FULL));
  check('标题包含地图名和区县名',
    C.title(FULL).indexOf('乐山市') >= 0 && C.title(FULL).indexOf('五通桥区') >= 0, C.title(FULL));
  check('标题包含 adcode', C.title(FULL).indexOf('511112') >= 0, C.title(FULL));
  check('资料全空 → 标题是「资料补充」', C.title(EMPTY).indexOf('[资料补充]') === 0, C.title(EMPTY));
  check('占位符「—」也算缺失', C.missingFields({ current: { area: '—' } }).indexOf('area') >= 0);
  check('空字符串算缺失', C.missingFields({ current: { area: '' } }).length === 4);
}

/* ---------- 正文：adcode 必须在，这是对回数据的唯一钥匙 ---------- */
{
  const body = C.body(FULL);
  check('正文含 adcode', body.indexOf('511112') >= 0);
  check('正文含地图 id', body.indexOf('`leshan`') >= 0, body.slice(0, 120));
  check('正文含关卡名', body.indexOf('市辖区') >= 0);
  check('正文列出全部 4 个字段',
    ['面积', '地标', '一句话介绍', '冷知识'].every((k) => body.indexOf(k) >= 0));
  check('正文回显了页面上现有的值', body.indexOf('465') >= 0);
  check('正文留了「应该是」的空位', body.indexOf('### 应该是') >= 0);
  check('正文要求填来源（不许无来源改数据）', body.indexOf('### 来源') >= 0);
  check('资料全空时不再回显字段值，而是勾出待补项',
    C.body(EMPTY).indexOf('- [x] 面积') >= 0, C.body(EMPTY).slice(0, 400));
  check('资料齐全时没有待补勾选',
    C.body(FULL).indexOf('- [x]') < 0);
}

/* ---------- Issue 链接：URL 必须编好码，否则 GitHub 会截断 ---------- */
{
  C.configure({ repo: 'someone/map-puzzle' });
  const url = C.issueUrl(FULL);
  check('链接指向 issues/new', url.indexOf('https://github.com/someone/map-puzzle/issues/new?') === 0, url.slice(0, 80));
  check('链接不含裸换行（必须编码成 %0A）', url.indexOf('\n') < 0);
  check('链接不含裸中文（必须编码）', /[\u4e00-\u9fa5]/.test(url) === false);
  check('解码后能拿回原始标题', decodeURIComponent(url.split('title=')[1].split('&')[0]) === C.title(FULL));
  check('解码后能拿回原始正文', decodeURIComponent(url.split('&body=')[1]) === C.body(FULL));
}

/* ---------- 邮件通道：给没有 GitHub 账号的人（老师、家长） ---------- */
{
  C.configure({ email: 'me@example.com' });
  const mail = C.mailtoUrl(FULL);
  check('mailto 指向配置的邮箱', mail.indexOf('mailto:me@example.com?') === 0, mail.slice(0, 40));
  check('mailto 的 subject 已编码', /[\u4e00-\u9fa5]/.test(mail) === false);
  C.configure({ email: 'not-an-email' });
  check('邮箱格式不对 → 判为不可用', C.isEmailReady() === false);
  C.configure({ email: '' });
}

/* ---------- siteUrlFor：报告里带得上"我是在哪看到的" ---------- */
{
  C.configure({ site: 'https://example.pages.dev/index.html?x=1' });
  check('站点地址会剥掉原有的查询串和锚点',
    C.siteUrlFor(FULL) === 'https://example.pages.dev/index.html?map=leshan&level=1',
    C.siteUrlFor(FULL));

  /* 【为什么要测"自动推断"】此前 site 是在 index.html 里写死的，
   * 结果写成了另一个项目的域名（`map-puzzle-89v.pages.dev`，而真实站点在
   * `-1v6` 后缀上），纠错报告会链到别人的旧站。
   * 改成"从当前页面地址推断"之后，部署到哪个域名都自动是对的。
   * 这条断言就是把那个防腐烂的行为钉住。 */
  const hadLoc = 'location' in globalThis;
  const savedLoc = hadLoc ? globalThis.location : undefined;
  try {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { protocol: 'https:', origin: 'https://real-site.pages.dev', pathname: '/index.html' },
    });
    C.configure({ site: '' });
    check('site 留空时从当前页面地址自动推断（防站点地址写死腐烂）',
      C.siteUrlFor(FULL) === 'https://real-site.pages.dev/index.html?map=leshan&level=1',
      C.siteUrlFor(FULL));

    /* file:// 下没有可用的 origin，应当老实返回空串而不是编一个 */
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { protocol: 'file:', origin: 'null', pathname: '/x/index.html' },
    });
    check('file:// 打开时不编造地址（返回空串）',
      C.siteUrlFor(FULL) === '', C.siteUrlFor(FULL));
    delete globalThis.location;
    check('没有 location 时也不编造地址（返回空串）',
      C.siteUrlFor(FULL) === '', C.siteUrlFor(FULL));
  } finally {
    if (hadLoc) {
      Object.defineProperty(globalThis, 'location', { configurable: true, value: savedLoc });
    } else {
      delete globalThis.location;
    }
  }

  C.configure({ site: '' });
  check('没有 mapId → 返回空串', C.siteUrlFor({}) === '');
}

/* ---------- 异常输入不崩 ---------- */
{
  C.configure({ repo: 'someone/map-puzzle' });
  let ok = true;
  try {
    C.title(undefined); C.body(null); C.issueUrl(undefined);
    C.missingFields({}); C.clipboardText({});
  } catch (e) { ok = false; }
  check('传入 undefined / null 不抛异常', ok);
}

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
