#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 单元测试 · WKT / 坐标串 → GeoJSON 转换
 * ---------------------------------------------------------------------
 * 路径：tools/test-wkt.js
 * 用法：node tools/test-wkt.js        （被 tools/e2e-test.js 自动调用）
 *
 * 为什么值得单独测：天地图要 Key 才能调，**联网那一段在拿到 Key 之前无法验证**；
 * 但"边界字符串 → GeoJSON"这一段是纯计算，可以拿真实形态的样例离线测透。
 * 把能测的测死，等 Key 到手时就只剩"网络请求成不成功"这一件事要查。
 * ===================================================================== */

const assert = require('assert');
const wkt = require('./lib/wkt');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✔ ' + name);
  } catch (err) {
    failed++;
    failures.push(name);
    console.log('  ✘ ' + name + '  → ' + err.message);
  }
}

console.log('══════════ WKT → GeoJSON ══════════');

check('POLYGON 解析成 Polygon，环自动闭合', () => {
  const g = wkt.parseWkt('POLYGON((116 39, 117 39, 117 40, 116 40))');
  assert.strictEqual(g.type, 'Polygon');
  assert.strictEqual(g.coordinates.length, 1);
  const ring = g.coordinates[0];
  assert.deepStrictEqual(ring[0], ring[ring.length - 1], '首尾应重合');
  assert.strictEqual(ring.length, 5);
});

check('带洞的 POLYGON：外环 + 内环都保留', () => {
  const g = wkt.parseWkt('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0),(2 2, 2 4, 4 4, 4 2, 2 2))');
  assert.strictEqual(g.type, 'Polygon');
  assert.strictEqual(g.coordinates.length, 2, '应有 2 个环（外环 + 洞）');
});

check('MULTIPOLYGON（飞地/海岛）：多个面都保留', () => {
  const g = wkt.parseWkt(
    'MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)),((5 5, 6 5, 6 6, 5 6, 5 5)))'
  );
  assert.strictEqual(g.type, 'MultiPolygon');
  assert.strictEqual(g.coordinates.length, 2);
  assert.strictEqual(g.coordinates[1][0][0][0], 5);
});

check('MULTIPOLYGON 带洞：两层嵌套都正确', () => {
  const g = wkt.parseWkt(
    'MULTIPOLYGON(((0 0, 9 0, 9 9, 0 9, 0 0),(3 3, 3 5, 5 5, 5 3, 3 3)),((20 20, 21 20, 21 21, 20 21, 20 20)))'
  );
  assert.strictEqual(g.coordinates[0].length, 2, '第一个面应含 2 个环');
  assert.strictEqual(g.coordinates[1].length, 1);
});

check('SRID 前缀被忽略', () => {
  const g = wkt.parseWkt('SRID=4326;POLYGON((1 1, 2 1, 2 2, 1 1))');
  assert.strictEqual(g.type, 'Polygon');
});

check('大小写 / 多余空白 / 换行都不影响', () => {
  const g = wkt.parseWkt('  multipolygon ( ( ( 1 1 , 2 1 ,\n 2 2 , 1 1 ) ) )  ');
  assert.strictEqual(g.type, 'MultiPolygon');
  assert.strictEqual(g.coordinates[0][0].length, 4);
});

check('负数与科学计数法坐标能读出来', () => {
  const g = wkt.parseWkt('POLYGON((-73.9 40.7, -7.39e1 40.8, -73.8 4.09e1, -73.9 40.7))');
  assert.strictEqual(g.coordinates[0][0][0], -73.9);
  assert.strictEqual(g.coordinates[0][1][1], 40.8);
});

check('老格式坐标串（分号分隔）→ Polygon', () => {
  const g = wkt.parseLegacyBoundary('116,39;117,39;117,40;116,40');
  assert.strictEqual(g.type, 'Polygon');
  assert.strictEqual(g.coordinates[0].length, 5, '应自动闭合');
});

check('老格式多段（| 分隔）→ MultiPolygon', () => {
  const g = wkt.parseWkt('116,39;117,39;117,40|120,30;121,30;121,31');
  assert.strictEqual(g.type, 'MultiPolygon');
  assert.strictEqual(g.coordinates.length, 2);
});

check('畸形输入报错，而不是悄悄产出垃圾', () => {
  assert.throws(() => wkt.parseWkt('POLYGON((a b, c d))'), /读不出坐标|结构异常/);
  assert.throws(() => wkt.parseWkt(''), /空的/);
  assert.throws(() => wkt.parseWkt('CIRCLE((1 1))'), /认不出的 WKT 类型/);
  assert.throws(() => wkt.parseWkt('POLYGON((1 1, 2 2'), /结构异常/);
});

console.log('\n══════════ 组装成引擎要的 FeatureCollection ══════════');

check('输出的 Feature 带 adcode / name / center，且几何是面', () => {
  const fc = wkt.toFeatureCollection([
    { adcode: 510100, name: '成都市', boundary: 'MULTIPOLYGON(((104 30, 105 30, 105 31, 104 31, 104 30)))' },
  ]);
  const f = fc.features[0];
  assert.strictEqual(fc.type, 'FeatureCollection');
  assert.strictEqual(f.properties.adcode, 510100);
  assert.strictEqual(f.properties.name, '成都市');
  assert.strictEqual(f.geometry.type, 'MultiPolygon');
  assert.ok(Array.isArray(f.properties.center) && f.properties.center.length === 2);
  assert.ok(Math.abs(f.properties.center[0] - 104.5) < 0.01, 'center 应在环的中间');
});

check('精度会按指定小数位收敛（体积可控）', () => {
  const fc = wkt.toFeatureCollection(
    [{ adcode: 1, name: 'x', boundary: 'POLYGON((104.123456789 30.987654321, 105 30, 105 31, 104.123456789 30.987654321))' }],
    { precision: 3 }
  );
  assert.strictEqual(fc.features[0].geometry.coordinates[0][0][0], 104.123);
});

check('线/点几何被明确拒绝（不能当拼图块）', () => {
  assert.throws(
    () => wkt.toFeatureCollection([{ adcode: 1, name: 'x', boundary: 'LINESTRING(1 1, 2 2)' }]),
    /不是面/
  );
});

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
if (failed) console.log('  失败项：' + failures.join('、'));

module.exports = { passed, failed, failures };
if (require.main === module) process.exit(failed ? 1 : 0);
