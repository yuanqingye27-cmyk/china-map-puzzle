#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 批量事实抓取 —— 一个市 → 一份 facts JSON（可选：直接生成文案草稿）
 * ---------------------------------------------------------------------
 * 路径：tools/facts-batch.js
 * 用法：
 *   node tools/facts-batch.js --map=zigong                    # 抓 → out/facts-zigong.json
 *   node tools/facts-batch.js --map=zigong --print            # 只打印紧凑摘要（省 token）
 *   node tools/facts-batch.js --map=zigong --draft            # 顺带生成可人工过目的草稿
 *
 * 【它解决的问题】
 * 老流程：一个区县一次联网 + 一次 dump 进上下文，一个市几十轮 tool call。
 * 新流程：**一条命令**抓完一个市的全部区县，只在脚本里抽句子，产物是 JSON。
 * 主上下文默认只看到一张摘要表（每个区县几行），原始文本一个字都不进来。
 *
 * 【红线】它**不写**资料文件（js/maps 下的 .data.js）—— 只产出素材（facts JSON / 草稿）。
 * 资料卡必须由人（或人审过的子代理）落笔，脚本不代替判断。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const tree = require('./lib/map-tree');
const facts = require('./lib/facts-source');

const OUT_DIR = path.join(tree.ROOT, 'out');

function parseArgs(argv) {
  const out = { flags: new Set(), values: {} };
  argv.forEach((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out.values[m[1]] = m[2];
    else { const f = /^--([^=]+)$/.exec(a); if (f) out.flags.add(f[1]); }
  });
  return out;
}

/** 从 .geo.js 取「adcode + 官方名称 + 几何面积」—— 名单与校验基准都来自数据 */
function loadDistricts(slug) {
  const scan = tree.scanMaps();
  const m = scan.maps[slug];
  if (!m) throw new Error('没有这张地图：' + slug + '（node tools/status.js 看清单）');
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

  const geoArea = require('./lib/geo-area');
  const areas = geoArea.areasFromFeatureCollection(fc);
  return {
    mapName: m.name || slug,
    adcode: m.adcode,
    districts: fc.features
      .filter((f) => f.properties && f.properties.adcode)
      .map((f) => ({ adcode: f.properties.adcode, name: f.properties.name, geoArea: areas[f.properties.adcode] })),
  };
}

/**
 * 用几何面积交叉校验抓来的面积句 —— **这一步能在写资料前就抓出"抓错条目"**。
 * 实测：市中区抓到的是内江市市中区（文本 387.5 km²），而乐山几何面积是 825，
 * 差一倍多，脚本一比对就能发现，不必靠人肉眼扫。
 */
function crossCheckArea(r) {
  if (!r.ok || !r.geoArea) return null;
  const nums = [];
  r.area.forEach((s) => {
    const m = /(\d+(?:\.\d+)?)\s*(平方千米|平方公里|km²)/.exec(s);
    if (m) nums.push(Number(m[1]));
  });
  if (!nums.length) return { status: 'no-area', geoArea: r.geoArea };
  // 取与几何面积最接近的一个作为"它对不上的那一个"
  const best = nums.reduce((a, b) => (Math.abs(b - r.geoArea) < Math.abs(a - r.geoArea) ? b : a));
  const ratio = best / r.geoArea;
  if (ratio > 0.75 && ratio < 1.35) return { status: 'match', textArea: best, geoArea: r.geoArea, ratio: Number(ratio.toFixed(2)) };
  return { status: 'mismatch', textArea: best, geoArea: r.geoArea, ratio: Number(ratio.toFixed(2)) };
}

/**
 * 串行抓取 + 固定间隔。
 *
 * 实测：并发 4 连续抓 6 个词条后，服务器开始返回 **6KB 限流页**（正常 600KB+），
 * 结果是"看起来成功、其实一个字没抓到"。对这类站点**慢就是快**：
 * 宁可 6 个区县花 20 秒，也不要拿到一半是空的数据。
 */
