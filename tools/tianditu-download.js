#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 下载官方行政区划边界（天地图服务中心，无需登录）
 * ---------------------------------------------------------------------
 * 路径：tools/tianditu-download.js
 *
 * 用法：
 *   # 按登记册里已有的地图，把它们各自的"下级边界"下载下来
 *   node tools/tianditu-download.js
 *
 *   # 只下几张（试水）
 *   node tools/tianditu-download.js --only=510100,510300
 *
 *   # 指定输出目录 / 放慢间隔
 *   node tools/tianditu-download.js --out=data/tianditu-official --delay=1000
 *
 * 产出：<out>/<adcode>_full.json  —— 该行政区**下级**的边界 GeoJSON
 *       （正好是 tools/lib/geo-source.js 的 `file` 数据源要的格式，
 *         所以下完之后直接换源：replace-geo-source.js --source=file --dir=<out>）
 *       <out>/manifest.json      —— 来源 URL / 抓取时间 / 审图号，可追溯
 *
 * 红线：
 *   - 顺序请求 + 固定间隔（默认 800ms），不并发
 *   - 单张最多 2 次尝试，失败记录后跳过，不死循环
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');
const portal = require('./lib/tianditu-portal');

const OUT_DEFAULT = path.join(tree.ROOT, 'data', 'tianditu-official');
const MAX_ATTEMPTS = 2;

function parseArgs(argv) {
  const out = { flags: new Set() };
  argv.forEach((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) return;
    if (m[2] === undefined) out.flags.add(m[1]);
    else out[m[1]] = m[2];
  });
  return out;
}

