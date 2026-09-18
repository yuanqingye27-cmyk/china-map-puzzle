#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 部署包生成器（多文件版，专治 Cloudflare Pages 的 1000 文件上限）
 * ---------------------------------------------------------------------
 * 路径：tools/deploy-pack.js
 *
 * 【为什么需要它】
 *   Cloudflare Pages 的**网页端拖拽上传上限是 1000 个文件**，
 *   而全国版 deploy/ 有 1100 个（363 张地图 × 3）—— 拖不上去。
 *   官方给的两条出路是"传更少"或"用 Wrangler（上限 20000）"。
 *   这个工具把第一条路做成一条命令：**按范围裁剪出 1000 个文件以内的部署包**。
 *
 *   和 tools/bundle.js 的分工：
 *     bundle.js       → 单文件 HTML（把所有东西内联成一个 .html，1 个文件）
 *     deploy-pack.js  → 多文件目录（保持正常的目录结构，但只含指定范围的地图）
 *   前者适合"发个文件就能玩"，后者适合"传静态托管、要正常的多文件站点"。
 *
 * 【关键点：registry 必须一起裁】
 *   registry.js 登记了全部 363 张地图。只删文件不裁 registry 的话，
 *   地图菜单里照样列出 363 张，点开没打进包的 → 404。
 *   所以这里复用 bundle.js 里已经写好、已经有测试覆盖的 pruneRegistry()。
 *
 * 用法：
 *   node tools/deploy-pack.js --province=sichuan          # 一个省（含其下级）
 *   node tools/deploy-pack.js --maps=chengdu,leshan       # 指定地图
 *   node tools/deploy-pack.js --all                       # 全国（会超 1000，会警告）
 *   --out=<目录>   默认 deploy-<label>
 *   --label=<名>   输出目录名里的名字
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const B = require(path.join(__dirname, 'bundle.js'));

const ROOT = path.join(__dirname, '..');
/** Cloudflare Pages 网页端拖拽上传的硬上限 */
const CF_FILE_LIMIT = 1000;

/* 运行网站必需的"外壳"脚本 —— **从 index.html 里推导**，不手写清单。
 * 【为什么】手写清单是个维护陷阱：新加一个 js/modes.js 就容易忘记往这里补，
 * 结果产出的部署包少一个脚本、页面静默降级（我们刚踩过一次）。
 * 以 index.html 实际加载的东西为准，就不可能漏。 */
function shellScriptsFromIndex() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const all = srcs.filter((r) => !/^https?:/.test(r));
  return {
    /* js/maps/ 下的通用两个（loader / registry）与根地图三件套单独处理 */
    js: all.filter((r) => !r.startsWith('js/maps/')),
    maps: all.filter((r) => r.startsWith('js/maps/')),
  };
}

function argOf(k, d) {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.split('=').slice(1).join('=') : d;
}

