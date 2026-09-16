#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 构建脚本 · 只重刷成都一张地图的边界数据
 * ---------------------------------------------------------------------
 * 路径：tools/build-data.js
 * 用法：node tools/build-data.js [源 GeoJSON 路径]
 *       不给参数时自动去 DataV 下载（adcode 510100）
 *
 * 这个脚本现在很薄：转换规则全部在 tools/lib/inline-geo.js 里，
 * 与 tools/add-map.js 共用同一份实现 —— 两个入口不会生成不一致的数据。
 *
 * 新地图请用：node tools/add-map.js --adcode=… --name=… --parent=…
 * 本脚本保留下来，只是为了让成都这张图有个"一键重刷"的老入口。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const geoLib = require('./lib/inline-geo');
const tree = require('./lib/map-tree');

const ID = 'chengdu';
const ADCODE = 510100;
const LABEL = '成都市';
const OUT = tree.absOf('china/sichuan/chengdu.geo.js');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

async function main() {
  const src = process.argv[2];
  let raw;
  let sourceUrl = geoLib.DATAV_BASE + '/' + ADCODE + '_full.json';
  let rawBytes = 0;

  if (src) {
    raw = JSON.parse(fs.readFileSync(src, 'utf8'));
    rawBytes = fs.statSync(src).size;
    console.log('数据源：本地文件 ' + src);
  } else {
    const fetched = await geoLib.fetchDatavGeo(ADCODE, { log: (m) => console.log(m) });
    raw = fetched.raw;
    sourceUrl = fetched.url;
    console.log('数据源：' + sourceUrl);
  }

  const geo = geoLib.normalizeGeo(raw, sourceUrl);
  const written = geoLib.writeGeoModule(OUT, geo, {
    id: ID,
    label: LABEL,
    adcode: ADCODE,
    sourceUrl,
    generator: 'node tools/build-data.js',
  });

  console.log('✔ 已生成 ' + path.relative(process.cwd(), written.path));
  console.log('  区县数量：' + geo.features.length);
  console.log('  文件体积：' + kb(written.bytes) + (rawBytes ? '（原始 ' + kb(rawBytes) + '）' : ''));
}

main().catch((err) => {
  console.error('✘ ' + err.message);
  process.exit(1);
});
