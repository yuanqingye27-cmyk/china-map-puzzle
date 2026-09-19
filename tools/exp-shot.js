/**
 * 截图驱动 —— 把 tools/exp-shot.html 按指定断点/主题定格，再用 Chrome 截图。
 *
 * 【为什么单独一个脚本，不复用 exp-run.js】
 *   exp-run.js 是"起 HTTP 服务 + 收页面回传结果"的模式；
 *   截图不需要回传，只需要让 Chrome 渲染完再截图 ——
 *   用 Chrome 自带的 --screenshot 最直接，也省掉一次页面通信。
 *
 * 【为什么不用"加载完就截"】Chrome 的 --screenshot 默认截"首帧附近"，
 *   那时地图还没画出来。exp-shot.html 里用 iframe + 轮询等就绪，
 *   并在 document.title 上打 SHOT-READY 标记；本脚本用 --virtual-time-budget
 *   给足渲染时间，保证截到的是稳定画面。
 *
 * 用法：
 *   node tools/exp-shot.js --out=docs/shots --map=china
 *   node tools/exp-shot.js --out=docs/shots --map=china --only=大屏
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const argOf = (k, d) => {
  const hit = argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.split('=').slice(1).join('=') : d;
};

const OUT_DIR = path.resolve(argOf('out', 'docs/shots'));
const MAP = argOf('map', 'china');
const ONLY = argOf('only', '');

/* 断点清单：覆盖 P0-4 要求的手机竖屏 / 平板 / 桌面 / 大屏，
 * 外加一条"手机横屏"（提示词 §7 验收里点名要"手机横屏正常"）。 */
const SHOTS = [
  { name: '手机竖屏-390x844', w: 390, h: 844, theme: 'jade' },
  { name: '手机横屏-844x390', w: 844, h: 390, theme: 'jade' },
  { name: '平板-768x1024', w: 768, h: 1024, theme: 'jade' },
  { name: '桌面-1440x900', w: 1440, h: 900, theme: 'jade' },
  { name: '教室大屏-1920x1080', w: 1920, h: 1080, theme: 'jade' },
  /* 三主题各来一张，证明新增界面在主题下都正常 */
  { name: '主题-银杏-1440x900', w: 1440, h: 900, theme: 'ginkgo' },
  { name: '主题-朱砂-1440x900', w: 1440, h: 900, theme: 'shu' },
];

function shootOne(shot) {
  const page = 'file://' + path.resolve(__dirname, 'exp-shot.html')
    + '?map=' + encodeURIComponent(MAP)
    + '&w=' + shot.w + '&h=' + shot.h
    + '&theme=' + shot.theme;

  const outFile = path.join(OUT_DIR, shot.name + '.png');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-puzzle-shot-'));
  const args = [
    '--headless',
    '--no-sandbox',          // 这台机器 sandbox 起不来（会 SIGTRAP），e2e 里同理
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--allow-file-access-from-files',   // 探针页要读 iframe 里的被测页
    '--user-data-dir=' + userDataDir,
    /* 【为什么用 --timeout 而不是 --virtual-time-budget】
     * 试过 --virtual-time-budget=6000，结果整个脚本卡死：它把页面里的
     * setInterval 当成"还有活要干"，虚拟时间永远推进不完，Chrome 就不退出。
     * --timeout 是"给它最多这么多真实毫秒渲染，然后截当前画面" ——
     * 对本场景（等地图画出来）正好合用，而且不会挂。 */
    '--timeout=12000',
    '--window-size=' + shot.w + ',' + shot.h,
    '--screenshot=' + outFile,
    page,
  ];

  const r = spawnSync(CHROME, args, { encoding: 'utf8', timeout: 60000 });
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }

  const ok = fs.existsSync(outFile) && fs.statSync(outFile).size > 2000;
  return {
    ok,
    file: outFile,
    size: ok ? fs.statSync(outFile).size : 0,
    stderr: (r.stderr || '').slice(-200),
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log('截图输出目录：' + OUT_DIR);
console.log('地图：' + MAP + (ONLY ? '　只截：' + ONLY : ''));
console.log('');

let failed = 0;
for (const shot of SHOTS) {
  if (ONLY && shot.name.indexOf(ONLY) < 0) continue;
  const r = shootOne(shot);
  if (r.ok) {
    console.log('  ✔ ' + shot.name + '　' + Math.round(r.size / 1024) + ' KB');
  } else {
    failed++;
    console.log('  ✘ ' + shot.name + '　没截出来' + (r.stderr ? '　' + r.stderr : ''));
  }
}
console.log('');
console.log(failed ? '有 ' + failed + ' 张失败' : '全部截好');
process.exit(failed ? 1 : 0);
