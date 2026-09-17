#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 官方行政区划校验 —— 用民政部「国家地名信息库」核对我们的地图数据
 * ---------------------------------------------------------------------
 * 路径：tools/mca-check.js
 * 用法：
 *   node tools/mca-check.js                  # 抓取并核对（带缓存）
 *   node tools/mca-check.js --refresh        # 忽略缓存重新抓
 *   node tools/mca-check.js --write-tree     # 顺便把官方树落盘成 tools/lib/mca-tree.json
 *
 * 【为什么用它】
 * 我们已有的 3254 条地名来自**天地图**的行政树（下载菜单时附带）。
 * 民政部这个接口是**另一条独立权威源**，而且字段更全（带官方 type）。
 * 两条独立来源互相印证，比单一来源可靠 —— 这也是"数据可追溯"的一部分。
 *
 * 【实测过的接口】（2026-09）
 *   GET https://dmfw.mca.gov.cn/9095/xzqh/getList?code=<12位>&maxLevel=<1..3>
 *   · code 留空 = 从全国根开始
 *   · 返回 {code, name, level, type, children[]}
 *   · level: 1=省级 2=地级 3=县级 4=乡镇街道
 *   · type 是**官方区划类型**（省 / 直辖市 / 地级市 / 自治州 / 市辖区 / 县 / 县级市 …）
 *
 * 【一个重要的边界】该库的**地名详情**（地名来历/含义）接口是加密返回的
 * （见 tools/lib/mca-tree.json 里的说明与 docs/可持续性与内容生产.md）。
 * 本工具**不碰那个接口** —— 绕过技术保护措施既不可靠也不合适。
 * 这里只用公开、未加密的行政区划接口。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'mca');
const TREE_FILE = path.join(__dirname, 'lib', 'mca-tree.json');

const BASE = 'https://dmfw.mca.gov.cn/9095/xzqh/getList';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';

const args = process.argv.slice(2);
const has = (f) => args.includes('--' + f);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 抓一个节点的下级（带磁盘缓存） */
async function fetchNode(code, maxLevel) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, (code || 'root') + '.json');
  if (!has('refresh') && fs.existsSync(cacheFile)) {
    try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) { /* 缓存坏了就重抓 */ }
  }
  const url = BASE + '?code=' + encodeURIComponent(code || '') + '&maxLevel=' + maxLevel;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://dmfw.mca.gov.cn/' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  const json = await res.json();
  if (!json || !json.data) throw new Error('返回里没有 data：' + url);
  fs.writeFileSync(cacheFile, JSON.stringify(json), 'utf8');
  return json;
}

/** 摊平成 [ {code6, name, level, type} ]（code 去掉后 6 个 0） */
function flatten(node, out) {
  out = out || [];
  out.push({
    code6: String(node.code || '').slice(0, 6),
    name: node.name,
    level: node.level,
    type: node.type || '',
  });
  (node.children || []).forEach((c) => flatten(c, out));
  return out;
}

(async () => {
  console.log('══════════ 民政部官方行政区划校验 ══════════');

  // ① 先拿全国省级清单（一次请求，很快）
  const rootJson = await fetchNode('', 1);
  const provs = (rootJson.data.children || []);
  console.log('  官方省级：' + provs.length + ' 个');
  await sleep(400);

  // ② 逐省抓三级（带缓存；已抓过的瞬间返回）
  const all = [];
  for (let i = 0; i < provs.length; i++) {
    const p = provs[i];
    try {
      const j = await fetchNode(p.code, 3);
      const rows = flatten(j.data).slice(1);   // 去掉省级自己（已在上一步加过）
      all.push({ code6: String(p.code).slice(0, 6), name: p.name, level: p.level, type: p.type });
      rows.forEach((r) => all.push(r));
    } catch (e) {
      console.log('  ⚠ ' + p.name + ' 抓取失败：' + e.message);
    }
    process.stderr.write('\r  抓取官方树 ' + (i + 1) + '/' + provs.length + '  ');
    await sleep(300);   // 别把人家站点打急了
  }
  process.stderr.write('\r' + ' '.repeat(40) + '\r');
  console.log('  官方树节点：' + all.length + ' 个');

  if (has('write-tree')) {
    fs.writeFileSync(TREE_FILE, JSON.stringify(all), 'utf8');
    console.log('  ✔ 已写入 ' + path.relative(ROOT, TREE_FILE) + '（' + (fs.statSync(TREE_FILE).size / 1024).toFixed(0) + ' KB）');
  }

  /* ---------- ③ 与我们的地图数据对账 ---------- */
  const scan = tree.scanMaps();
  const ours = Object.keys(scan.maps).map((id) => scan.maps[id]);
  const byAd = new Map(all.map((n) => [Number(n.code6), n]));

  const wrongName = [];
  const notFound = [];
  let matched = 0;
  ours.forEach((m) => {
    if (!m.adcode) return;
    const off = byAd.get(Number(m.adcode));
    if (!off) { notFound.push(m.id + '（' + m.adcode + ' ' + m.name + '）'); return; }
    matched++;
    if (off.name !== m.name) wrongName.push(m.id + '：我们「' + m.name + '」 vs 官方「' + off.name + '」');
  });

  console.log('\n  ── 对账 ──');
  console.log('  我们地图 ' + ours.length + ' 张，与官方对上 ' + matched + ' 张');
  if (wrongName.length) {
    console.log('\n  ✘ 名称不一致 ' + wrongName.length + ' 处：');
    wrongName.slice(0, 20).forEach((x) => console.log('    ' + x));
  } else {
    console.log('  ✔ 名称与官方完全一致');
  }
  if (notFound.length) {
    console.log('\n  ⚠ 官方树里找不到 ' + notFound.length + ' 个：');
    notFound.slice(0, 20).forEach((x) => console.log('    ' + x));
  }

  /* ---------- ④ 官方 type 分布（可用于更科学的关卡分组） ---------- */
  const typeCount = {};
  all.forEach((n) => { if (n.level >= 3) typeCount[n.type] = (typeCount[n.type] || 0) + 1; });
  console.log('\n  ── 官方县级类型分布（可直接用于关卡分组，比看名字猜更准）──');
  Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([t, n]) => console.log('    ' + String(t || '(空)').padEnd(12) + n + ' 个'));
})().catch((e) => {
  console.error('失败：' + e.message);
  process.exitCode = 1;
});
