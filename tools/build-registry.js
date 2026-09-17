#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 构建脚本 · 扫描 js/maps/ 生成总登记册
 * ---------------------------------------------------------------------
 * 路径：tools/build-registry.js
 * 用法：node tools/build-registry.js [--force] [--quiet]
 *
 * 做四件事：
 *   1. 递归扫描 js/maps/，找出所有地图包（排除 .geo.js / .data.js / registry.js / loader.js）
 *   2. 在沙箱里执行每个包配置，读出 id / name / parent / adcode
 *   3. **按子地图的 parent 反向填充父地图的 children**，并做一致性体检
 *   4. 写出 js/maps/registry.js（自动生成，不手改）
 *
 * 体检项（有 error 就拒绝生成，除非 --force）：
 *   - 文件名与配置里的 id 是否一致
 *   - 是否缺 adcode
 *   - 放置位置是否符合「父目录 = 父地图 id」规则
 *   - 包配置登记的 key 与 id 是否一致
 * 只报警告的：
 *   - parent 指向的地图还没接入（会写进 registry.orphans）
 *   - 父包里手写的 children 与反推结果不一致
 * ===================================================================== */

const tree = require('./lib/map-tree');

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const quiet = args.includes('--quiet');

  const res = tree.regenerateRegistry({ force });
  const maps = Object.values(res.model.maps);

  if (!quiet) {
    console.log('══════════ 扫描 js/maps/ ══════════');
    if (!maps.length) {
      console.log('  （没有找到任何地图包）');
    }
    maps.forEach((m) => {
      const parent = m.parent === null ? '（根）' : m.parent;
      console.log(
        '  · ' + m.id.padEnd(12) + m.name.padEnd(8) +
        ' parent=' + String(parent).padEnd(10) +
        ' adcode=' + m.adcode +
        ' children=[' + m.children.join(', ') + ']'
      );
      // 脚本路径由 dir + id 推导（registry 里不再存 scripts 字段，省首屏体积）
      console.log('      ' + tree.scriptsOf(m).join('\n      '));
    });
  }

  res.warns.forEach((p) => console.log('  ⚠ ' + p.message));
  res.errors.forEach((p) => console.log('  ✘ ' + p.message));

  if (!res.ok) {
    console.log('\n✘ 有 ' + res.errors.length + ' 个错误，已放弃生成 registry.js（可加 --force 强行生成）');
    process.exit(1);
    return;
  }

  const rel = res.file.replace(tree.ROOT + '/', '');
  console.log('\n✔ 已生成 ' + rel);
  console.log('  地图数量：' + maps.length + '（根 ' + res.model.roots.length + ' 张）');
  if (res.model.roots.length) console.log('  根地图：' + res.model.roots.join(', '));
  if (res.model.orphans.length) {
    console.log('  父级待接入：' + res.model.orphans.map((o) => o.id + '→' + o.parent).join(', '));
  }
  if (res.warns.length) console.log('  警告：' + res.warns.length + ' 条');
}

main();
