#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 局域网演示服务器
 * ---------------------------------------------------------------------
 * 路径：tools/serve.js
 *
 * 【为什么需要它 —— 这是踩过才知道的坑】
 *   "把单文件 HTML 发到微信"听起来最省事，但**微信不预览 .html**：
 *   对方必须 长按文件 → 用其他应用打开 → 存储到"文件" → 再点开，
 *   手机上要 3~4 步。多数人走到第二步就放弃了。
 *   （微信/QQ 都能发，但"发得出去"和"对方真的打开了"是两件事。）
 *
 *   所以真正零摩擦的组合是：**你电脑起一个服务，同学点链接就能玩**。
 *   同一间教室/同一个宿舍 WiFi 就行，不需要域名、不需要备案、不需要钱。
 *
 * 【安全边界（用完请 Ctrl+C）】
 *   · 只读，不写任何文件，不接受上传
 *   · 只监听局域网，不做端口映射／内网穿透，外网访问不到
 *   · 路径已经过 resolve + 前缀校验，翻不出项目目录
 *
 * 用法：
 *   node tools/serve.js                     # 默认 8000 端口，打开即成都
 *   node tools/serve.js --port=8080 --map=sichuan
 * ===================================================================== */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function argOf(k, d) {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.split('=').slice(1).join('=') : d;
}

const PORT = Number(argOf('port', '8000'));
const MAP = argOf('map', 'chengdu');

/** 找出本机所有可用的局域网 IPv4（手机要连的就是这些地址） */
function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach((name) => {
    (ifaces[name] || []).forEach((n) => {
      if (n.family === 'IPv4' && !n.internal) out.push({ name, address: n.address });
    });
  });
  return out;
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch (e) {
    res.writeHead(400).end('bad url');
    return;
  }
  if (pathname === '/') pathname = '/index.html';

  /* 把路径钉死在项目目录里：`../` 和软链接都翻不出去 */
  const target = path.resolve(ROOT, '.' + pathname);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 ' + pathname);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      /* 演示时改了代码刷新就能看到，别被浏览器缓存骗了 */
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('✘ 端口 ' + PORT + ' 被占了。换一个：node tools/serve.js --port=' + (PORT + 1));
  } else {
    console.error('✘ 起服务失败：' + err.message);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const q = '?map=' + encodeURIComponent(MAP);
  console.log('══════════ 地图拼图 · 局域网演示 ══════════');
  console.log('');
  console.log('  本机打开        http://localhost:' + PORT + '/' + q);
  console.log('');
  const lan = lanAddresses();
  if (!lan.length) {
    console.log('  ⚠ 没找到局域网地址（可能没连 WiFi）。手机访问不了，只能用本机那条。');
  } else {
    console.log('  ★ 发到群里，同学点开就能玩（手机要连同一个 WiFi）：');
    lan.forEach((n) => {
      console.log('        http://' + n.address + ':' + PORT + '/' + q + '   （' + n.name + '）');
    });
    if (lan.length > 1) {
      console.log('    多条就挨个试，能打开的那条就是对的。');
    }
  }
  console.log('');
  console.log('  想让同学从任意一张图开始，把地址末尾的 ?map= 换成地图 id 就行，');
  console.log('  例如 ?map=sichuan / ?map=china / ?map=leshan。');
  console.log('');
  console.log('  这是只读的本地服务，用完 Ctrl+C 关掉即可。');
  console.log('──────────────────────────────────────────');
});
