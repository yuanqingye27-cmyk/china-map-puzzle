#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 批量接入脚本 · 一次把某个父级下面的所有子级地图都接进来
 * ---------------------------------------------------------------------
 * 路径：tools/batch-add-maps.js
 *
 * 用法：
 *   node tools/batch-add-maps.js --parent=510000            # 四川省 21 个市州
 *   node tools/batch-add-maps.js --parent=510000 --dry-run  # 先看计划，不联网不写盘
 *   node tools/batch-add-maps.js --parent=510000 --only=511100,511300
 *   node tools/batch-add-maps.js --parent=510000 --report=docs/batch-report.json
 *
 * 干的事：
 *   1. 确保父级地图已接入（没接入就先把它补出来）
 *   2. 下载父级的 bound/{adcode}_full.json，拿到它的全部子级
 *   3. **逐个调用 tools/add-map.js 的 addMap()**（不是抄一份逻辑）生成地图包
 *   4. 最后统一重建一次 registry.js
 *   5. 写 batch-report.json：成功/失败/跳过、数据缺口、待人工补的占位符清单
 *
 * 【红线】不许一次下载整个中国。
 *   adcode 100000 有 34 个子级、每个还要再往下钻，规模远超"批量验证"的范畴。
 *   所以这里硬编码拒绝 100000，要接中国就一个省一个省地来。
 *
 * 【失败处理】某个子级下载失败 → 记进报告、跳过、**不重试、不死循环**。
 *   （add-map 内部对网络失败已经有"最多 2 次"的既定策略，批量这一层不再叠加重试。）
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const tree = require('./lib/map-tree');
const geoLib = require('./lib/inline-geo');
const slugs = require('./lib/slugs');
const { addMap } = require('./add-map');

/** 单张地图的 slug 兜底命名长度检查：太长会把目录名搞得很丑 */
const REPORT_DEFAULT = path.join(tree.ROOT, 'batch-report.json');

/* ============================ 参数 ============================ */

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

function validate(args) {
  const parent = String(args.parent || '');
  if (!/^\d{6}$/.test(parent)) {
    throw new Error('--parent 必须是 6 位 adcode，例如 --parent=510000（四川省）');
  }
  if (parent === '100000') {
    throw new Error(
      '拒绝一次性批量接入整个中国（adcode 100000）。\n' +
      '  34 个子级 × 各自的下一级 = 数百张地图，规模远超"批量验证"该有的样子。\n' +
      '  正确姿势：一个省一个省地来，例如 --parent=510000（四川）、--parent=440000（广东）。'
    );
  }
  const only = args.only
    ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  if (only && !only.every((a) => /^\d{6}$/.test(a))) {
    throw new Error('--only 里只接受 6 位 adcode，用逗号分隔，例如 --only=511100,511300');
  }
  return { parentAdcode: Number(parent), only };
}

