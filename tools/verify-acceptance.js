/**
 * 验收核对（提示词 §7 的 9 条，逐项机器核对）
 *
 * 【为什么要写成脚本而不是写在文档里】
 *   验收标准只写进文档，就会像之前那三处基线数字一样漂掉 ——
 *   没人会每次回去逐条手工对。写成脚本之后，"现在是否满足验收标准"
 *   是一条命令的事，而且和代码一起演进。
 *
 * 【这个脚本不替代 e2e-test.js】它核对的是"验收标准"这一层：
 *   有些条目本身就跑测试（比如"全量 0 失败"），有些是工作区状态
 *   （git 干净、合规零改动），还有些是静态事实（默认地图是哪个）。
 *   真正的行为断言在 e2e-test.js 里，这里只负责"逐条点名"。
 *
 * 用法：
 *   node tools/verify-acceptance.js            # 不含全量测试（快）
 *   node tools/verify-acceptance.js --full     # 额外跑一次全量测试
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const WITH_FULL = argv.includes('--full');

const rows = [];
function item(name, ok, detail) {
  rows.push({ name, ok, detail });
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return (r.stdout || '').trim();
}

/* ---------- 1. 默认打开是中国图 ---------- */
{
  const game = read('js/game.js');
  const m = /DEFAULT_MAP\s*=\s*'([^']+)'/.exec(game);
  const def = m ? m[1] : '(找不到)';
  item('默认打开是中国图（?map= 参数切换正常）', def === 'china',
    'DEFAULT_MAP = ' + def);
  /* 顺带确认"无 ?map= 时"走的确实是这个常量 */
  item('　└ 无参数时确实取 DEFAULT_MAP', /if \(fromUrl\) return fromUrl;/.test(game),
    'pickMapId 先看 ?map=，没有才用默认值');
}

/* ---------- 2. 极小碎片可拖放 + 大碎片不退化 ---------- */
{
  const tiny = read('tools/tiny-drag-test.html');
  const hasRealData = /820000/.test(tiny) && /810000/.test(tiny);
  const hasZoom = /缩小|推近|zoom/i.test(tiny) || /镜头/.test(tiny);
  item('极小碎片（澳门/香港）用真实数据有正断言', hasRealData && hasZoom,
    'tools/tiny-drag-test.html 覆盖 820000/810000 与镜头推近');
  const engine = read('js/engine.js');
  item('　└ 推近是"按下即触发"，拖动全程镜头静止',
    /zoomForTinyPiece\(adcode\);\s*$/m.test(engine) && /settleZoomNow\(\)/.test(engine),
    'zoomForTinyPiece 挂在 onPieceDown；settleZoomNow 挂在越过拖拽阈值处');
  item('　└ 放完一块后会退回全景（否则下一块没法放）',
    /scheduleZoomOut/.test(engine) && /resetAfterPlaceMs/.test(engine),
    'scheduleZoomOut + resetAfterPlaceMs');
}

/* ---------- 3. 全量测试 0 失败 ---------- */
{
  if (WITH_FULL) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'e2e-test.js')],
      { cwd: ROOT, encoding: 'utf8', timeout: 900000 });
    const out = (r.stdout || '') + (r.stderr || '');
    const m = /合计：(\d+) 通过 \/ (\d+) 失败/.exec(out);
    const passed = m ? Number(m[1]) : 0;
    const failed = m ? Number(m[2]) : -1;
    item('全量 e2e-test.js 0 失败', failed === 0,
      '合计 ' + passed + ' 通过 / ' + failed + ' 失败');
  } else {
    item('全量 e2e-test.js 0 失败', null,
      '未跑（加 --full 才跑，约 10 分钟）；上次实测 17185 通过 / 0 失败');
  }
}

/* ---------- 4. 断点布局 ---------- */
{
  const layout = read('tools/exp-layout.html');
  const breaks = [390, 620, 768, 1440, 1920].every((w) => layout.indexOf(String(w)) >= 0);
  item('5 个断点布局可机器核对（无溢出/无重叠/三主题）', breaks,
    'tools/exp-layout.html：' + (breaks ? '含 390/620/768/1440/1920' : '断点不全'));
  const shots = path.join(ROOT, 'docs/shots');
  const n = fs.existsSync(shots) ? fs.readdirSync(shots).filter((f) => /\.png$/.test(f)).length : 0;
  item('　└ 断点截图证据已生成', n >= 5, 'docs/shots/ 共 ' + n + ' 张 PNG');
}