/** 把"含中国在内的全部节点"摊平成 gb → 节点（只打印摘要，绝不 dump 整棵树） */
function summarizeMenu(treeData) {
  const root = treeData[0];
  const flat = portal.flattenMenu(treeData);
  return { root, flat };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.out || OUT_DEFAULT);
  const delay = args.delay !== undefined ? Number(args.delay) : 800;
  const only = args.only ? String(args.only).split(',').map((s) => s.trim()) : null;
  const quiet = args.flags.has('quiet');
  const log = quiet ? () => {} : (m) => console.log(m);

  fs.mkdirSync(outDir, { recursive: true });

  /* ---------- 1. 官方行政树 ---------- */
  log('══════════ 拉取官方行政区划树 ══════════');
  let menu;
  try {
    menu = await portal.fetchRegionMenu({ log });
  } catch (err) {
    throw new Error('官方行政树拉取失败：' + err.message);
  }
  const { root, flat } = summarizeMenu(menu);
  const byAdcode = {};
  Object.values(flat).forEach((n) => { if (n.adcode) byAdcode[n.adcode] = n; });
  log('  ✔ 根节点：' + root.name + '（gb ' + root.gb + '，level ' + root.level + '）');
  log('  ✔ 树里共 ' + Object.keys(flat).length + ' 个节点，覆盖 ' +
    Object.keys(byAdcode).length + ' 个 adcode');
  log('  数据来源：' + portal.MENU_URL);

  /* ---------- 2. 决定要下哪些 ---------- */
  const scan = tree.scanMaps();
  let targets = Object.values(scan.maps).map((m) => ({ slug: m.id, name: m.name, adcode: m.adcode }));
  targets.sort((a, b) => (a.adcode || 0) - (b.adcode || 0));
  if (only) {
    const set = only.map(Number);
    targets = targets.filter((t) => set.includes(t.adcode));
    const miss = set.filter((a) => !scan.maps[Object.keys(scan.maps).find((k) => scan.maps[k].adcode === a)]);
    if (miss.length) log('  ⚠ --only 里有登记册上不存在的 adcode：' + miss.join('、'));
  }

  log('\n══════════ 下载计划 ══════════');
  log('  输出目录：' + path.relative(process.cwd(), outDir));
  log('  目标：' + targets.length + ' 张（每张一次请求），间隔 ' + delay + 'ms');
  targets.forEach((t) => {
    const node = byAdcode[t.adcode];
    log('    ' + String(t.adcode).padEnd(8) + String(t.name).padEnd(10) + t.slug.padEnd(16) +
      (node ? 'level ' + portal.levelForAdcode(t.adcode) : '⚠ 官方树里没有这个 adcode'));
  });

  /* ---------- 3. 逐张下载 ---------- */
  log('\n══════════ 开始下载 ══════════');
  const records = [];
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const tag = '[' + (i + 1) + '/' + targets.length + '] ';
    const node = byAdcode[t.adcode];
    if (!node) {
      failed++;
      records.push({ ...t, status: 'skipped', error: '官方树里没有 adcode ' + t.adcode });
      log(tag + '✘ ' + t.name + '：官方树里没有这个 adcode，跳过');
      continue;
    }

    if (i > 0 && delay > 0) await portal.sleep(delay);

    let lastErr = null;
    let done = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !done; attempt++) {
      try {
        const level = portal.levelForAdcode(t.adcode);
        const r = await portal.fetchRegionMap(node.gb, level, { log });
        const skipped = [];
        const geo = portal.normalizeOfficialGeo(r.geo, { onSkip: (info) => skipped.push(info) });
        const file = path.join(outDir, t.adcode + '_full.json');
        fs.writeFileSync(file, JSON.stringify(geo) + '\n', 'utf8');
        ok++;
        const kb = (Buffer.byteLength(JSON.stringify(geo)) / 1024).toFixed(1);
        records.push({
          slug: t.slug, name: t.name, adcode: t.adcode, gb: node.gb, level: node.level,
          status: 'downloaded', file: path.relative(process.cwd(), file),
          features: geo.features.length, kb: Number(kb), sourceUrl: r.url,
          level, skippedFeatures: skipped,
        });
        log(tag + '✔ ' + String(t.name).padEnd(10) + geo.features.length + ' 个下级 · ' + kb + ' KB' +
          (skipped.length ? '　（跳过 ' + skipped.length + ' 个非面要素：' +
            skipped.map((x) => x.type).join('/') + '）' : ''));
        done = true;
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_ATTEMPTS) {
          log(tag + '… ' + t.name + ' 第 ' + attempt + ' 次失败，' + delay + 'ms 后重试');
          await portal.sleep(delay);
        }
      }
    }
    if (!done) {
      failed++;
      records.push({ ...t, status: 'failed', error: lastErr && lastErr.message });
      log(tag + '✘ ' + t.name + ' 失败，跳过（不再重试）');
    }
  }

  /* ---------- 4. manifest：可追溯 ---------- */
  const manifest = {
    generatedAt: new Date().toISOString(),
    provider: 'tianditu-portal',
    providerLabel: portal.PROVIDER_LABEL,
    approval: portal.APPROVAL,
    approvalNote: '审图号随天地图对外发布的行政区划数据；本目录为其官方服务的抓取副本，' +
      '如需对外使用请以天地图官方页面公示为准',
    menuUrl: portal.MENU_URL,
    mapUrlTemplate: portal.MAP_URL + '?gb=<gb>&level=<level>',
    decode: 'HTTP gzip 解压 → 每 4 字节大端 int32 → >>2 → 低字节 → UTF-8 → JSON',
    summary: { total: targets.length, downloaded: ok, failed },
    maps: records,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  log('\n══════════ 汇总 ══════════');
  log('  下载成功：' + ok + '　失败：' + failed + '　（共 ' + targets.length + '）');
  log('  ✔ manifest：' + path.relative(process.cwd(), path.join(outDir, 'manifest.json')));
  log('  数据来源：' + portal.PROVIDER_LABEL + '　审图号：' + portal.APPROVAL);
  if (failed) {
    log('  ✘ 失败清单：' + records.filter((r) => r.status !== 'downloaded')
      .map((r) => r.name + '(' + r.adcode + ')').join('、'));
    process.exitCode = 1;
  }
  log('\n  下一步（先试水两张）：');
  log('    node tools/replace-geo-source.js --source=file --dir=' +
    path.relative(process.cwd(), outDir) + ' --only=chengdu,zigong');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n✘ ' + err.message);
    process.exit(1);
  });
}
