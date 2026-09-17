#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 区县事实抽取 —— 一次联网 → 结构化 facts（**不往上下文灌原文**）
 * ---------------------------------------------------------------------
 * 路径：tools/lib/facts-source.js（公共库，不发散日志）
 *
 * 【为什么要有它】
 * 之前补一个市资料的流程是：每查一个区县 → 抓一个页面 → 把 2~6 KB 文本
 * 打印到 AI 的上下文 → AI 从里面挑一两句。一个市 11 个区县就是几十轮
 * tool call，每一轮都要重新联网、重新截断、重新读一遍。
 * token 烧的不是"页面大"，而是"**轮数多 × 每轮都要过一遍大模型**"。
 *
 * 这一层把"联网 + 解析 + 抽取"全部收进脚本：
 *   · 一次调用抓完一个市的全部区县
 *   · 只在脚本里做正则/切片，命中的句子之外一律不返回
 *   · 产物是一份**结构化 facts JSON**，可以入库、可以复核、可以复跑
 *
 * 【产出格式】每个区县一条：
 *   { adcode, name, source, fetchedAt,
 *     area: [{value, unit, text}],       // 面积相关句子
 *     intro: [text],                     // 概况/摘要
 *     spots: [text],                     // 景点/地标相关句子
 *     etymology: [text],                 // 名称由来
 *     sentences: [text] }                // 全部含数字/关键信息的句子（兜底）
 * ===================================================================== */

const path = require('path');
const fs = require('fs');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';

/* ---------- 磁盘缓存 ----------
 * 这是"同一份内容绝不抓两次"的硬保证，也是这次踩坑的核心教训：
 * 我把同一个词条反复抓了很多遍（调试抽取规则时每改一次就跑一遍全量），
 * 结果被站点 IP 限流，整条链路直接不可用。
 * 缓存目录 .cache/facts（已在 .gitignore 里），按 URL 的 sha1 存原始 HTML。 */
const CACHE_DIR = path.join(__dirname, '..', '..', '.cache', 'facts');
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000; // 30 天

function cachePath(url) {
  const h = require('crypto').createHash('sha1').update(url).digest('hex');
  return path.join(CACHE_DIR, h + '.html');
}

function cacheRead(url) {
  const p = cachePath(url);
  try {
    const st = fs.statSync(p);
    if (Date.now() - st.mtimeMs > CACHE_TTL_MS) return null;
    const buf = fs.readFileSync(p);
    if (buf.length < MIN_VALID_HTML) return null;
    return buf;
  } catch { return null; }
}

function cacheWrite(url, buf) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    if (buf.length >= MIN_VALID_HTML) fs.writeFileSync(cachePath(url), buf);
  } catch { /* 缓存失败不影响主流程 */ }
}

/** 把内联 script 里被转义的正文也解出来（乐山系站点/百科镜像都有这现象） */
function htmlToText(html) {
  const unesc = (s) =>
    s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\\//g, '/')
      .replace(/\\n/g, '\n');

  const inline = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => unesc(m[1]))
    .join('\n');

  const body = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ');

  const plain = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&times;/g, '×');

  return (inline + '\n' + plain).replace(/[ \t\u3000]+/g, ' ').replace(/\s*\n\s*/g, '\n');
}

/** 页面小到不可能是正文 → 多半是被限流/挡了（正常词条页 200KB~1MB） */
const MIN_VALID_HTML = 50 * 1024;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 抓取（带限流退避）。
 *
 * 实测踩坑：连续快速请求后，服务器开始返回 **6KB 左右的限流页**（正常 600KB+）。
 * 如果不识别，就会把"限流页"当正文抽取，得到 0 条命中 —— 更糟的是**静默**：
 * 下游会以为"这个词条没资料"，而不是"我被限流了"。
 * 所以这里：小页面直接判为限流 → 退避重试；重试仍失败就明确标 throttled。
 */
