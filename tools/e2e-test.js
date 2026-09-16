/**
 * 端到端测试驱动。
 *
 * 思路：起一个本地 HTTP 服务，然后把 tools/selftest.html 丢进 headless Chrome。
 * selftest.html 会把真实的 index.html 装进 iframe、在里面模拟真人拖拽，
 * 跑完把结果用 <img src="http://127.0.0.1:PORT/report?..."> 回传（图片请求不受 CORS 限制）。
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

const SELFTEST_URL =
  'file://' + path.resolve(__dirname, 'selftest.html') + '?port=' + HTTP_PORT;

let finished = false;

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

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('回传数据解析失败:', e.message, String(raw).slice(0, 200));
      finished = true;
      process.exitCode = 1;
      return;
    }

    console.log('\n══════════════ 浏览器端测试结果 ══════════════');
    console.log(data.log);
    console.log('──────────────────────────────────────────────');
    console.log(`合计：${data.passed} 通过 / ${data.failed} 失败`);
    if (data.failed) console.log('失败项：' + (data.failures || []).join('、'));
    process.exitCode = data.failed ? 1 : 0;
    finished = true;
  }

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(HTTP_PORT, '127.0.0.1', resolve);
  });

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chengdu-e2e-'));
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
      '--allow-file-access-from-files', // 让 selftest.html 能操作 iframe 里的 index.html
      '--user-data-dir=' + userDataDir,
      '--window-size=1700,1200',
      SELFTEST_URL,
    ],
    { stdio: 'ignore' }
  );

  const started = Date.now();
  while (!finished && Date.now() - started < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 250));
    if (chrome.exitCode !== null && !finished) {
      console.error(`Chrome 提前退出，code=${chrome.exitCode}`);
      break;
    }
  }

  if (!finished) {
    console.error('\n测试超时，没有收到页面回传的结果。');
    process.exitCode = 1;
  }

  try { chrome.kill('SIGKILL'); } catch (e) {}
  server.close();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
}

main().catch((err) => {
  console.error('测试驱动出错：', err);
  process.exitCode = 1;
});
