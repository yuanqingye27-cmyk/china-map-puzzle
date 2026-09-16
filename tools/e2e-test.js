/**
 * 端到端测试驱动（一次跑三套）。
 *
 * 思路：起一个本地 HTTP 服务，然后把测试载体页丢进 headless Chrome。
 * 载体页把被测页面装进 iframe、在里面模拟真人操作，跑完用隐表单 POST
 * 把结果回传（不吃 CORS 限制，也不吃 URL 长度限制）。
 *
 * 三套测试各管一段：
 *   selftest.html     城市回归 · 成都真实数据 + UI/动画（被测页 = index.html）
 *   engine-test.html  引擎功能 · 虚构 tiny-city 数据（被测页 = engine-host.html）
 *   map-smoke.html    多地图冒烟 · 登记册里每一张地图都真能玩（被测页 = index.html?map=<id>）
 * 每套单独起一个 Chrome（独立 user-data-dir），因此两边的 localStorage 互不可见。
 *
 * 为什么不直接上 CDP？headless Chrome 153 在 Runtime.enable 时会 SIGTRAP 崩溃，
 * 走不通；而这个方案不依赖任何调试协议，也不需要装 puppeteer。
 *
 * 用法：node tools/e2e-test.js
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HTTP_PORT = 9451;
const TIMEOUT_MS = 90000;

/**
 * 要跑的测试套件（顺序执行，每套各起一个 Chrome）。
 * 三套各管一段：
 *   selftest.html     城市回归 · 成都真实数据 + 全部 UI/动画细节
 *   engine-test.html  引擎功能 · 只用虚构 tiny-city，证明引擎与具体地图无关
 *   map-smoke.html    多地图冒烟 · 登记册里【每一张】地图都真能玩（生成物验收）
 */
const SUITES = [
  { name: '城市回归 · 成都（真实数据 + UI/动画）', page: 'selftest.html' },
  { name: '引擎功能 · 虚构 tiny-city（通用逻辑）', page: 'engine-test.html' },
  { name: '多地图冒烟 · 登记册里的每一张地图', page: 'map-smoke.html' },
];

/** 当前正在跑的套件；页面回传结果时用它把 Promise 收尾 */
let active = null;

/**
 * 静态检查：手机端性能降级规则确实写进 CSS 了。
 * 这部分本来想放进浏览器测试里跑，但 file:// 下动态创建的 iframe 会被
 * 跨源策略拦住、读不到 computedStyle，所以在 Node 侧直接查源码更稳。
 */
