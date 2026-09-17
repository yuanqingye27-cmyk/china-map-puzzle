#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 单文件离线打包器
 * ---------------------------------------------------------------------
 * 路径：tools/bundle.js
 *
 * 【为什么需要它】
 *   这个项目最大的成本不是服务器，是"让人真的能打开"。
 *   部署要域名、要备案、国内访问还不稳；把 zip 发给同学，
 *   对方解压后双击 index.html 就行 —— 但"解压一个文件夹"这步就能劝退一半人。
 *
 *   所以这里把整站压成**一个 .html 文件**：微信/QQ 直接发文件，
 *   对方点开就能玩，不需要网络、不需要服务器、不需要装任何东西。
 *   这是零成本的传播方案，也是"我穷但我能让它被玩到"的答案。
 *
 * 【为什么不用打包器】
 *   webpack/vite 都能做，但会引入 node_modules —— 而这个项目的底线是
 *   "node 只用来生成数据，运行时零依赖"。这里用几十行字符串替换就够了：
 *   所有脚本都是普通 <script>，没有模块系统，没有 import，根本不需要打包器。
 *
 * 【用法】
 *   node tools/bundle.js --all                      # 全国版（约 20MB，慎发）
 *   node tools/bundle.js --province=sichuan          # 一个省（含省内地级市和区县）
 *   node tools/bundle.js --maps=chengdu,leshan       # 指定地图（默认带上全部下级）
 *   node tools/bundle.js --maps=chengdu --no-descendants
 *   --out=<路径>   指定输出文件
 *   --label=<名字> 输出文件里的名字（默认按选择自动取）
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'js', 'maps');

/* ---------------------------- 参数 ---------------------------- */
function parseArgs(argv) {
  const out = { maps: null, province: null, all: false, descendants: true, out: null, label: null };
  argv.forEach((a) => {
    if (a === '--all') out.all = true;
    else if (a === '--no-descendants') out.descendants = false;
    else if (a.startsWith('--maps=')) out.maps = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--province=')) out.province = a.slice(11).trim();
    else if (a.startsWith('--out=')) out.out = a.slice(6).trim();
    else if (a.startsWith('--label=')) out.label = a.slice(8).trim();
    else {
      console.error('未知参数：' + a);
      console.error('用法：node tools/bundle.js --all | --province=<id> | --maps=a,b [--no-descendants] [--out=x.html]');
      process.exit(2);
    }
  });
  return out;
}

/* ------------------------- 读登记册 -------------------------
 * registry.js 是 `(function (global) { ... })(window)` 的形式，
 * 用一个只有 window 的沙箱跑一遍就能拿到那份纯数据对象 ——
 * 比正则解析可靠，也不会被生成器的格式变化坑到。
 * ---------------------------------------------------------- */
function loadRegistry() {
  const src = fs.readFileSync(path.join(MAPS_DIR, 'registry.js'), 'utf8');
  const sandbox = {};
  vm.runInNewContext(src, { window: sandbox });
  if (!sandbox.MAP_REGISTRY || !sandbox.MAP_REGISTRY.maps) {
    throw new Error('registry.js 没有产出 MAP_REGISTRY，先跑 node tools/build-registry.js');
  }
  return sandbox.MAP_REGISTRY;
}

/** 广度优先收集某张地图的全部下级 */
function collectDescendants(registry, id) {
  const seen = new Set();
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift();
    if (seen.has(cur)) continue;
    seen.add(cur);
    const e = registry.maps[cur];
    if (!e) continue;
    (e.children || []).forEach((c) => { if (!seen.has(c)) queue.push(c); });
  }
  return [...seen];
}

/** 按参数解析出要打包的 id 集合 */
function resolveIds(registry, args) {
  if (args.all) return Object.keys(registry.maps);
  if (args.maps && args.maps.length) {
    const bad = args.maps.filter((id) => !registry.maps[id]);
    if (bad.length) throw new Error('registry 里没有这些地图：' + bad.join('、'));
    const set = new Set();
    args.maps.forEach((id) => {
      if (args.descendants) collectDescendants(registry, id).forEach((x) => set.add(x));
      else set.add(id);
    });
    return [...set];
  }
  if (args.province) {
    if (!registry.maps[args.province]) throw new Error('registry 里没有地图：' + args.province);
    return collectDescendants(registry, args.province);
  }
  throw new Error('必须指定 --all / --province=<id> / --maps=a,b 之一');
}

/* ------------------- 裁剪登记册 -------------------
 * 打包后的页面里，切换地图的下拉框是从 registry 渲染的。
 * 如果原样带上 363 张地图，用户选中一张没打进包的图 → loader 去注入
 * 一个不存在的脚本 → 报错。所以这里只保留真正打进包的那些，
 * 并顺手修正 children / roots（parent 不在包里的，就地升为根）。
 * ------------------------------------------------ */
function pruneRegistry(registry, ids) {
  const keep = new Set(ids);
  const maps = {};
  ids.forEach((id) => {
    const e = registry.maps[id];
    maps[id] = {
      id: e.id,
      name: e.name,
      adcode: e.adcode,
      dir: e.dir,
      n: e.n,
      /* parent 指向包外时置 null：否则面包屑会指向一张打不开的图 */
      parent: keep.has(e.parent) ? e.parent : null,
      children: (e.children || []).filter((c) => keep.has(c)),
    };
  });
  const roots = ids.filter((id) => maps[id].parent === null);
  return {
    version: registry.version || 1,
    generatedBy: 'tools/bundle.js',
    roots,
    orphans: [],
    maps,
  };
}

