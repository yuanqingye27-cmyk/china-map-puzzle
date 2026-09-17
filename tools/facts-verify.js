#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 子代理产出校验 —— 把"信任"变成"可核对"
 * ---------------------------------------------------------------------
 * 路径：tools/facts-verify.js
 * 用法：
 *   node tools/facts-verify.js --map=zigong --in=out/verify-zigong.json
 *   node tools/facts-verify.js --map=zigong --in='{"districts":[…]}'    # 也可直接传 JSON 串
 *
 * 【为什么需要它】
 * 把"核实资料"交给子代理能省主上下文，但引入了新风险：**子代理可能编**。
 * 光靠"请勿编造"这种口头约束不够，必须能**机械核对**。所以：
 *   · 每个填了的字段都必须附 evidence（原句）
 *   · 本工具检查那句原句**是否真的存在于素材文件里**
 *   · 面积必须与官方几何一致
 *   · 素材被判定不可信的区县（撞车/面积对不上）必须进 rejected，不许写进正文
 *
 * 结论：子代理可以省 token，但它产出的每一项都要能追溯到一句原文。
 * 追溯不到 = 视为编造 = 不通过。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const tree = require('./lib/map-tree');
const geoArea = require('./lib/geo-area');

const OUT_DIR = path.join(tree.ROOT, 'out');
const TEXT_FIELDS = ['landmark', 'tagline', 'funFact'];