async function fetchText(url, opts) {
  opts = opts || {};
  const retries = opts.retries === undefined ? 3 : opts.retries;
  const useCache = opts.cache !== false;

  if (useCache) {
    const hit = cacheRead(url);
    if (hit) {
      let html = hit.toString('utf8');
      if (/charset=["']?(gb2312|gbk|gb18030)/i.test(html.slice(0, 3000)) || html.includes('\ufffd')) {
        try { html = new TextDecoder('gb18030').decode(hit); } catch { /* keep utf8 */ }
      }
      return { ok: true, status: 200, url, text: htmlToText(html), bytes: hit.length, cached: true, throttled: false };
    }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', Referer: 'https://www.baike.com/' },
      redirect: 'follow',
    });
    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) { await sleep(1200 * (attempt + 1)); continue; }
      return { ok: false, status: res.status, url: res.url, text: '', throttled: false };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    let html = buf.toString('utf8');
    if (/charset=["']?(gb2312|gbk|gb18030)/i.test(html.slice(0, 3000)) || html.includes('\ufffd')) {
      try { html = new TextDecoder('gb18030').decode(buf); } catch { /* keep utf8 */ }
    }
    if (buf.length < MIN_VALID_HTML) {
      // 被限流：退避后重试；最后一次仍小就如实报告，不冒充"无资料"
      await sleep(1500 * (attempt + 1) * (attempt + 1));
      if (attempt === retries) {
        return { ok: false, status: 200, url: res.url, text: '', throttled: true, bytes: buf.length };
      }
      continue;
    }
    cacheWrite(url, buf);
    return { ok: true, status: 200, url: res.url, text: htmlToText(html), bytes: buf.length, throttled: false, cached: false };
  }
  return { ok: false, status: 0, url, text: '', throttled: true };
}

/* ---------- 抽取规则 ---------- */

/* 噪音：百科镜像把"编辑指引/任务说明"和它自己的 JSON 结构一起吐了出来。
 * 实测不清理的话，抓到的前几条全是"大事记：选择词条主体最重要的3-10个事件…"这类模板文字。 */
const NOISE = /海贝|编辑|任务|图片补充|大事记|走红原因|特色头图|特点标签|非必须|如有可填写|词条主体|概括描述|表述客观|事件数|要求人物|尺寸大于|富豪榜|优先级排序|画质|肖像|近照|商务照|以上内容|需满足|才能提交/;
/* JSON 残渣：{"type":"text","text":"… 这类结构碎片，说明该句是从被截断的 JSON 里切出来的 */
const JSON_RESIDUE = /\{"type"|"\},"|\\?"text\\?"|^\s*[}\]"],?\s*$/;

/** 去掉百科站内链接造成的排版空格（"南与 沿滩区 ，"），便于阅读、去重与判噪音 */
function normalizeSpacing(s) {
  return s.replace(/\s+(?=[\u4e00-\u9fa5])/g, '').replace(/\s+(?=[，。；、）])/g, '').replace(/\s+/g, ' ').trim();
}

function isNoise(s) {
  if (!s || s.length < 6) return true;
  if (NOISE.test(s)) return true;
  if (JSON_RESIDUE.test(s)) return true;
  if (s.length > 200) return true;
  // 中文占比过低 → 多半是结构残渣
  const cjk = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
  if (cjk / s.length < 0.5) return true;
  return false;
}

/** 按"键"去重（去掉数字与空白后比较），保留第一次出现 */
function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const s = normalizeSpacing(raw);
    const key = s.replace(/[\d．.、，,\s]/g, '').slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * 面积句子：这是最容易抓错的字段，按可信度排序。
 * 实测教训：句子里出现"面积"和数字不代表它讲的是**这个行政区**的面积 ——
 * "中丘中谷地貌…分布面积仅 0.01 平方千米"会排在正确答案（159.9 平方千米）前面。
 */
function pickArea(text) {
  const sents = splitSentences(text).filter((s) =>
    /(平方千米|平方公里|km²)/.test(s) && /\d/.test(s)
  );
  const scored = sents.map((s) => {
    let score = 0;
    // 明确的行政区域面积表述（"辖区总面积159.9平方千米""政区面积1342平方千米"）
    if (/(辖区|境域|政区|全区|全县|全市)?总?面积(为|是)?\s*\d/.test(s)) score += 8;
    if (/截至\s*\d{4}\s*年/.test(s)) score += 3;
    if (/(幅员面积|辖区面积|总面积|境域面积|政区面积)/.test(s)) score += 3;
    // 明显不是"本区总面积"的句子降权
    if (/分布面积|灌溉面积|流域面积|占地面积|建筑面积|建成区|保护区|绿化|耕地|林地面|水域面积|集雨区|库容|洪水位/.test(s)) score -= 8;
    if (/东西长|南北宽|海拔|东经|北纬/.test(s)) score -= 1;
    return { s, score };
  });
  return dedupe(
    scored.filter((x) => x.score > 0 && !isNoise(x.s))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s)
  ).slice(0, 5);
}