/* ------------------- 内联 index.html -------------------
 * 只做一件事：把 <link rel=stylesheet> 和 <script src=js/...> 换成内联，
 * 其余一个字节都不动（HTML 结构由 map-smoke.html 的断言盯着，不该在这里被改写）。
 * ------------------------------------------------------ */
function inlineIndex(html, registry, ids) {
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  /* registry 单独处理：要换成裁剪过的版本 */
  html = html.replace(
    /[ \t]*<script src="js\/maps\/registry\.js"><\/script>/,
    () => '<script>\n' + registrySource(registry) + '\n</script>'
  );

  /* CSS */
  html = html.replace(
    /[ \t]*<link rel="stylesheet" href="([^"]+)">/g,
    (m, href) => '<style>\n' + read(href) + '\n</style>'
  );

  /* 其余 js/*.js 脚本（地图包不在 index.html 里，这里只会命中公共脚本） */
  html = html.replace(
    /[ \t]*<script src="(js\/[^"]+)"><\/script>/g,
    (m, src) => '<script>\n' + read(src) + '\n</script>'
  );

  /* 地图包按依赖顺序追加到 </body> 之前：
   * .geo.js 写 MAP_GEO → .data.js 写 MAP_DATA → .js 才组装出 MAP_PACKAGES。
   * 顺序不能改；但各张地图之间互相独立，谁先谁后都行。 */
  const blocks = ids.map((id) => {
    const e = registry.maps[id];
    const base = e.dir ? e.dir + '/' : '';
    const three = ['.geo.js', '.data.js', '.js'].map((ext) =>
      path.join(MAPS_DIR, base + id + ext));
    three.forEach((p) => {
      if (!fs.existsSync(p)) throw new Error('缺文件：' + path.relative(ROOT, p));
    });
    return '<!-- ' + e.name + ' -->\n' +
      three.map((p) => '<script>\n' + fs.readFileSync(p, 'utf8') + '\n</script>').join('\n');
  }).join('\n');

  html = html.replace(/<\/body>/, blocks + '\n</body>');
  return html;
}

/** 把登记册对象序列化成一份可直接执行的脚本 */
function registrySource(registry) {
  return '(function (global) {\n  \'use strict\';\n' +
    '  /* 由 tools/bundle.js 裁剪生成：只含本文件里真正打进包的地图 */\n' +
    '  var REGISTRY = ' + JSON.stringify(registry, null, 2) + ';\n' +
    '  global.MAP_REGISTRY = REGISTRY;\n' +
    '})(window);';
}

/* ---------------------------- 主流程 ---------------------------- */
function main() {
  const args = parseArgs(process.argv.slice(2));
  const registry = loadRegistry();
  const ids = resolveIds(registry, args);

  /* 体积护栏：全国版 20MB 在手机浏览器里要解析好一会儿。
   * 不阻止（有人确实需要），但把话说明白。 */
  const approxMB = ids.reduce((n, id) => n + (registry.maps[id].n || 0), 0);
  if (ids.length > 60) {
    console.warn('⚠ 这次要打包 ' + ids.length + ' 张地图，产出可能超过 10MB。');
    console.warn('  手机浏览器能打开，但首屏解析会明显变慢；建议按省打包再发。');
  }

  const pruned = pruneRegistry(registry, ids);
  const html = inlineIndex(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), pruned, ids);

  const label = args.label || defaultLabel(registry, args, ids);
  const outPath = path.resolve(ROOT, args.out || path.join('out', '地图拼图-' + label + '.html'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
  console.log('✔ 已生成单文件离线版：' + path.relative(ROOT, outPath) + '（' + kb + ' KB）');
  console.log('  含 ' + ids.length + ' 张地图、' + Object.keys(pruned.maps).length + ' 条登记项');
  console.log('  直接双击打开即可玩；发微信/QQ 文件时对方也能直接打开，不需要网络。');
  console.log('  再次生成：' + process.argv.slice(1).map((s) => (/\s/.test(s) ? '"' + s + '"' : s)).join(' '));
}

/** 输出文件名：能一眼看出这是哪一版 */
function defaultLabel(registry, args, ids) {
  if (args.province) return registry.maps[args.province].name;
  if (args.all) return '全国版';
  if (args.maps && args.maps.length === 1) {
    const e = registry.maps[args.maps[0]];
    return args.descendants ? e.name + '全境' : e.name;
  }
  if (args.maps && args.maps.length <= 3) return args.maps.map((id) => registry.maps[id].name).join('-');
  return '自定义' + ids.length + '张';
}

/* 只有"直接跑这个文件"时才执行打包。
 * 这样 tools/test-bundle.js 能 require 进来做断言，而不会顺手产出文件。 */
if (require.main === module) {
  main();
}

module.exports = {
  loadRegistry,
  collectDescendants,
  resolveIds,
  pruneRegistry,
  inlineIndex,
  registrySource,
  parseArgs,
  defaultLabel,
  main,
};