/** 与 facts-source 的 normalizeSpacing 保持一致，便于做原文比对 */
const normalize = (s) => String(s || '')
  .replace(/\s+/g, '')
  .replace(/[，。；、：""''（）()【】\[\]·—…!?！？,.:;"']/g, '')
  .trim();

function parseArgs(argv) {
  const out = { flags: new Set(), values: {} };
  argv.forEach((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    if (m) out.values[m[1]] = m[2];
    else { const f = /^--([^=]+)$/.exec(a); if (f) out.flags.add(f[1]); }
  });
  return out;
}

/** 取几何面积（权威基准） */
function loadGeoAreas(slug) {
  const scan = tree.scanMaps();
  const m = scan.maps[slug];
  if (!m) throw new Error('没有这张地图：' + slug);
  const base = m.dir ? path.join(tree.MAPS_DIR, m.dir, slug) : path.join(tree.MAPS_DIR, slug);
  const geoFile = base + '.geo.js';
  if (!fs.existsSync(geoFile)) throw new Error('缺 ' + path.relative(tree.ROOT, geoFile));
  const win = {};
  const sb = { window: win, console: { log() {}, warn() {}, error() {} }, document: { currentScript: null } };
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(fs.readFileSync(geoFile, 'utf8'), { filename: geoFile }).runInContext(sb);
  const fc = win.MAP_GEO && win.MAP_GEO[slug];
  if (!fc) throw new Error('geo 文件没有登记 MAP_GEO.' + slug);
  return geoArea.areasFromFeatureCollection(fc);
}

/** 把某区县的全部候选句摊平，用于原文比对（etymology 是 {text,kind}，需统一取 text） */
function candidateCorpus(d) {
  const factsSource = require('./lib/facts-source');
  return factsSource.candidateTexts(d).map(normalize).filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.values.map;
  if (!slug) { console.error('用法: node tools/facts-verify.js --map=<id> --in=<file|json>'); process.exit(1); }

  /* ---------- 读输入 ---------- */
  const raw = args.values.in;
  if (!raw) { console.error('缺 --in=<文件路径 或 JSON 串>'); process.exit(1); }
  let payload;
  const asFile = path.isAbsolute(raw) ? raw : path.join(tree.ROOT, raw);
  if (fs.existsSync(asFile)) {
    try { payload = JSON.parse(fs.readFileSync(asFile, 'utf8')); }
    catch (e) { console.error('✘ 输入不是合法 JSON：' + e.message); process.exit(1); }
  } else if (raw.trim().startsWith('{')) {
    try { payload = JSON.parse(raw); }
    catch (e) { console.error('✘ --in 既不是存在的文件，也不是合法 JSON：' + e.message); process.exit(1); }
  } else {
    console.error('✘ 找不到输入文件：' + raw);
    process.exit(1);
  }

  const factsFile = args.values.facts
    ? (path.isAbsolute(args.values.facts) ? args.values.facts : path.join(tree.ROOT, args.values.facts))
    : path.join(OUT_DIR, 'facts-' + slug + '.json');
  if (!fs.existsSync(factsFile)) {
    console.error('✘ 缺素材文件 ' + path.relative(tree.ROOT, factsFile) + '（先跑 tools/facts-batch.js --map=' + slug + '）');
    process.exit(1);
  }
  const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
  const factsByAd = {};
  facts.districts.forEach((d) => { factsByAd[String(d.adcode)] = d; });

  const geoAreas = loadGeoAreas(slug);

  console.log('══════════ 子代理产出校验 · ' + (facts.mapName || slug) + ' ══════════');

  const blockers = [];
  const warnings = [];
  const reject = (msg) => blockers.push(msg);
  const warn = (msg) => warnings.push(msg);

  /* ---------- 结构 ---------- */
  if (!payload || typeof payload !== 'object') { console.error('✘ 顶层不是对象'); process.exit(1); }
  if (!Array.isArray(payload.districts)) { console.error('✘ 缺 districts 数组'); process.exit(1); }
  if (payload.map && payload.map !== slug) warn('payload.map=' + payload.map + ' 与 --map=' + slug + ' 不一致');

  const rejected = Array.isArray(payload.rejected) ? payload.rejected : [];
  const outAds = new Set();
  let filledFields = 0;

  console.log('\n  共 ' + payload.districts.length + ' 条产出，' + rejected.length + ' 条 rejected\n');

  payload.districts.forEach((d) => {
    const ad = String(d.adcode);
    const tag = (d.name || '?') + '（' + ad + '）';
    outAds.add(ad);

    const src = factsByAd[ad];
    if (!src) { reject(tag + '：这个 adcode 不在素材里（是不是写错了？）'); return; }
    if (d.name && d.name !== src.name) warn(tag + '：名称与素材不一致（素材是 ' + src.name + '）');

    /* ① 素材已被判定不可信 → 不许出现在正文里 */
    if (!src.ok) {
      reject(tag + '：素材抓取失败（' + (src.error || '未知') + '），不能据此填字段');
      return;
    }
    if (src.collision) {
      reject(tag + '：素材疑似同名词条撞车（' + [].concat(src.collision).join('、') + '），应进 rejected 而不是正文');
      return;
    }
    if (src.check && src.check.status === 'mismatch') {
      reject(tag + '：素材面积与几何对不上（比值 ' + src.check.ratio + '），应进 rejected 而不是正文');
      return;
    }

    /* ② 面积必须等于几何面积 */
    if (d.area === undefined || d.area === null) {
      warn(tag + '：没有填 area（契约要求一律用几何面积）');
    } else if (typeof d.area !== 'number' || !isFinite(d.area)) {
      reject(tag + '：area 不是数字（' + JSON.stringify(d.area) + '）');
    } else {
      const g = geoAreas[Number(ad)];
      if (g === undefined) warn(tag + '：几何面积里没有这个 adcode，无法核对');
      else if (Math.abs(d.area - g) > 0.51) {
        reject(tag + '：area=' + d.area + ' 与几何面积 ' + g + ' 不一致（契约要求用几何值）');
      }
    }

    /* ③ 每个文字字段都要有能追溯的 evidence */
    const corpus = candidateCorpus(src);
    TEXT_FIELDS.forEach((f) => {
      const val = d[f];
      const ev = d.evidence && d.evidence[f];
      if (val === undefined || val === null || val === '') {
        if (ev) warn(tag + '：' + f + ' 没填却给了 evidence');
        return;
      }
      filledFields++;
      if (typeof val !== 'string' || !val.trim()) { reject(tag + '：' + f + ' 不是有效字符串'); return; }
      if (/待补充|资料收录中|TODO|占位/.test(val)) {
        reject(tag + '：' + f + ' 用了占位文案（没把握就该省略这个字段）');
        return;
      }
      if (!ev || !String(ev).trim()) {
        reject(tag + '：' + f + ' 填了内容但没给 evidence —— 无法追溯，视为不可信');
        return;
      }
      // ④ evidence 必须是素材里真实存在的原句
      const n = normalize(ev);
      if (!n) { reject(tag + '：' + f + ' 的 evidence 为空'); return; }
      const hit = corpus.some((c) => c.includes(n) || n.includes(c) && c.length > 12);
      if (!hit) {
        reject(tag + '：' + f + ' 的 evidence 在素材里找不到 → 疑似编造：' + JSON.stringify(String(ev).slice(0, 60)));
        return;
      }

      /* ⑤ landmark 必须**原样出现在它自己的 evidence 里**。
       * 实测漏洞：子代理给恩阳区写 landmark='恩阳古镇'，evidence 却是
       * "古镇内既有连接川陕的米仓古道…" —— evidence 是真的，但"恩阳古镇"这五个字
       * 素材里从没出现，是它用记忆补的。只查 evidence 查不出来，必须查 landmark 本身。 */
      if (f === 'landmark') {
        const parts = String(val).split(/[、,，/／]/).map((x) => x.replace(/[（(].*$/, '').trim()).filter(Boolean);
        const missing = parts.filter((p) => {
          const np = normalize(p);
          return np && !n.includes(np) && !corpus.some((c) => c.includes(np));
        });
        if (missing.length) {
          reject(tag + '：landmark 里的 ' + missing.map((m) => '「' + m + '」').join('、')
            + ' 在素材里找不到 → 疑似用记忆补充（landmark 必须原样出现在素材中）');
        }
      }

      // ⑥ 括号成对：截断的句子会留下不闭合的括号
      const open = (String(val).match(/[（(]/g) || []).length;
      const close = (String(val).match(/[）)]/g) || []).length;
      if (open !== close) {
        warn(tag + '：' + f + ' 括号不闭合（' + open + ' 开 / ' + close + ' 闭），像是从素材里截断了');
      }
    });
  });

  /* ---------- 覆盖度：素材里每条都要有归宿 ---------- */
  const rejectedAds = new Set(rejected.map((r) => String(r.adcode)));
  facts.districts.forEach((s) => {
    const ad = String(s.adcode);
    if (outAds.has(ad) || rejectedAds.has(ad)) return;
    warn('素材里的 ' + s.name + '（' + ad + '）在产出和 rejected 里都没出现 —— 漏了？');
  });
  rejected.forEach((r) => {
    if (!r.reason) warn('rejected 里的 ' + (r.name || r.adcode) + ' 没写 reason');
    if (!factsByAd[String(r.adcode)]) warn('rejected 里的 ' + (r.name || r.adcode) + ' 不在素材中');
  });

  /* ---------- 汇总 ---------- */
  console.log('  填了 ' + filledFields + ' 个文字字段（每个都要能追溯到原句）');
  if (warnings.length) {
    console.log('\n  ⚠ 提醒 ' + warnings.length + ' 条：');
    warnings.forEach((w) => console.log('    · ' + w));
  }
  if (blockers.length) {
    console.log('\n  ✘ 不通过 ' + blockers.length + ' 条：');
    blockers.forEach((b) => console.log('    ✘ ' + b));
    console.log('\n  处理：把这几条退回给子代理修（或人工判断），不要直接落盘。');
    process.exitCode = 1;
    return;
  }

  console.log('\n  ✔ 全部通过：每个填了的字段都能追溯到素材原句，面积与几何一致');
  console.log('  下一步：人工过目 → 写进 js/maps/china/sichuan/<市>.data.js → node tools/test-maps.js');
}

main();