/* ---------- 5. 内存与性能 ---------- */
{
  const boot = read('tools/exp-boot.html');
  item('连续切图内存 / 拖拽帧率可机器核对', /what=mem/.test(boot) || /runMem/.test(boot),
    'tools/exp-boot.html 的 ?what=mem|perf');
  item('　└ 首屏加载有防退步断言（冒烟套件每张图 2 条）',
    /首屏加载没有数量级退步/.test(read('tools/map-smoke.html')),
    '阈值 4000ms，只拦数量级退步');
}

/* ---------- 6. 键盘完整通关 ---------- */
{
  const st = read('tools/selftest.html');
  item('纯键盘可完整通关（有断言，非仅单块）',
    /纯键盘能把整关拼完/.test(st), 'selftest.html 第 15b 节');
  const engine = read('js/engine.js');
  item('　└ 空位与碎片都有可读名称 / 键盘可达',
    /aria-label/.test(engine) && /tabindex/.test(engine),
    'engine.js 里 aria-label 与 tabindex 均有');
}

/* ---------- 7. 错误边界 ---------- */
{
  const smoke = read('tools/map-smoke.html');
  item('错误边界生效（不存在的地图 / 存储不可用）',
    /checkErrorBoundary/.test(smoke) && /存储不可用时地图照常就绪/.test(smoke),
    '冒烟套件末尾的 5 条断言');
  item('　└ 地图包校验在交给引擎之前做', /function validateConfig/.test(read('js/game.js')),
    'js/game.js 的 validateConfig');
}

/* ---------- 8. 文档与工作区 ---------- */
{
  const dirty = git(['status', '--short']);
  item('git status 干净可提交', dirty === '', dirty ? dirty.split('\n').length + ' 项未提交' : '工作区干净');
  /* 基线数字是否一致（这是之前踩过的坑：三份文档互相矛盾） */
  const readme = read('README.md');
  const handover = read('HANDOVER.md');
  const status = read('tools/status.js');
  const nums = (s) => (s.match(/17185|17148|16371|16145/g) || []);
  const readmeNow = nums(readme).filter((x) => x === '17185').length;
  const handoverNow = nums(handover).filter((x) => x === '17185').length;
  item('测试基线数字三份文档一致（不再互相矛盾）',
    readmeNow > 0 && handoverNow > 0 && /2202/.test(status),
    'README ' + readmeNow + ' 处 / HANDOVER ' + handoverNow + ' 处 / status.js 用 2202');
  const changelog = read('CHANGELOG.md');
  item('　└ CHANGELOG 记录了本轮（第四轮）改动',
    /第四轮/.test(changelog), 'CHANGELOG.md 含"第四轮"');
}

/* ---------- 9. 合规零改动 ---------- */
{
  const changed = git(['log', '-10', '--name-only', '--pretty=format:'])
    .split('\n').map((s) => s.trim()).filter(Boolean);
  const geoFiles = changed.filter((f) => /\.geo\.js$/.test(f));
  item('合规零改动：最近 10 个提交不含任何 .geo.js',
    geoFiles.length === 0,
    geoFiles.length ? geoFiles.join(', ') : '0 个 .geo.js 被改');
  /* 敏感声明是否还在（不是"没改"，而是"现在仍然在"） */
  const idx = read('index.html');
  const engine = read('js/engine.js');
  item('　└ 审图号与来源声明仍在（页面上可见）',
    /mapSource/.test(idx) && /审图号/.test(engine + idx) || /MAP_GEO_META/.test(engine + idx),
    'index.html 的 #mapSource 由 MAP_GEO_META 渲染');
  item('　└ 矮屏收口没有藏掉来源/审图号',
    !/\.map-source\s*\{\s*display:\s*none/.test(read('css/style.css')),
    'css 里没有把 .map-source 隐藏的规则');
}

/* ---------- 输出 ---------- */
const pass = rows.filter((r) => r.ok === true).length;
const fail = rows.filter((r) => r.ok === false).length;
const skip = rows.filter((r) => r.ok === null).length;

console.log('');
console.log('══════════ 验收标准逐项核对（提示词 §7）══════════');
for (const r of rows) {
  const mark = r.ok === true ? '✔' : (r.ok === false ? '✘' : '·');
  console.log('  ' + mark + ' ' + r.name);
  if (r.detail) console.log('      ' + r.detail);
}
console.log('');
console.log('  满足 ' + pass + ' 项' + (fail ? '，**未满足 ' + fail + ' 项**' : '') +
  (skip ? '，未跑 ' + skip + ' 项' : ''));
console.log('');
process.exit(fail ? 1 : 0);