/** 名称由来 */
function pickEtymology(text) {
  return dedupe(splitSentences(text).filter((s) =>
    !isNoise(s) && /(因.{0,12}得名|由此得名|故名|名称由来|取.{0,6}之意)/.test(s)
  )).slice(0, 4);
}

/** 景点/地标 */
function pickSpots(text) {
  return dedupe(splitSentences(text).filter((s) =>
    !isNoise(s) && /(景点|景区|地标|名胜|文物|故居|古镇|博物馆|世界遗产)/.test(s)
  )).slice(0, 8);
}

/** 含数字/年份的可核实句子（兜底素材） */
function pickFactual(text) {
  return dedupe(splitSentences(text).filter((s) =>
    !isNoise(s) && /\d/.test(s) && s.length >= 12
  )).slice(0, 12);
}

function splitSentences(text) {
  return text
    .split(/(?<=[。；！？])|\n/)
    .map((s) => s.replace(/^[\s"'\\[\]0-9、,，.]+/, '').trim())
    .filter((s) => s.length >= 6 && /[\u4e00-\u9fa5]/.test(s));
}

/**
 * 抓一个词条并抽取出结构化 facts。
 * @param {string} name 词条名（如 "五通桥区"）
 * @param {object} opts { baseUrl, adcode }
 */
async function extractOne(name, opts) {
  opts = opts || {};
  const base = opts.baseUrl || 'https://m.baike.com/wiki/';
  const url = base + encodeURIComponent(name);
  let r;
  try { r = await fetchText(url, { retries: opts.retries }); }
  catch (e) { return { name, adcode: opts.adcode || null, ok: false, error: e.message, throttled: false }; }
  if (!r.ok) {
    return {
      name, adcode: opts.adcode || null, ok: false,
      throttled: !!r.throttled,
      error: r.throttled ? '被限流（返回 ' + (r.bytes || 0) + ' 字节，非正文；已退避重试）'
                         : 'HTTP ' + r.status,
    };
  }

  const t = r.text;
  // 百科镜像会把别处的同名条目混进来 —— 必须做归属校验
  const collision = detectCollision(t, opts.parentName);
  return {
    name,
    adcode: opts.adcode || null,
    ok: true,
    source: r.url,
    collision,
    area: pickArea(t).slice(0, 6),
    etymology: pickEtymology(t).slice(0, 4),
    spots: pickSpots(t).slice(0, 8),
    factual: pickFactual(t).slice(0, 12),
    textLength: t.length,
  };
}

/**
 * 同名词条归属校验。
 *
 * 实测：查"乐山市市中区"返回的其实是**内江市市中区**（面积 387.5，明显不对）。
 * 判据不能用"头部若干字里有没有所属市" —— 百科条目结构不一，正文里出现的位置很靠后，
 * 那样会把正常条目全判成撞车（实测 6/6 误报）。改用：
 *   ① 所属市在**全文**出现过 → 视为归属正确，直接放行
 *   ② 全文都找不到 → 再列出文中出现的其他"xx市/xx州"作为证据；一个都没有就标"需人工确认"
 *
 * @param {string} text 正文（全文）
 * @param {string} parentName 所属市/州名（如 "自贡市"）
 */
function detectCollision(text, parentName) {
  if (!parentName) return null;
  const bare = parentName.replace(/[市州]$/, '');   // 自贡市 → 自贡
  if (text.includes(bare)) return null;             // ① 归属正确

  const others = [...new Set([...text.slice(0, 20000).matchAll(/([\u4e00-\u9fa5]{2,4}[市州])/g)].map((m) => m[1]))]
    .filter((c) => !c.startsWith(bare));
  return others.length ? others.slice(0, 6) : ['（全文未出现所属市，需人工确认）'];
}

/** 由 adcode 推断"归属地名"用于消歧（511102 → 乐山市市中区） */
function qualifyName(name, parentName) {
  if (!parentName) return name;
  if (name.startsWith(parentName.replace(/[市州]$/, ''))) return name;
  return parentName.replace(/[市州]$/, '') + name;
}

module.exports = { fetchText, htmlToText, splitSentences, pickArea, pickEtymology, pickSpots, pickFactual, extractOne, qualifyName, detectCollision };