/* ============================ 主流程 ============================ */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has('dry-run');
  const force = args.flags.has('force');
  const geoOnly = args.flags.has('geo-only');
  const quiet = args.flags.has('quiet');
  const reportPath = path.resolve(args.report || REPORT_DEFAULT);
  const log = quiet ? () => {} : (m) => console.log(m);

  const { parentAdcode, only } = validate(args);

  /* ---------- 1. 父级得先存在 ---------- */
  const parentSlugInfo = slugs.slugForAdcode(parentAdcode);
  const parentSlug = parentSlugInfo.slug;
  const before = tree.scanMaps();

  if (!before.maps[parentSlug]) {
    log('父级地图「' + parentSlug + '」还没接入，' + (dryRun ? '（dry-run 只记录，不创建）' : '先把它补出来…'));
    if (!dryRun) {
      const made = await addMap({ adcode: parentAdcode, slug: parentSlug, log });
      if (made.status === 'created') {
        const self = made.maps[made.maps.length - 1];
        log('  ✔ 父级就位：' + self.name + '（' + self.featureCount + ' 个下级行政区）');
      }
    }
  }

  /* ---------- 2. 下载父级的子级清单 ---------- */
  log('\n══════════ 拉取子级清单 ══════════');
  let children = [];
  let parentName = parentSlug;
  let parentUrl = '';
  try {
    const fetched = await geoLib.fetchDatavGeo(parentAdcode, { log });
    parentUrl = fetched.url;
    const features = geoLib.normalizeGeo(fetched.raw, fetched.url).features;
    children = features
      .filter((f) => geoLib.isAdminAdcode(f.properties.adcode))
      .map((f) => ({ adcode: Number(f.properties.adcode), name: f.properties.name }))
      .sort((a, b) => a.adcode - b.adcode);
    const selfName = features.find((f) => Number(f.properties.adcode) === parentAdcode);
    parentName = selfName ? selfName.properties.name : parentSlug;
    log('  ✔ ' + parentName + '（adcode ' + parentAdcode + '）下有 ' + children.length + ' 个子级');
    log('    来源：' + parentUrl);
  } catch (err) {
    // 父级清单都拉不到，那就没有"批量"可言了 —— 直接报错收工
    throw new Error('拉取子级清单失败：' + err.message);
  }

  if (only) {
    const kept = children.filter((c) => only.includes(String(c.adcode)));
    const missing = only.filter((a) => !children.some((c) => String(c.adcode) === a));
    if (missing.length) {
      log('  ⚠ --only 里有 ' + missing.length + ' 个 adcode 不在这个父级下：' + missing.join(', '));
    }
    children = kept;
    log('  ℹ --only 生效，只处理 ' + children.length + ' 个');
  }

  if (!children.length) {
    log('没有要处理的子级，收工。');
    return;
  }

  if (dryRun) {
    log('\n（--dry-run：只列出将要接入的地图，没有联网下载、没有写盘）');
    children.forEach((c, i) => {
      const s2 = slugs.slugForAdcode(c.adcode);
      const exists = !!tree.scanMaps().maps[s2.slug];
      log('  ' + (i + 1) + '. ' + String(c.adcode) + ' ' + c.name.padEnd(10) +
        ' → ' + s2.slug.padEnd(12) + (exists ? '（已接入，会跳过）' : ''));
    });
    log('\n  合计：' + children.length + ' 个，其中已接入 ' +
      children.filter((c) => tree.scanMaps().maps[slugs.slugForAdcode(c.adcode).slug]).length + ' 个');
    return;
  }

  /* ---------- 3. 逐个接入 ---------- */
  log('\n══════════ 批量接入 ' + children.length + ' 张地图 ══════════');
  const records = [];
  let created = 0;
  let existing = 0;
  let failed = 0;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const tag = '[' + (i + 1) + '/' + children.length + '] ';
    const slugInfo = slugs.slugForAdcode(child.adcode);
    const slug = slugInfo.slug;
    const already = !!tree.scanMaps().maps[slug];

    if (already && !force && !geoOnly) {
      log(tag + '· ' + child.name + '（' + slug + '）已接入，跳过');
      existing++;
      records.push({
        adcode: child.adcode,
        name: child.name,
        slug,
        slugSource: slugInfo.source,
        status: 'existing',
      });
      continue;
    }

    log(tag + child.name + ' → ' + slug);
    try {
      const res = await addMap({
        adcode: child.adcode,
        slug,
        parentSlug,
        force,
        geoOnly,
        dryRun,
        log: quiet ? () => {} : (m) => console.log('    ' + m),
      });
      const m = res.maps[res.maps.length - 1] || null;
      created += res.status === 'created' ? 1 : 0;
      records.push({
        adcode: child.adcode,
        name: m ? m.name : child.name,
        slug,
        slugSource: slugInfo.source,
        status: res.status === 'created' ? 'created' : 'existing',
        districtCount: m ? m.districtCount : undefined,
        levelCount: m ? m.levelCount : undefined,
        featureCount: m ? m.featureCount : undefined,
        hasChildren: m ? m.hasChildren : undefined,
        skippedFeatures: m ? m.skippedFeatures : [],
        files: m ? m.files : null,
        placeholders: m ? m.placeholders : null,
      });
    } catch (err) {
      // 红线：失败就记下来跳过，不重试、不死循环
      failed++;
      log('    ✘ 失败，跳过：' + err.message.split('\n')[0]);
      records.push({
        adcode: child.adcode,
        name: child.name,
        slug,
        slugSource: slugInfo.source,
        status: 'failed',
        error: err.message,
      });
    }
  }

  /* ---------- 4. 统一重建一次注册表 ---------- */
  log('\n══════════ 更新注册表 ══════════');
  const regen = tree.regenerateRegistry({});
  regen.warns.forEach((p) => log('  ⚠ ' + p.message));
  regen.errors.forEach((p) => log('  ✘ ' + p.message));
  if (!regen.ok) {
    throw new Error('registry 生成失败（有 error），请先修掉上面的问题：\n  ' +
      regen.errors.map((e) => e.message).join('\n  '));
  }
  const totalMaps = Object.keys(regen.model.maps).length;
  log('  ✔ js/maps/registry.js（共 ' + totalMaps + ' 张地图，根 ' + regen.model.roots.length + ' 张）');

  /* ---------- 5. 报告 ---------- */
  const okRecords = records.filter((r) => r.status === 'created');
  const fallbackSlugs = records.filter((r) => r.slugSource === 'fallback').map((r) => r.slug);
  const needsHuman = okRecords
    .filter((r) => r.placeholders)
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      file: r.placeholders.file,
      districts: r.placeholders.perDistrict,
      levelBlurbs: r.placeholders.levelBlurbs,
      fields: r.placeholders.fields,
    }));
  const dataGaps = [];
  okRecords.forEach((r) => {
    if (r.hasChildren === false) {
      dataGaps.push({
        slug: r.slug,
        name: r.name,
        kind: 'no-children',
        note: 'DataV 上这张地图没有下级区划，拼图只有 1 块',
      });
    }
    (r.skippedFeatures || []).forEach((s) => {
      dataGaps.push({
        slug: r.slug,
        name: r.name,
        kind: 'non-admin-feature',
        note: '非行政区 feature（' + s.adcode + (s.name ? ' ' + s.name : '') + '）只画底图，不进关卡',
      });
    });
  });

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'node tools/batch-add-maps.js --parent=' + parentAdcode +
      (only ? ' --only=' + only.join(',') : '') + (dryRun ? ' --dry-run' : ''),
    parent: {
      adcode: parentAdcode,
      slug: parentSlug,
      name: parentName,
      sourceUrl: parentUrl,
      slugSource: parentSlugInfo.source,
    },
    summary: {
      children: children.length,
      created,
      existing,
      failed,
    },
    registry: {
      path: 'js/maps/registry.js',
      totalMaps,
      roots: regen.model.roots,
      orphans: regen.model.orphans,
      warnings: regen.warns.map((w) => w.message),
    },
    maps: records,
    failures: records.filter((r) => r.status === 'failed').map((r) => ({
      adcode: r.adcode,
      name: r.name,
      slug: r.slug,
      error: r.error,
    })),
    // 交给人工的两份清单
    needsHuman,
    dataGaps,
    fallbackSlugs,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  /* ---------- 6. 收尾打印 ---------- */
  const rel = path.relative(process.cwd(), reportPath);
  log('\n══════════ 汇总 ══════════');
  log('  子级总数：' + children.length + '　新建：' + created + '　已存在：' + existing + '　失败：' + failed);
  log('  ✔ 报告已写入 ' + rel);

  if (needsHuman.length) {
    const totalDistricts = needsHuman.reduce((n, h) => n + h.districts, 0);
    log('  ⚠ 待人工补资料：' + needsHuman.length + ' 张地图、共 ' + totalDistricts +
      ' 个下级行政区 × ' + needsHuman[0].fields.length + ' 项（area / landmark / tagline / funFact）');
  }
  if (fallbackSlugs.length) {
    log('  ⚠ 这些 slug 是自动兜底的（表里没有拼音），建议人工改成拼音：' + fallbackSlugs.join(', '));
  }
  if (dataGaps.length) {
    log('  ℹ 数据缺口 ' + dataGaps.length + ' 条，详见报告 dataGaps');
  }
  if (failed) {
    log('  ✘ 有 ' + failed + ' 张失败（已跳过，未重试）：' +
      report.failures.map((f) => f.name).join('、'));
  }
  log('  · 下一步：node tools/e2e-test.js（确认没带坏老地图）');

  // 有失败就以非 0 退出，方便脚本/CI 察觉；报告里也有同样信息
  if (failed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n✘ ' + err.message);
    process.exit(1);
  });
}
