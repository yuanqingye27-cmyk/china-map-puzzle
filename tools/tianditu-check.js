#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 天地图接入自检 · 拿到 Key 之后第一个该跑的命令
 * ---------------------------------------------------------------------
 * 路径：tools/tianditu-check.js
 *
 * 用法：
 *   node tools/tianditu-check.js --tk=你的Key
 *   node tools/tianditu-check.js --adcode=510100 --tk=你的Key
 *
 * 为什么要单独有这个脚本：
 *   天地图客户端（tools/lib/tianditu-geo.js）的**响应结构解析是防御式写的、尚未用真 Key 验证过**
 *   （写它的当晚没有 Key，接口对匿名请求只回 {"code":301001,"msg":"非法key"}）。
 *   所以拿到 Key 的第一件事不是跑批量换源，而是**先用一张地图把下面这几点看明白**：
 *     ① Key 能不能用、有没有配额
 *     ② 返回结构长什么样，我们的解析器抓到几个行政区
 *     ③ boundary 是不是 WKT，转出来的 GeoJSON 顶点数/面积量级对不对
 *   这三条确认了，再去 `replace-geo-source.js` 批量换。
 * ===================================================================== */

const tianditu = require('./lib/tianditu-geo');
const wkt = require('./lib/wkt');

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

/** 数一数几何里有多少个顶点，用来判断"边界的精细程度" */
function countVertices(geometry) {
  let n = 0;
  const walk = (x) => {
    if (typeof x[0] === 'number') { n++; return; }
    x.forEach(walk);
  };
  walk(geometry.coordinates);
  return n;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adcode = Number(args.adcode) || 510100; // 默认拿成都试

  console.log('══════════ 天地图自检 ══════════');
  let cfg;
  try {
    cfg = tianditu.resolveKey(args.tk);
  } catch (err) {
    console.error('✘ ' + err.message);
    process.exit(1);
  }
  console.log('  Key：' + cfg.tk.slice(0, 4) + '****' + cfg.tk.slice(-4) +
    '（长度 ' + cfg.tk.length + '）');
  console.log('  请求间隔：' + cfg.delayMs + ' ms');
  console.log('  测试 adcode：' + adcode);
  console.log('');

  let res;
  try {
    res = await tianditu.fetchDistrict({ code: adcode, child: true, tk: args.tk, log: (m) => console.log('  ' + m) });
  } catch (err) {
    console.error('\n✘ 调不通：' + err.message);
    console.error('\n排查顺序：');
    console.error('  1. Key 是否正确、是否勾选了「行政区划」服务（控制台里能看到调用量）');
    console.error('  2. 免费账号有每日配额，看是不是当天用完了');
    console.error('  3. 若报"被 WAF 拦"，试试浏览器 UA 或换个网络出口（部分机房 IP 会被拦）');
    process.exit(1);
  }

  console.log('\n  ① Key 可用 ✓');
  console.log('  ② 解析出 ' + res.items.length + ' 个带边界的行政区');
  res.items.slice(0, 8).forEach((it) => {
    console.log('     - adcode=' + String(it.adcode).padEnd(8) +
      String(it.name).padEnd(12) +
      'boundary 前 30 字：' + String(it.boundary).slice(0, 30).replace(/\n/g, ' '));
  });
  if (res.items.length > 8) console.log('     … 其余 ' + (res.items.length - 8) + ' 个略');

  if (!res.items.length) {
    console.log('\n  ✘ 没解析出任何边界。请把下面的原始响应片段发出来，好按真实结构调解析器：');
    console.log('  ' + JSON.stringify(res.raw).slice(0, 800));
    process.exit(1);
  }

  console.log('\n  ③ 逐条转换检查');
  let bad = 0;
  res.items.forEach((it) => {
    try {
      const g = wkt.parseWkt(it.boundary);
      const v = countVertices(g);
      console.log('     ✔ ' + String(it.name).padEnd(12) + g.type.padEnd(13) +
        '顶点 ' + String(v).padStart(6) +
        (v < 40 ? '  ← 顶点很少，边界可能很粗（拼图会显得方）' : ''));
    } catch (err) {
      bad++;
      console.log('     ✘ ' + String(it.name).padEnd(12) + err.message);
    }
  });

  console.log('\n══════════ 结论 ══════════');
  if (bad) {
    console.log('  ⚠ 有 ' + bad + ' 个解析失败 —— 先别批量换源，把失败的 boundary 片段拿来调解析器');
    process.exit(1);
  }
  console.log('  ✔ 全部解析成功。建议下一步（先试水，别直接全量）：');
  console.log('     node tools/replace-geo-source.js --source=tianditu --tk=<Key> --only=chengdu,zigong');
  console.log('     node tools/e2e-test.js');
  console.log('   然后**用眼睛看**这两张图的边界形态：缺口、飞地、精细度是否可接受，');
  console.log('   确认没问题再全量换（--only 去掉即可）。');
}

main().catch((err) => {
  console.error('✘ ' + err.message);
  process.exit(1);
});
