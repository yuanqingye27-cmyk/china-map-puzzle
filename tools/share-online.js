#!/usr/bin/env node
'use strict';
/* =====================================================================
 * 一键把网站变成公网链接（手机 / 电脑 / 微信都能打开）
 * ---------------------------------------------------------------------
 * 路径：tools/share-online.js
 *
 * 【它做什么】
 *   起两件事，然后把公网地址打印出来：
 *     ① 本地静态服务（node tools/serve.js）
 *     ② 一条 SSH 反向隧道（localhost.run），把本地服务映射到一个 https 地址
 *   拿到链接就能发到微信/群里，对方点开就能玩 —— 不需要和你连同一个 WiFi。
 *
 * 【为什么用 SSH 隧道，而不是装一个隧道工具】
 *   · 不装任何东西（macOS 自带 ssh）
 *   · 不需要注册账号
 *   · 不用买服务器、不用备案
 *   · 免费版**不会**给访客插广告页/警告页（这一条实测过：
 *     另一个免费隧道 serveo 会给访客弹 "Serveo - Warning" 页面，已弃用）
 *
 * 【这个链接能活多久】
 *   只要**这个终端窗口开着、电脑不休眠**，链接就一直有效。
 *   Ctrl+C 之后链接立刻失效。要一个永久地址，得部署到静态托管
 *   （Cloudflare Pages / 腾讯云 Pages，都免费，但要用你自己的账号）。
 *
 * 【安全边界】
 *   和 tools/serve.js 一样：只读、不写文件、不接受上传。
 *   但请注意：这条隧道**是公网可达的** —— 任何拿到链接的人都能访问。
 *   测完请 Ctrl+C 关掉。
 *
 * 用法：
 *   node tools/share-online.js                     # 默认 8000 端口，起始成都
 *   node tools/share-online.js --map=sichuan       # 起始四川
 *   node tools/share-online.js --port=8080
 * ===================================================================== */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function argOf(k, d) {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.split('=').slice(1).join('=') : d;
}

const PORT = Number(argOf('port', '8000'));
const MAP = argOf('map', 'chengdu');

/** 隧道服务：换一个就改这里（都是 ssh -R 形式，不需要装东西） */
const TUNNEL = { host: 'nokey@localhost.run', label: 'localhost.run' };

const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach((c) => { try { c.kill('SIGTERM'); } catch (e) { /* 已退出 */ } });
  process.exit(code || 0);
}
process.on('SIGINT', () => { console.log('\n\n已关闭：本地服务和隧道都停了，链接已失效。'); shutdown(0); });
process.on('SIGTERM', () => shutdown(0));

/** 等本地服务真的起来（不是 sleep 猜时间） */
function waitLocal(remainMs) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 1500 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - t0 > remainMs) return reject(new Error('本地服务没起来'));
      setTimeout(tick, 300);
    };
    tick();
  });
}

async function main() {
  console.log('══════════ 地图拼图 · 生成公网链接 ══════════\n');

  /* ① 本地静态服务 */
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.js'), '--port=' + PORT, '--map=' + MAP], {
    stdio: ['ignore', 'ignore', 'pipe'],
    cwd: ROOT,
  });
  children.push(server);
  server.stderr.on('data', (b) => process.stderr.write(b));
  server.on('exit', (code) => {
    if (!shuttingDown) {
      console.error('✘ 本地服务退出了（code=' + code + '）。是不是端口被占？换个端口：--port=' + (PORT + 1));
      shutdown(1);
    }
  });

  try {
    await waitLocal(8000);
  } catch (e) {
    console.error('✘ ' + e.message + '。检查一下 ' + PORT + ' 端口是否被占用。');
    return shutdown(1);
  }
  console.log('  ✔ 本地服务已就绪：http://127.0.0.1:' + PORT + '/?map=' + MAP);

  /* ② SSH 反向隧道 */
  console.log('  … 正在申请公网地址（' + TUNNEL.label + '），几秒钟');
  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-R', '80:localhost:' + PORT,
    TUNNEL.host,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(ssh);

  let announced = false;
  const scan = (buf) => {
    const text = String(buf);
    /* 只认真正的隧道地址 `https://<随机串>.lhr.life`。
     * 【为什么限定域名】第一版用的是宽松的 /localhost\.run/，
     * 结果匹配到了欢迎横幅里的 `https://admin.localhost.run/` ——
     * 那是个管理后台，不是我们的隧道。用户拿到那个链接会一脸茫然。
     * 教训：从第三方输出里捞关键信息，"宽松匹配"约等于捞错。 */
    const m = /https:\/\/[a-z0-9-]+\.lhr\.life/i.exec(text);
    if (m && !announced) {
      announced = true;
      announce(m[0]);
    }
  };
  ssh.stdout.on('data', (b) => { process.stdout.write(b); scan(b); });
  ssh.stderr.on('data', (b) => { process.stderr.write(b); scan(b); });
  ssh.on('exit', (code) => {
    if (!shuttingDown) {
      console.error('\n✘ 隧道断了（code=' + code + '）。重跑一次本脚本就有新链接。');
      shutdown(1);
    }
  });

  /* 兜底：60 秒还没拿到地址就放弃，别让人干等 */
  setTimeout(() => {
    if (!announced && !shuttingDown) {
      console.error('\n✘ 60 秒还没拿到公网地址。可能是网络限制，换一个网络/热点再试。');
      shutdown(1);
    }
  }, 60000);
}

/** 拿到地址后的"人能直接抄走"的输出 */
function announce(url) {
  const link = url + '/?map=' + MAP;
  console.log('\n' + '═'.repeat(62));
  console.log('  ✅ 公网链接已生成（手机 / 电脑 / 微信都能直接打开）\n');
  console.log('     ' + link + '\n');
  console.log('  直接复制下面这段发到群里（链接已填好）：');
  console.log('  ' + '─'.repeat(58));
  console.log('  我在做一个中国地图拼图小游戏，想请你帮我试玩一下。');
  console.log('  点这个链接就能玩：');
  console.log('  ' + link);
  console.log('');
  console.log('  拼一关大概 2 分钟。');
  console.log('  玩完能回答我三个问题吗？');
  console.log('  ① 第一关有没有卡住？② 拼对后的介绍你会看吗？③ 玩完一关还想继续吗？');
  console.log('  谢谢！');
  console.log('  ' + '─'.repeat(58));
  console.log('\n  ⚠ 这个窗口要一直开着，链接才有效；关掉或电脑休眠就断了。');
  console.log('  ⚠ 想换起始地图：把链接末尾的 ?map=sichuan 改成 chengdu / china / leshan。');
  console.log('  Ctrl+C 结束（结束后链接立刻失效）。');
  console.log('═'.repeat(62) + '\n');
}

main();
