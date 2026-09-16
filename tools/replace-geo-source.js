#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 批量换源 · 把已有地图的边界数据整体换成另一个数据源
 * ---------------------------------------------------------------------
 * 路径：tools/replace-geo-source.js
 *
 * 用法：
 *   # 看它会动哪些地图，不联网不写盘
 *   node tools/replace-geo-source.js --source=tianditu --dry-run
 *
 *   # 真的全量换成天地图（需要 Key）
 *   node tools/replace-geo-source.js --source=tianditu --tk=<你的Key>
 *
 *   # 只换几张先试试水
 *   node tools/replace-geo-source.js --source=tianditu --tk=<Key> --only=chengdu,zigong
 *
 *   # 本地官方数据包（带审图号的数据集）
 *   node tools/replace-geo-source.js --source=file --dir=/path/to/official-geojson
 *
 * 它做什么：
 *   遍历登记册里的每一张地图，按它自己的 adcode 重新下载边界，
 *   然后**只覆盖 <id>.geo.js** —— `.data.js`（人工资料）与 `.js`（配置）一个字都不动。
 *   这一步复用了 add-map 的 addMap({ geoOnly: true })，不是另写一套下载逻辑。
 *
 * 红线（与项目既有约定一致）：
 *   - 单张失败：记录进报告、跳过、不额外重试（provider 内部最多 2 次）
 *   - 批量之间有延时（--delay，天地图默认 800ms），绝不并发轰接口
 *   - 只写 .geo.js，绝不碰人工文件
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');
const geoSource = require('./lib/geo-source');
const { addMap } = require('./add-map');

const REPORT_DEFAULT = path.join(tree.ROOT, 'geo-source-report.json');

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has('dry-run');
  const quiet = args.flags.has('quiet');
  const log = quiet ? () => {} : (m) => console.log(m);

  const sourceId = args.source || geoSource.DEFAULT_SOURCE;
  const provider = geoSource.getProvider(sourceId);

  // 天地图有配额，默认慢一点；本地文件/DataV 可以快些
  const delay = args.delay !== undefined
    ? Number(args.delay)
    : (sourceId === 'tianditu' ? 800 : 120);

  const only = args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : null;

  const scan = tree.scanMaps();
  let targets = Object.values(scan.maps);
  if (only) {
    targets = targets.filter((m) => only.includes(m.id));
    const missing = only.filter((id) => !scan.maps[id]);
    if (missing.length) log('  ⚠ --only 里有登记册上不存在的地图：' + missing.join('、'));
  }
  targets.sort((a, b) => (a.adcode || 0) - (b.adcode || 0));

  log('══════════ 换源计划 ══════════');
  log('  数据源：' + provider.label + (provider.approval ? '　审图号：' + provider.approval : '（无审图号）'));
  log('  目标地图：' + targets.length + ' 张' + (only ? '（--only 生效）' : '（登记册全量）'));
  log('  批量延时：' + delay + ' ms/张' + (dryRun ? '　（--dry-run，不联网不写盘）' : ''));
  targets.forEach((m, i) => {
    log('    ' + String(i + 1).padStart(3) + '. ' + m.id.padEnd(14) + m.name.padEnd(10) +
      'adcode=' + m.adcode);
  });

  if (dryRun) {
    log('\n（--dry-run 结束。去掉这个参数就会真的重新下载并覆盖 .geo.js）');
    return;
  }

  log('\n══════════ 开始换源 ══════════');
  const records = [];
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const m = targets[i];
    const tag = '[' + (i + 1) + '/' + targets.length + '] ';
    if (i > 0 && delay > 0) await sleep(delay); // 红线：批量之间必须留间隔

    log(tag + m.id + '（' + m.name + '）');
    try {
      const res = await addMap({
        adcode: m.adcode,
        slug: m.id,
        parentSlug: m.parent,
        geoOnly: true,          // 只刷 .geo.js，人工文件一律不动
        source: sourceId,
        tk: args.tk,
        dir: args.dir,
        file: args.file,
        log: quiet ? () => {} : (line) => console.log('    ' + line),
      });
      const r = (res.maps || []).find((x) => x.slug === m.id) || (res.maps || [])[0];
      ok++;
      records.push({
        slug: m.id,
        adcode: m.adcode,
        status: 'replaced',
        file: r ? r.files.geo : null,
        kb: r ? Number((r.files.geoBytes / 1024).toFixed(1)) : null,
        districts: r ? r.districtCount : null,
      });
    } catch (err) {
      failed++;
      log('    ✘ 失败，跳过：' + err.message.split('\n')[0]);
      records.push({
        slug: m.id,
        adcode: m.adcode,
        status: 'failed',
        error: err.message,
      });
    }
  }

  // 重建登记册：换源不改结构，但顺手确认一下没被写坏
  const regen = tree.regenerateRegistry({});
  if (!regen.ok) {
    regen.errors.forEach((e) => log('  ✘ ' + e.message));
    throw new Error('换源后 registry 生成失败，请检查上面几个文件');
  }

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'node tools/replace-geo-source.js --source=' + sourceId +
      (only ? ' --only=' + only.join(',') : ''),
    dataSource: {
      provider: provider.id,
      label: provider.label,
      approval: provider.approval,
      note: provider.note,
    },
    summary: { total: targets.length, replaced: ok, failed },
    registry: { totalMaps: Object.keys(regen.model.maps).length },
    maps: records,
    failures: records.filter((r) => r.status === 'failed'),
  };

  const reportPath = path.resolve(args.report || REPORT_DEFAULT);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  log('\n══════════ 汇总 ══════════');
  log('  换源完成：' + ok + ' 张　失败：' + failed + ' 张　（共 ' + targets.length + ' 张）');
  log('  数据源：' + provider.label + (provider.approval ? '（审图号 ' + provider.approval + '）' : '（无审图号）'));
  log('  ✔ 报告已写入 ' + path.relative(process.cwd(), reportPath));
  if (failed) {
    log('  ✘ 失败的（已跳过、未额外重试）：' + report.failures.map((f) => f.slug).join('、'));
    log('    → 网络恢复后再跑一次同样的命令即可，已成功的会照常重刷');
  }
  log('  · 下一步：node tools/e2e-test.js（确认 751 项仍全绿）');

  if (failed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n✘ ' + err.message);
    process.exit(1);
  });
}
