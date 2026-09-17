#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 截图工具 · 把某张地图渲染成 PNG
 * ---------------------------------------------------------------------
 * 路径：tools/shot.js
 * 用法：
 *   node tools/shot.js --map=zigong --out=docs/ui-zigong.png
 *   node tools/shot.js --map=chengdu --drag=1 --out=docs/ui-chengdu.png
 *   node tools/shot.js --map=china --w=1400 --h=900 --out=/tmp/china.png
 *
 * 为什么需要它（而不是直接对 index.html 截图）：
 *   Chrome 在 load 事件后立刻截图，而地图是"按需注入脚本"加载的，
 *   那一刻还没开始注入 —— 直接拍只能拍到开场动画。
 *   所以这里起一个小服务：静态文件照常返回，只有 /__hold__ 故意拖 ms 毫秒，
 *   由 tools/shot.html 在"页面已经跑到想要的样子"之后才请求它，
 *   借此把载体的 load 事件钉住，Chrome 就只能等到那一刻再拍。
 *
 * 依赖系统 Chrome（路径与 tools/e2e-test.js 保持一致）。
 * ===================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8891;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** 1×1 透明 PNG：占用极小，只用来"占住"一次请求 */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function parseArgs(argv) {
  const out = {};
  argv.forEach((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  });
  return out;
}

function serve() {
  /** 被"钉住"的 hold 响应：等载体喊 release 才放行 */
  const held = [];
  const release = () => {
    while (held.length) {
      const r = held.shift();
      clearTimeout(r.timer);
      if (!r.res.writableEnded) {
        r.res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
        r.res.end(TINY_PNG);
      }
    }
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    // 日志通道：headless 里没有控制台，让载体页把日志回传到这里打印。
    // 调试截图流程时比"把日志画进图里"好用得多。
    if (url.pathname === '/__log__') {
      console.log('  [载体] ' + (url.searchParams.get('d') || ''));
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      res.end(TINY_PNG);
      return;
    }

    // 载体喊"我准备好了"：放行所有被钉住的响应 → load 事件这才触发 → Chrome 拍照
    if (url.pathname === '/__release__') {
      release();
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      res.end(TINY_PNG);
      return;
    }

    /* 拖住 load 事件。
     *   /__hold__            一直不放，直到收到 /__release__（截图正路）
     *   /__hold__?ms=1200    定时放行（备用的兜底）
     * 兜底 25 秒：万一载体脚本挂了，也不至于永远拍不到。 */
    if (url.pathname === '/__hold__') {
      const ms = url.searchParams.has('ms') ? Number(url.searchParams.get('ms')) : 0;
      const entry = { res, timer: null };
      entry.timer = setTimeout(() => {
        const i = held.indexOf(entry);
        if (i >= 0) held.splice(i, 1);
        if (!res.writableEnded) {
          res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
          res.end(TINY_PNG);
        }
      }, ms > 0 ? Math.min(15000, ms) : 25000);
      held.push(entry);
      req.on('close', () => {
        clearTimeout(entry.timer);
        const i = held.indexOf(entry);
        if (i >= 0) held.splice(i, 1);
      });
      return;
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/tools/shot.html';
    const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mapId = args.map || 'chengdu';
  const out = path.resolve(args.out || path.join(ROOT, 'docs', 'ui-' + mapId + '.png'));
  // --vw/--vh：模拟手机宽度（把应用装进这个尺寸的 iframe 再拍）
  const vw = Number(args.vw) || 0;
  const vh = Number(args.vh) || 0;
  // 窗口要留出边距，免得 iframe 贴着窗口被裁
  const w = Number(args.w) || (vw ? vw + 24 : 1600);
  const h = Number(args.h) || (vh ? vh + 24 : 1000);
  const drag = args.drag === '1' || args.drag === true;
  const debug = args.debug === '1' || args.debug === true;

  if (!fs.existsSync(CHROME)) {
    console.error('✘ 找不到 Chrome：' + CHROME + '（可以改 tools/shot.js 里的 CHROME 常量）');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  try { fs.unlinkSync(out); } catch (e) { /* 本来就不存在 */ }

  const server = await serve();
  /* --page=<相对路径> 截任意页面（不只是地图）。
   * 用途：分享卡片的绘制只能靠肉眼验证，用它截 tools/share-preview.html。 */
  const url = args.page
    ? `http://127.0.0.1:${PORT}/` + String(args.page).replace(/^\//, '')
    : `http://127.0.0.1:${PORT}/tools/shot.html?map=${encodeURIComponent(mapId)}` +
      (drag ? '&drag=1' : '') + (debug ? '&debug=1' : '') +
      (vw && vh ? '&vw=' + vw + '&vh=' + vh : '') +
      (args.level ? '&level=' + args.level : '') +
      (args.fit ? '&fit=' + args.fit : '');
  const userDataDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'shot-'));

  console.log('地址：' + url);
  console.log('截图：' + mapId + (drag ? '（并拼一块进去）' : '') + '  ' + w + '×' + h);

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',            // 这台机器上 sandbox 起不来，见 SOP 坑 #2
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--user-data-dir=' + userDataDir,
    `--window-size=${w},${h}`,
    '--screenshot=' + out,
    url,
  ], { stdio: 'ignore' });

  // 等截图文件出现（最多 40 秒），然后收工
  const deadline = Date.now() + 40000;
  let ok = false;
  while (Date.now() < deadline) {
    if (fs.existsSync(out) && fs.statSync(out).size > 0) { ok = true; break; }
    if (chrome.exitCode !== null && !fs.existsSync(out)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  try { chrome.kill('SIGKILL'); } catch (e) { /* 可能已经退了 */ }
  server.close();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }

  if (!ok) {
    console.error('✘ 没等到截图。可能是 Chrome 起不来，或页面没跑到就绪（可以打开 ' + url + ' 看看）');
    process.exit(1);
  }
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log('✔ ' + path.relative(process.cwd(), out) + '（' + kb + ' KB）');
}

main().catch((err) => {
  console.error('✘ ' + err.message);
  process.exit(1);
});