async function fetchSequential(items, delayMs, fn, onProgress) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    out.push(await fn(items[i], i));
    if (onProgress) onProgress(i + 1, items.length, out[i]);
    if (i < items.length - 1 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return out;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.values.map;
  if (!slug) {
    console.error('用法: node tools/facts-batch.js --map=<id> [--print] [--draft] [--limit=N]');
    process.exit(1);
  }

  const { mapName, adcode, districts } = loadDistricts(slug);
  const only = args.values.only ? String(args.values.only).split(',') : null;
  let targets = districts;
  if (only) targets = targets.filter((d) => only.includes(String(d.adcode)));
  if (!targets.length) { console.error('--only 没有匹配到任何区县'); process.exitCode = 1; return; }
  const limit = args.values.limit ? Number(args.values.limit) : districts.length;
  targets = targets.slice(0, limit);
  const quiet = args.flags.has('print');

  if (!quiet) console.log('══════════ 批量事实抓取 · ' + mapName + ' ══════════');
  if (!quiet) console.log('  区县 ' + targets.length + ' 个（来自官方 geo，不靠猜）→ 抽取中…\n');

  const t0 = Date.now();
  const delayMs = args.values.delay !== undefined ? Number(args.values.delay) : 1500;
  const results = await fetchSequential(
    targets,
    delayMs,
    (d) => facts.extractOne(d.name, { adcode: d.adcode, parentName: mapName })
      .then((r) => ({ ...r, geoArea: d.geoArea, check: null })),
    (done, total, r) => {
      if (!quiet) process.stderr.write('\r  抓取中 ' + done + '/' + total + '  ' + (r.name || '') + '        ');
    }
  );
  if (!quiet) process.stderr.write('\r' + ' '.repeat(60) + '\r');
  // 用几何面积交叉校验（离线，不再联网）
  results.forEach((r) => { r.check = crossCheckArea(r); });
  const ms = Date.now() - t0;

  const payload = {
    map: slug,
    mapName,
    adcode,
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'm.baike.com（百科镜像）· 由 tools/facts-batch.js 抽取，仅供人工核实',
    districts: results,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, 'facts-' + slug + '.json');
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');

  /* 摘要：默认只打印"每个区县几行"，把原文留在 JSON 里 */
  const failed = results.filter((r) => !r.ok);
  const throttled = results.filter((r) => r.throttled);
  const collided = results.filter((r) => r.ok && r.collision);
  const mismatched = results.filter((r) => r.check && r.check.status === 'mismatch');

  results.forEach((r) => {
    if (!r.ok) { console.log('  ' + (r.throttled ? '⏳' : '✘') + ' ' + r.name + '  抓取失败：' + r.error); return; }
    const c = r.check || {};
    const mark = r.collision ? '⚠ ' : (c.status === 'mismatch' ? '❗' : '· ');
    const areaStr = c.status === 'mismatch'
      ? '面积⚠ 文本' + c.textArea + ' vs 几何' + c.geoArea + '（' + c.ratio + '×）'
      : (c.status === 'match' ? '面积✓ ' + c.textArea + ' ≈ 几何' + c.geoArea
                              : '面积句 ' + r.area.length + '（无可比对数字，几何 ' + r.geoArea + '）');
    console.log('  ' + mark + String(r.name).padEnd(10)
      + '由来' + String(r.etymology.length).padStart(2)
      + ' 景点' + String(r.spots.length).padStart(2)
      + ' 事实' + String(r.factual.length).padStart(2)
      + '　' + areaStr);
  });

  console.log('\n  产物：' + path.relative(tree.ROOT, outFile) + '（' + (fs.statSync(outFile).size / 1024).toFixed(0) + ' KB，原文不进上下文）');
  console.log('  耗时：' + (ms / 1000).toFixed(1) + 's　成功 ' + (results.length - failed.length) + '/' + results.length
    + (failed.length ? '（失败 ' + failed.length + '，其中限流 ' + throttled.length + '）' : ''));

  if (throttled.length) {
    console.log('\n  ⏳ 有限流：' + throttled.map((r) => r.name).join('、'));
    console.log('     加大间隔重试这几个：--only=' + throttled.map((r) => r.adcode).join(',') + ' --delay=3000');
  }

  if (collided.length) {
    console.log('\n  ⚠ 疑似同名词条撞车（抓到的可能是别的市）：');
    collided.forEach((r) => console.log('    ' + r.name + ' → 页面里找不到所属市，却出现 ' + r.collision.join('、')));
    console.log('    这些条目**不要直接用**，换关键词或人工核对。');
  }
  if (mismatched.length) {
    console.log('\n  ❗ 面积对不上（脚本交叉校验拦下的，极可能是抓错条目）：');
    mismatched.forEach((r) => console.log('    ' + r.name + '：文本 ' + r.check.textArea + ' vs 几何 ' + r.check.geoArea
      + '（' + r.check.ratio + ' 倍）'));
    console.log('    几何值来自官方边界，可信度高；文本对不上就说明抓错了条目或口径不同，需人工判断。');
  }

  if (args.flags.has('draft')) {
    const draftFile = path.join(OUT_DIR, 'draft-' + slug + '.md');
    fs.writeFileSync(draftFile, renderDraft(payload), 'utf8');
    console.log('\n  草稿：' + path.relative(tree.ROOT, draftFile) + '（人过目后再写进 .data.js）');
  }
})().catch((e) => { console.error('失败：' + e.message); process.exitCode = 1; });

/** 生成"给人过目"的草稿：每条只列候选句子，**不代替判断** */
function renderDraft(payload) {
  const L = [];
  L.push('# ' + payload.mapName + ' · 资料草稿（待人工核实）\n');
  L.push('> 来源：' + payload.source);
  L.push('> 生成：' + payload.generatedAt + '　**本文件不是成品**，核实后才可写进 .data.js\n');
  payload.districts.forEach((r) => {
    L.push('## ' + r.name + '（' + r.adcode + '）');
    if (!r.ok) { L.push('- ⚠ 抓取失败：' + r.error + '\n'); return; }
    if (r.collision) L.push('- ⚠ **疑似撞车**：页面前部出现 ' + r.collision.join('、') + '，请人工确认是否抓错条目');
    L.push('- 来源：' + r.source);
    if (r.area.length) { L.push('- 面积候选：'); r.area.forEach((s) => L.push('  - ' + s)); }
    if (r.etymology.length) { L.push('- 名称由来候选：'); r.etymology.forEach((s) => L.push('  - ' + s)); }
    if (r.spots.length) { L.push('- 景点候选：'); r.spots.forEach((s) => L.push('  - ' + s)); }
    if (r.factual.length) { L.push('- 其他事实候选：'); r.factual.forEach((s) => L.push('  - ' + s)); }
    L.push('');
  });
  return L.join('\n');
}