function main() {
  const args = B.parseArgs(process.argv.slice(2));
  const registry = B.loadRegistry();
  const ids = B.resolveIds(registry, args);

  /* 外壳 + 每张地图 3 个文件 */
  const shellCount = (() => {
    const sh = shellScriptsFromIndex();
    return 2 + sh.js.length + sh.maps.length + 3;   // index.html + css + 脚本 + 根图三件套
  })();
  const fileCount = shellCount + ids.length * 3;
  const label = args.label || B.defaultLabel(registry, args, ids);
  const outDir = path.resolve(ROOT, args.out || ('deploy-' + label));

  console.log('══════════ 部署包生成 ══════════');
  console.log('  范围        ' + label + '（' + ids.length + ' 张地图）');
  console.log('  预计文件数  ' + fileCount + '（Cloudflare 网页端上限 ' + CF_FILE_LIMIT + '）');

  if (fileCount > CF_FILE_LIMIT) {
    console.warn('\n  ⚠ 超过 ' + CF_FILE_LIMIT + ' 个文件，网页端拖拽会失败：');
    console.warn('     · 换成更小的范围：--province=<省> 或 --maps=a,b');
    console.warn('     · 或者改用 Wrangler 命令行（上限 20000）：');
    console.warn('       npx wrangler@latest pages deploy ' + path.basename(outDir) +
      ' --project-name=<项目名>');
    console.warn('     · 或者要"一个文件"的产物：node tools/bundle.js --province=<省>\n');
    if (!process.argv.includes('--force')) {
      console.error('  ✘ 已中止（确实要生成就加 --force）');
      process.exitCode = 1;
      return;
    }
  }

  /* 1) 干净重建 */
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'css'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'js', 'maps'), { recursive: true });

  /* 2) 外壳 */
  const copy = (rel) => {
    const src = path.join(ROOT, rel);
    const dst = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  };
  const shell = shellScriptsFromIndex();
  copy('index.html');
  copy('css/style.css');
  shell.js.forEach(copy);
  /* 根地图三件套 + loader/registry 都要；china.js/china.geo.js/china.data.js
   * 不直接出现在 index.html 里（registry 会推导它们的路径），所以显式补上 */
  shell.maps.forEach(copy);
  ['js/maps/loader.js', 'js/maps/china.js', 'js/maps/china.geo.js', 'js/maps/china.data.js']
    .forEach((r) => { if (!fs.existsSync(path.join(outDir, r))) copy(r); });

  /* 3) 地图包三件套 */
  let copied = 0;
  ids.forEach((id) => {
    const e = registry.maps[id];
    const base = e.dir ? e.dir + '/' : '';
    ['.geo.js', '.data.js', '.js'].forEach((ext) => {
      const rel = 'js/maps/' + base + id + ext;
      const src = path.join(ROOT, rel);
      if (!fs.existsSync(src)) throw new Error('缺文件：' + rel);
      const dst = path.join(outDir, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      copied++;
    });
  });

  /* 4) 裁剪过的 registry（这一步是"不 404"的关键，直接复用 bundle.js 的实现） */
  const pruned = B.pruneRegistry(registry, ids);
  fs.writeFileSync(path.join(outDir, 'js', 'maps', 'registry.js'), B.registrySource(pruned));

  /* 5) 产物校验断言 —— 产物是拿去部署的，"生成了"和"能用"是两件事 */
  const problems = [];
  // 5a. index.html 引用的本地资源都在
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(?!http|#)([^"]+)"/g)].map((m) => m[1]);
  refs.forEach((r) => {
    if (!fs.existsSync(path.join(outDir, r))) problems.push('index.html 引用了不存在的 ' + r);
  });
  // 5b. 每张选中地图的三个文件都在
  ids.forEach((id) => {
    const e = registry.maps[id];
    const base = e.dir ? e.dir + '/' : '';
    ['.geo.js', '.data.js', '.js'].forEach((ext) => {
      const p = path.join(outDir, 'js/maps/' + base + id + ext);
      if (!fs.existsSync(p)) problems.push('缺文件 ' + path.relative(outDir, p));
    });
  });
  // 5c. registry 真的裁过了：不含范围外的地图，且 parent 指向范围外时为 null
  const outReg = (() => {
    const vm = require('vm');
    const sb = {};
    vm.runInNewContext(
      fs.readFileSync(path.join(outDir, 'js/maps/registry.js'), 'utf8'), { window: sb });
    return sb.MAP_REGISTRY;
  })();
  const outIds = Object.keys(outReg.maps);
  if (outIds.length !== ids.length) {
    problems.push('裁剪后的 registry 有 ' + outIds.length + ' 条，应为 ' + ids.length);
  }
  const extra = outIds.filter((x) => ids.indexOf(x) < 0);
  if (extra.length) problems.push('registry 里混进了范围外的地图：' + extra.slice(0, 5).join('、'));
  Object.keys(outReg.maps).forEach((id) => {
    const p = outReg.maps[id].parent;
    if (p && !outReg.maps[p]) problems.push(id + ' 的 parent «' + p + '» 不在包里（面包屑会 404）');
    (outReg.maps[id].children || []).forEach((c) => {
      if (!outReg.maps[c]) problems.push(id + ' 的 children 里 ' + c + ' 不在包里');
    });
  });
  // 5d. 不该出现的东西
  ['tools', 'docs', 'data', '.git', 'out'].forEach((bad) => {
    if (fs.existsSync(path.join(outDir, bad))) problems.push('不该出现的目录：' + bad);
  });

  /* 6) 报告 */
  const n = (function count(dir) {
    let t = 0;
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      t += e.isDirectory() ? count(path.join(dir, e.name)) : 1;
    });
    return t;
  })(outDir);
  const bytes = (function size(dir) {
    let t = 0;
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      t += e.isDirectory() ? size(p) : fs.statSync(p).size;
    });
    return t;
  })(outDir);

  console.log('  实际文件数  ' + n + '（地图文件 ' + copied + ' 个）');
  console.log('  体积        ' + (bytes / 1048576).toFixed(1) + ' MB');
  console.log('  输出        ' + path.relative(ROOT, outDir));
  if (problems.length) {
    console.log('\n  ✘ 产物校验不通过：');
    problems.slice(0, 10).forEach((p) => console.log('    · ' + p));
    process.exitCode = 1;
    return;
  }
  console.log('  ✔ 产物校验通过（引用完整 / 三件套齐全 / registry 已裁 / 无越界目录）');
  console.log('  ' + (n <= CF_FILE_LIMIT
    ? '✔ ' + n + ' 个文件 ≤ ' + CF_FILE_LIMIT + '，可以直接在 Cloudflare 网页端拖拽上传'
    : '⚠ 超过 ' + CF_FILE_LIMIT + '，请改用 Wrangler 命令行上传'));
  console.log('\n  本地验证：cd ' + path.relative(ROOT, outDir) + ' && python3 -m http.server 8000');
}

main();
