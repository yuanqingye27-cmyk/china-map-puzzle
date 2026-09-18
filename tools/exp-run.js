/**
 * 一次性探针运行器 —— 把 tools/exp-*.html 丢进 headless Chrome，收结果打出来。
 *
 * 为什么单独写一个，不复用 e2e-test.js：
 *   e2e-test.js 的套件列表是写死的（selftest / engine-test / map-smoke / modes），
 *   探针页不属于任何一套。这里只做"起服务 + 起 Chrome + 收一次回传"，
 *   三分钟就能看懂，改坏了也不影响正式测试。
 *
 * Chrome 参数与 e2e-test.js 保持一致 —— 那套参数是踩过坑调出来的
 * （sandbox 会 SIGTRAP、iframe 要能读 file://），别自己另发明一套。
 *
 * 用法：
 *   node tools/exp-run.js --page=tiny-drag-test.html --map=china
 *   node tools/exp-run.js --page=exp-coord.html --map=china
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HTTP_PORT = 9452;
const TIMEOUT_MS = 120000;

const argv = process.argv.slice(2);
const argOf = (k, d) => {
  const hit = argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.split('=').slice(1).join('=') : d;
};

const PAGE = argOf('page', 'exp-coord.html');
const MAP = argOf('map', 'china');
const LEVEL = argOf('level', '1');
const TARGETS = argOf('targets', '820000,810000,710000');
/* 可选：另外指定一个被测宿主页做"空位尺寸体检"（见探针的场景 4） */
const TARGET = argOf('target', '');

const pageUrl = 'file://' + path.resolve(__dirname, PAGE)
  + '?port=' + HTTP_PORT + '&map=' + encodeURIComponent(MAP)
  + '&level=' + encodeURIComponent(LEVEL)
  + '&targets=' + encodeURIComponent(TARGETS)
  + (TARGET ? '&target=' + encodeURIComponent(TARGET) : '');

let settled = false;
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-puzzle-exp-'));
let chrome = null;

function finish(code) {
  if (settled) return;
  settled = true;
  try { if (chrome) chrome.kill('SIGKILL'); } catch (e) { /* 可能已经退了 */ }
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  process.exit(code);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/report')) {
    res.writeHead(404); res.end(); return;
  }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    let payload = null;
    try {
      payload = JSON.parse(new URLSearchParams(body).get('d') || '{}');
    } catch (e) {
      console.error('✘ 回传内容不是合法 JSON：' + e.message);
      finish(1);
      return;
    }
    process.stdout.write('\n' + (payload.log || '（没有日志）') + '\n');
    finish(0);
  });
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
  chrome = spawn(CHROME, [
    '--headless',
    '--no-sandbox',            // 这台机器 sandbox 起不来，会 SIGTRAP
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--allow-file-access-from-files',   // 载体页要读 iframe 里的被测页
    '--user-data-dir=' + userDataDir,
    '--window-size=1700,1200',
    /* 把被测页的 console 转出来：排查"静默失败"时这是唯一的现场 */
    '--enable-logging=stderr',
    '--v=0',
    pageUrl,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  /* 只挑被测页自己的 console 行，Chrome 的噪音丢掉 */
  chrome.stderr.on('data', (b) => {
    String(b).split('\n').forEach((ln) => {
      if (/DBG_|CONSOLE|Uncaught|SecurityError|TypeError/.test(ln)) {
        console.log('[chrome] ' + ln.trim());
      }
    });
  });

  setTimeout(() => {
    console.error('✘ 超时（' + Math.round(TIMEOUT_MS / 1000) + 's），没收到回传。');
    finish(1);
  }, TIMEOUT_MS);

  chrome.on('exit', (code) => {
    if (!settled) {
      console.error('✘ Chrome 提前退出，code=' + code);
      finish(1);
    }
  });
});

process.on('SIGINT', () => finish(130));
