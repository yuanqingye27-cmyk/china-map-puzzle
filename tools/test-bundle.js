#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 单文件离线打包 · 离线自测
 * ---------------------------------------------------------------------
 * 路径：tools/test-bundle.js（接入 e2e-test.js 的"离线检查"套件）
 *
 * 【为什么必须测】
 * 打包器坏了不会报错 —— 它会安静地产出一个"能打开、但切地图就崩"的
 * HTML。而这份 HTML 是要发给别人的：对方打不开就会直接关掉，
 * 不会回来告诉你哪里错了。所以每条"看起来一定是这样"的假设都要钉住。
 *
 * 只打一张小地图（成都），几秒钟跑完；全国版的体积/耗时不在单测范围。
 * ===================================================================== */

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const B = require(path.join(__dirname, 'bundle.js'));

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✔ ' + name); }
  else { failed++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

console.log('══════════ 单文件离线打包 · 离线自测 ══════════');

const registry = B.loadRegistry();

/* ---------- 选择范围：默认要带上全部下级 ---------- */
{
  /* 成都是一张"叶子地图"：它的区县是同一张图里的多边形，不是独立的子地图包。
   * 所以拿省来测"带下级" —— 省下面才是地级市地图包。 */
  const ids = B.resolveIds(registry, { maps: ['sichuan'], descendants: true });
  check('--maps=sichuan 会带上下级', ids.length > 1, String(ids.length));
  check('四川省自己一定在里面', ids.indexOf('sichuan') >= 0);
  check('与 collectDescendants 的结果一致',
    JSON.stringify(ids.slice().sort()) ===
    JSON.stringify(B.collectDescendants(registry, 'sichuan').slice().sort()));

  /* 叶子地图（没有子地图包）只带自己，这是正确的，不该报错 */
  const leaf = B.resolveIds(registry, { maps: ['chengdu'], descendants: true });
  check('叶子地图（成都）带下级后仍只有自己', leaf.length === 1, JSON.stringify(leaf));

  const only = B.resolveIds(registry, { maps: ['chengdu'], descendants: false });
  check('--no-descendants 时只有它自己',
    only.length === 1 && only[0] === 'chengdu', JSON.stringify(only));

  const sichuan = B.resolveIds(registry, { province: 'sichuan' });
  check('--province=sichuan 含四川省本身', sichuan.indexOf('sichuan') >= 0);
  check('--province=sichuan 含成都市', sichuan.indexOf('chengdu') >= 0);
  check('--province=sichuan 不含北京（不越界）', sichuan.indexOf('beijing') < 0);
  check('--province=sichuan 比 --all 小得多',
    sichuan.length < Object.keys(registry.maps).length / 2,
    sichuan.length + ' / ' + Object.keys(registry.maps).length);

  let threw = false;
  try { B.resolveIds(registry, { maps: ['no-such-map'], descendants: true }); } catch (e) { threw = true; }
  check('地图名写错时明确报错（不静默产出空包）', threw);

  threw = false;
  try { B.resolveIds(registry, {}); } catch (e) { threw = true; }
  check('一个范围参数都没给时报错', threw);
}

/* ---------- 裁剪登记册：这是"切地图不崩"的关键 ---------- */
{
  const ids = B.resolveIds(registry, { province: 'sichuan' });
  const pruned = B.pruneRegistry(registry, ids);

  check('裁剪后只剩选中的地图',
    Object.keys(pruned.maps).length === ids.length,
    Object.keys(pruned.maps).length + ' vs ' + ids.length);
  check('裁剪后没有包外地图', Object.keys(pruned.maps).every((id) => ids.indexOf(id) >= 0));

  /* 最关键的一条：parent 指向包外时必须置 null。
   * 否则面包屑会指向一张没打进来的图，点一下就是死路。 */
  check('省级地图的 parent 被置为 null（china 没打进包）',
    pruned.maps.sichuan.parent === null, String(pruned.maps.sichuan.parent));
  check('省内地级市的 parent 仍然指向四川省',
    pruned.maps.chengdu.parent === 'sichuan', String(pruned.maps.chengdu.parent));
  check('children 里不含包外地图',
    Object.keys(pruned.maps).every((id) =>
      (pruned.maps[id].children || []).every((c) => pruned.maps[c])));
  check('roots 与"parent 为 null"的集合一致',
    JSON.stringify(pruned.roots.slice().sort()) ===
    JSON.stringify(Object.keys(pruned.maps).filter((id) => pruned.maps[id].parent === null).sort()));
  check('没有孤儿（孤儿 = 父级不在包里且自身不是根）', pruned.orphans.length === 0);
}

/* ---------- 内联：产物必须是**真的**单文件 ---------- */
{
  const ids = B.resolveIds(registry, { maps: ['chengdu'], descendants: true });
  const pruned = B.pruneRegistry(registry, ids);
  const html = B.inlineIndex(
    fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), pruned, ids);

  check('没有残留的 <script src=', html.indexOf('<script src=') < 0);
  check('没有残留的 <link rel="stylesheet"', html.indexOf('<link rel="stylesheet"') < 0);
  check('保留了 </body> 结尾的结构', html.indexOf('</body>') >= 0);
  check('样式确实被内联进来了', html.indexOf('.info-card') >= 0);
  check('公共脚本确实被内联进来了', html.indexOf('MapProgress') >= 0);

  /* 三件套的顺序不能错：geo → data → config */
  const iGeo = html.lastIndexOf('MAP_GEO = global.MAP_GEO');
  const iCfg = html.lastIndexOf('PACKAGES.chengdu = CONFIG');
  check('地图包被内联（找得到 PACKAGES 赋值）', iCfg > 0);
  check('geo 在配置之前（顺序就是依赖顺序）', iGeo > 0 && iGeo < iCfg,
    'geo@' + iGeo + ' cfg@' + iCfg);

  /* 内联的登记册必须能被真的执行，且和 pruneRegistry 的结果一致 ——
   * 这是"页面里那份 registry 和打包器以为的一致"的唯一证据 */
  const m = /var REGISTRY = (\{[\s\S]*?\});\n  global\.MAP_REGISTRY/.exec(html);
  check('产物里能定位到内联的登记册', !!m);
  if (m) {
    const sandbox = {};
    vm.runInNewContext(
      '(function (global) { global.MAP_REGISTRY = ' + m[1] + '; })(window);', { window: sandbox });
    check('内联登记册的条目数与裁剪结果一致',
      Object.keys(sandbox.MAP_REGISTRY.maps).length === ids.length,
      Object.keys(sandbox.MAP_REGISTRY.maps).length + ' vs ' + ids.length);
    check('内联登记册里没有北京（说明确实裁过）',
      !sandbox.MAP_REGISTRY.maps.beijing);
  }

  /* 产物要能真的落盘并被浏览器当 HTML 解析：这里只做最基础的护栏 */
  check('产物以 <!DOCTYPE 或 <html 开头',
    /^\s*<(!DOCTYPE|html)/i.test(html), html.slice(0, 40));
  check('产物里没有 Node 才会出现的 require(',
    html.indexOf('require(') < 0);
}

/* ---------- 端到端跑一次（真的落盘），再检查文件 ---------- */
{
  const tmp = path.join(os.tmpdir(), 'bundle-test-' + process.pid + '.html');
  const argv = process.argv;
  process.argv = [argv[0], argv[1], '--maps=chengdu', '--out=' + tmp];
  try {
    B.main();
    const html = fs.readFileSync(tmp, 'utf8');
    check('打包确实产出了文件', html.length > 100000, String(html.length));
    check('产物里含成都的区县数据（几何）', html.indexOf('MAP_GEO') >= 0);
    check('产物中文没有乱码（UTF-8 原样）', html.indexOf('成都市') >= 0);
  } catch (e) {
    check('端到端打包不抛异常', false, e.message);
  } finally {
    process.argv = argv;
    try { fs.unlinkSync(tmp); } catch (e) { /* 没生成也无所谓 */ }
  }
}

console.log('\n  → ' + passed + ' 通过 / ' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