function checkMobilePerfCss() {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  // 注意：文件里有【两个】max-width:620px 媒体查询（布局一个、性能降级一个），
  // 所以要全部抠出来拼在一起看，只取第一个会漏掉降级规则。
  const blocks = [];
  let cursor = 0;
  for (;;) {
    const start = css.indexOf('@media (max-width: 620px)', cursor);
    if (start < 0) break;
    let depth = 0;
    let end = css.length;
    for (let i = css.indexOf('{', start); i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    blocks.push(css.slice(start, end));
    cursor = end + 1;
  }

  if (!blocks.length) return { ok: false, missing: ['max-width: 620px 媒体查询整块'] };
  const merged = blocks.join('\n');

  const expects = [
    ['backdrop-filter 被关掉', /backdrop-filter:\s*none/],
    ['全屏装饰层被隐藏', /\.bg-deco\s*\{\s*display:\s*none/],
    ['拖拽幽灵去掉投影', /\.drag-ghost\s*\{\s*filter:\s*none/],
    ['碎片允许收缩', /\.piece\s*\{[^}]*min-width:\s*0/],
  ];

  const missing = expects.filter(([, re]) => !re.test(merged)).map(([name]) => name);
  return { ok: missing.length === 0, missing, count: blocks.length };
}

/**
 * 跑一套浏览器测试：新起一个 headless Chrome 打开载体页，等它把结果 POST 回来。
 *
 * 每套用独立的 user-data-dir，一是避免两套互相读到对方的 localStorage，
 * 二是让"引擎套件不该污染城市存档"这类断言真的成立。
 *
 * @returns {Promise<{passed?:number, failed?:number, failures?:string[], crashed?:boolean}>}
 */
function runSuite(suite) {
  return new Promise((resolve) => {
    const url = 'file://' + path.resolve(__dirname, suite.page) + '?port=' + HTTP_PORT;
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-puzzle-e2e-'));

    const chrome = spawn(
      CHROME,
      [
        '--headless',
        // 这台机器上 Chrome 的 sandbox 起不来（会 SIGTRAP 崩溃），
        // 必须关掉才能跑 headless。测的是本地静态页面，无安全影响。
        '--no-sandbox',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        // 让载体页能操作 iframe 里的被测页面
        '--allow-file-access-from-files',
        '--user-data-dir=' + userDataDir,
        '--window-size=1700,1200',
        url,
      ],
      { stdio: 'ignore' }
    );

    const started = Date.now();
    let done = false;

    // 结束一套测试：关浏览器、清临时目录、交回结果（重复调用无副作用）
    const settle = (result) => {
      if (done) return;
      done = true;
      clearInterval(poll);
      active = null;
      try { chrome.kill('SIGKILL'); } catch (e) { /* 可能已经退了 */ }
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
      resolve(result);
    };

    active = { settle };

    const poll = setInterval(() => {
      if (Date.now() - started > TIMEOUT_MS) {
        console.error('  ✘ 超时，没有收到页面回传的结果。');
        settle({ crashed: true });
      } else if (chrome.exitCode !== null) {
        console.error(`  ✘ Chrome 提前退出，code=${chrome.exitCode}`);
        settle({ crashed: true });
      }
    }, 250);
  });
}

async function main() {
  console.log('══════════════ 静态检查 ══════════════');
  const perf = checkMobilePerfCss();
  if (perf.ok) {
    console.log(`  ✔ 手机端性能降级规则齐全（${perf.count} 个 620px 断点块：backdrop-filter / 装饰层 / 拖拽投影 / 碎片收缩）`);
  } else {
    console.log('  ✘ 手机端性能降级缺规则: ' + perf.missing.join('、'));
    process.exitCode = 1;
  }
  console.log('');

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/report') {
      res.writeHead(404).end();
      return;
    }

    // 用隐表单 POST 回传，所以主要从请求体里读
    const fromQuery = url.searchParams.get('d');
    if (fromQuery !== null) return handleReport(fromQuery, res);

    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 2e6) req.destroy(); // 防异常大的请求
    });
    req.on('end', () => handleReport(new URLSearchParams(body).get('d'), res));
  });

  function handleReport(raw, res) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<meta charset="utf-8"><p>ok</p>');

    if (!active) return; // 已经没有套件在等结果了，忽略迟到的上报

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('回传数据解析失败:', e.message, String(raw).slice(0, 200));
      active.settle({ crashed: true });
      return;
    }

    console.log(data.log);
    console.log('──────────────────────────────────────────────');
    console.log(`  → ${data.passed} 通过 / ${data.failed} 失败`);
    if (data.failed) console.log('  失败项：' + (data.failures || []).join('、'));

    active.settle({
      passed: data.passed,
      failed: data.failed,
      failures: data.failures || [],
    });
  }

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(HTTP_PORT, '127.0.0.1', resolve);
  });

  const results = [];
  for (const suite of SUITES) {
    console.log('\n══════════════ 浏览器端测试：' + suite.name + ' ══════════════');
    results.push({ suite, result: await runSuite(suite) });
  }

  server.close();

  // ---- 汇总 ----
  const totalPassed = results.reduce((n, r) => n + (r.result.passed || 0), 0);
  const totalFailed = results.reduce((n, r) => n + (r.result.failed || 0), 0);
  const broken = results.filter((r) => r.result.crashed).map((r) => r.suite.name);

  console.log('\n══════════════ 汇总 ══════════════');
  results.forEach(({ suite, result }) => {
    const mark = result.crashed ? '✘ 未收到结果' : (result.failed ? '✘' : '✔');
    console.log(`  ${mark} ${suite.name}：${result.passed || 0} 通过 / ${result.failed || 0} 失败`);
  });
  console.log(`  合计：${totalPassed} 通过 / ${totalFailed} 失败`);
  if (broken.length) console.log('  未收到结果的套件：' + broken.join('、'));

  process.exitCode = totalFailed || broken.length ? 1 : 0;
}

main().catch((err) => {
  console.error('测试驱动出错：', err);
  process.exitCode = 1;
});
