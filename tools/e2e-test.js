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
/* 单套超时。默认 90 秒；冒烟套件会逐张打开登记册里的每张地图（现在 23 张），
 * 所以给它更长的时间 —— 否则地图一多就会"因为慢而假失败"。
 * 超时是给"卡死"兜底的，不该变成"地图多了就红"的紧箍咒。 */
const DEFAULT_TIMEOUT_MS = 90000;

/**
 * 要跑的测试套件（顺序执行，每套各起一个 Chrome）。
 * 三套各管一段：
 *   selftest.html     城市回归 · 成都真实数据 + 全部 UI/动画细节
 *   engine-test.html  引擎功能 · 只用虚构 tiny-city，证明引擎与具体地图无关
 *   map-smoke.html    多地图冒烟 · 登记册里【每一张】地图都真能玩（生成物验收）
 * 另外还会跑两项**不需要浏览器**的离线检查：
 *   ① 手机端性能降级 CSS 是否齐全
 *   ② WKT → GeoJSON 转换（天地图数据源那层，见 tools/test-wkt.js）
 */
const SUITES = [
  { name: '城市回归 · 成都（真实数据 + UI/动画）', page: 'selftest.html' },
  { name: '引擎功能 · 虚构 tiny-city（通用逻辑）', page: 'engine-test.html' },
  /* 冒烟套件默认**分批跑**（见 SMOKE_BATCH），每批一个独立的 Chrome。
   *
   * 【为什么必须分批】363 张地图在同一个 Chrome 里连开 363 个 iframe 之后，
   * 实测会从 1.5 s/张 退化到 5 s/张以上，最后撞上超时 ——
   * 而超时是给"卡死"兜底的，不该变成"地图多了就红"。
   * 分批顺带解决两件事：① 每批有独立进度输出，不再等 10 分钟才知道跑到哪；
   * ② 真的卡死时只丢一批的结果，不是全丢。
   * 超时按"批"算，一批 60 张 ≈ 90 s，给 5 分钟余量足够。 */
  { name: '多地图冒烟 · 登记册里的每一张地图', page: 'map-smoke.html', timeoutMs: 300000,
    batchable: true },
];

/* ---------- 命令行开关（诊断用）----------
 * 地图接满全国后，冒烟套件要跑 400+ 张地图、耗时 8 分钟以上。
 * 排查某几张地图时不该被迫跑全量，所以给两个开关：
 *   --only-maps=beijing,dongcheng   只跑这几张地图（透传给 map-smoke.html 的 ?maps=）
 *   --only-suite=smoke              只跑冒烟套件（跳过成都回归/引擎套件）
 *   --only-suite=offline            只跑离线检查（不启浏览器，秒级）
 *   --smoke-batch=60                冒烟每批多少张地图（默认 60；给 0 以外的小值方便调试）
 *   --verbose                       把通过的日志也全打出来（默认只打失败套件的日志）
 * 排查单张地图时用 --only-maps，别每次都跑全量（全量约 9 分钟）。 */
const argv = process.argv.slice(2);
const argOf = (k) => {
  const hit = argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.split('=').slice(1).join('=') : null;
};
const ONLY_MAPS = argOf('only-maps');
const ONLY_SUITE = argOf('only-suite');
/* 冒烟分批大小：太大 → 单批太久、退化和"卡死全丢"的老问题回来；
 * 太小 → 反复起 Chrome 的开销（约 1 s/次）占比升高。60 张 ≈ 90 s，是实测的平衡点。 */
const SMOKE_BATCH = Math.max(1, Number(argOf('smoke-batch')) || 60);
/* 默认只打印失败套件的详细日志。全量冒烟有 1.3 万条"✔"，
 * 全打出来既刷屏又让 --tail 之后什么都看不见（这是踩过的坑）。 */
const VERBOSE = argv.includes('--verbose');

/** 当前正在跑的套件；页面回传结果时用它把 Promise 收尾 */
let active = null;

/**
 * 离线跑 tools/test-wkt.js，把它的结果并进总汇总。
 * 用子进程而不是 require：那个文件本身是"带输出的测试脚本"，
 * 独立跑、独立改，不必为了被 require 而变形。
 */
function runOfflineTest(script) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = /→ (\d+) 通过 \/ (\d+) 失败/.exec(out);
  if (!m) {
    return { passed: 0, failed: 1, failures: [script + ' 没有输出结果'], raw: out };
  }
  const fm = /失败项：(.+)/.exec(out);
  return {
    passed: Number(m[1]),
    failed: Number(m[2]),
    failures: fm ? fm[1].split('、') : [],
    raw: out,
  };
}

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
function runSuite(suite, mapsArg) {
  const timeoutMs = suite.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maps = mapsArg !== undefined ? mapsArg : (suite.page === 'map-smoke.html' ? ONLY_MAPS : null);
  return new Promise((resolve) => {
    const url = 'file://' + path.resolve(__dirname, suite.page) + '?port=' + HTTP_PORT
      + (maps ? '&maps=' + encodeURIComponent(maps) : '');
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
      if (Date.now() - started > timeoutMs) {
        console.error('  ✘ 超时（' + Math.round(timeoutMs / 1000) + 's），没有收到页面回传的结果。');
        settle({ crashed: true });
      } else if (chrome.exitCode !== null) {
        console.error(`  ✘ Chrome 提前退出，code=${chrome.exitCode}`);
        settle({ crashed: true });
      }
    }, 250);
  });
}

/**
 * 分批跑一个"遍历全部地图"的套件：每批一个独立 Chrome + 独立超时。
 *
 * 【为什么不是简单地把 timeout 调大】调大只能让"全跑完"这件事晚点失败，
 * 但解决不了三件事：
 *   1. 单浏览器跑完全程会退化（实测 1.5 s/张 → 5 s/张），时间随张数超线性增长
 *   2. 卡在其中一张时，前面几千条断言的结果**全丢**（页面只在最后回传一次）
 *   3. 跑 10 分钟没有任何输出，看起来就像"卡住了"
 *
 * @param {object} suite SUITES 里的一项（需要 batchable:true）
 * @returns {Promise<{passed:number, failed:number, failures:string[], crashed?:boolean}>}
 */
async function runBatchedSuite(suite) {
  const all = loadMapIds();
  const batches = [];
  for (let i = 0; i < all.length; i += SMOKE_BATCH) {
    batches.push(all.slice(i, i + SMOKE_BATCH));
  }
  console.log(`  分成 ${batches.length} 批，每批最多 ${SMOKE_BATCH} 张（每批一个独立 Chrome）`);

  const sum = { passed: 0, failed: 0, failures: [], crashed: false };
  for (let i = 0; i < batches.length; i++) {
    const ids = batches[i];
    if (batches.length > 1) {
      console.log(`\n  ── 第 ${i + 1}/${batches.length} 批（${ids.length} 张：` +
        `${ids[0]} … ${ids[ids.length - 1]}）──`);
    }
    const t = Date.now();
    const r = await runSuite(suite, ids.join(','));
    sum.passed += r.passed || 0;
    sum.failed += r.failed || 0;
    if (r.failures && r.failures.length) sum.failures = sum.failures.concat(r.failures);
    if (r.crashed) {
      sum.crashed = true;
      /* 一批崩了不能直接放弃剩下的：可能是这张地图的问题，
       * 也可能只是浏览器偶发。继续跑，最后一起报。 */
      console.error(`  ✘ 这一批没有回传结果（${ids.length} 张），继续跑后面的批次`);
      sum.failures.push('批 ' + (i + 1) + ' 未回传结果：' + ids.join(','));
    }
    console.log(`  第 ${i + 1} 批完成（${((Date.now() - t) / 1000).toFixed(1)}s）：` +
      `${r.passed || 0} 通过 / ${r.failed || 0} 失败`);
  }
  return sum;
}

/** 从 registry 读全部地图 id（顺序固定，分批才可复现） */
function loadMapIds() {
  if (ONLY_MAPS) return ONLY_MAPS.split(',').map((s) => s.trim()).filter(Boolean);
  const vm = require('vm');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'maps', 'registry.js'), 'utf8');
  const sandbox = {};
  vm.runInNewContext(src, { window: sandbox });
  const maps = (sandbox.MAP_REGISTRY && sandbox.MAP_REGISTRY.maps) || {};
  return Object.keys(maps).sort();
}

async function main() {
  console.log('══════════════ 离线检查（不需要浏览器） ══════════════');
  const perf = checkMobilePerfCss();
  if (perf.ok) {
    console.log(`  ✔ 手机端性能降级规则齐全（${perf.count} 个 620px 断点块：backdrop-filter / 装饰层 / 拖拽投影 / 碎片收缩）`);
  } else {
    console.log('  ✘ 手机端性能降级缺规则: ' + perf.missing.join('、'));
    process.exitCode = 1;
  }

  /* WKT → GeoJSON 转换：天地图返回的是 WKT，这一段是纯计算，可以在 Node 里测透。
   * 天地图要 Key 才能联网调，"能测的部分先测死"，等 Key 到手就只剩网络这一件事要查。 */
  const wktResult = runOfflineTest('test-wkt.js');
  const mapsResult = runOfflineTest('test-maps.js');
  /* 子代理产出校验器的自测：这个校验器是"防止编造内容进项目"的守门人，
   * 守门人自己坏掉必须能被发现，所以把它钉进离线套件。 */
  const verifyResult = runOfflineTest('test-facts-verify.js');
  /* 面积抽取器的自测：它是资料卡里最容易抓错的字段，前后出过四次问题，
   * 把真实踩过的句子钉成回归用例。 */
  const areaPickResult = runOfflineTest('test-area-pick.js');
  /* 跨地图进度与成就的自测：它是"玩家的账本"，算错了不会崩、
   * 只会安静地给出错误数字（比崩溃更难发现），所以必须钉住。 */
  const progressResult = runOfflineTest('test-progress.js');
  /* 分享图的**文案逻辑**自测：绘制只能在浏览器里看，
   * 但"卡片上写什么"是纯函数，可以在 Node 里测透（写错了用户一眼就看出来）。 */
  const shareResult = runOfflineTest('test-share.js');
  /* 计分规则自测：它是"游戏平衡"的落点，改一个常量就会改变玩家行为，
   * 抽成纯函数后可以被断言钉住（并且它已经抓出过一个真实平衡问题）。 */
  const scoreResult = runOfflineTest('test-score.js');
  /* 众包纠错的自测：它唯一的产出是"给用户看的文本和链接"，
   * 错了不会崩，只会静默地把人送到 404 的 Issue 页面（所以必须钉住）。 */
  const contributeResult = runOfflineTest('test-contribute.js');
  /* 单文件离线打包的自测：打包器坏了不会报错，只会产出一个
   * "能打开、切地图就崩"的 HTML —— 而那份文件是要发给别人的。 */
  const bundleResult = runOfflineTest('test-bundle.js');
  /* 中国图专项：它是唯一"下级全是省级"的图，也是唯一关卡按地理分区手工编排的图。
   * 它的两类问题都不会报错、只会静默出错：文案漏项（卡片空白）与
   * registry 悬空 children（面包屑点过去 404）。 */
  const chinaProvResult = runOfflineTest('test-china-provinces.js');
  console.log('  ' + (wktResult.failed ? '✘' : '✔') +
    ' WKT → GeoJSON 转换（' + wktResult.passed + ' 通过 / ' + wktResult.failed + ' 失败）' +
    (wktResult.failed ? '：' + wktResult.failures.join('、') : ''));
  if (wktResult.failed) process.exitCode = 1;

  console.log('  ' + (mapsResult.failed ? '✘' : '✔') +
    ' 地图包自洽（adcode/关卡/资料/来源）：' + mapsResult.passed + ' 通过 / ' + mapsResult.failed + ' 失败' +
    (mapsResult.failed ? '：' + mapsResult.failures.join('、') : ''));
  if (mapsResult.failed) process.exitCode = 1;

  console.log('  ' + (verifyResult.failed ? '✘' : '✔') +
    ' 子代理产出校验器（防编造守门人自测）：' + verifyResult.passed + ' 通过 / ' + verifyResult.failed + ' 失败' +
    (verifyResult.failed ? '：' + verifyResult.failures.join('、') : ''));
  if (verifyResult.failed) process.exitCode = 1;

  console.log('  ' + (areaPickResult.failed ? '✘' : '✔') +
    ' 面积抽取器（真实踩过的错句回归）：' + areaPickResult.passed + ' 通过 / ' + areaPickResult.failed + ' 失败' +
    (areaPickResult.failed ? '：' + areaPickResult.failures.join('、') : ''));
  if (areaPickResult.failed) process.exitCode = 1;

  console.log('  ' + (progressResult.failed ? '✘' : '✔') +
    ' 进度与成就账本：' + progressResult.passed + ' 通过 / ' + progressResult.failed + ' 失败' +
    (progressResult.failed ? '：' + progressResult.failures.join('、') : ''));
  if (progressResult.failed) process.exitCode = 1;

  console.log('  ' + (shareResult.failed ? '✘' : '✔') +
    ' 分享图文案：' + shareResult.passed + ' 通过 / ' + shareResult.failed + ' 失败' +
    (shareResult.failed ? '：' + shareResult.failures.join('、') : ''));
  if (shareResult.failed) process.exitCode = 1;

  console.log('  ' + (scoreResult.failed ? '✘' : '✔') +
    ' 计分规则（平衡）：' + scoreResult.passed + ' 通过 / ' + scoreResult.failed + ' 失败' +
    (scoreResult.failed ? '：' + scoreResult.failures.join('、') : ''));
  if (scoreResult.failed) process.exitCode = 1;
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

    /* 日志只在"有失败"或显式 --verbose 时打印：
     * 全量冒烟 1.3 万条 ✔ 会把真正要看的东西挤出 tail 的窗口。 */
    if (data.failed || VERBOSE) {
      console.log(data.log);
      console.log('──────────────────────────────────────────────');
    }
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
    // --only-suite 过滤：smoke=只跑冒烟，selftest/engine 按名字选
    if (ONLY_SUITE && ONLY_SUITE !== 'all') {
      const want = ONLY_SUITE === 'smoke' ? 'map-smoke.html'
        : ONLY_SUITE === 'selftest' ? 'selftest.html'
        : ONLY_SUITE === 'engine' ? 'engine-test.html' : null;
      if (want && suite.page !== want) continue;
      if (!want) continue;   // offline 等未知值 → 不跑任何浏览器套件
    }
    console.log('\n══════════════ 浏览器端测试：' + suite.name + ' ══════════════');
    const t0 = Date.now();
    const result = suite.batchable
      ? await runBatchedSuite(suite)
      : await runSuite(suite);
    result.elapsedMs = Date.now() - t0;
    results.push({ suite, result });
  }

  server.close();

  // ---- 汇总 ----
  const totalPassed = results.reduce((n, r) => n + (r.result.passed || 0), 0) +
    wktResult.passed + mapsResult.passed + verifyResult.passed + areaPickResult.passed + progressResult.passed + shareResult.passed + scoreResult.passed + contributeResult.passed + bundleResult.passed + chinaProvResult.passed;
  const totalFailed = results.reduce((n, r) => n + (r.result.failed || 0), 0) +
    wktResult.failed + mapsResult.failed + verifyResult.failed + areaPickResult.failed + progressResult.failed + shareResult.failed + scoreResult.failed + contributeResult.failed + bundleResult.failed + chinaProvResult.failed;
  const broken = results.filter((r) => r.result.crashed).map((r) => r.suite.name);

  console.log('\n══════════════ 汇总 ══════════════');
  console.log(`  ${wktResult.failed ? '✘' : '✔'} 离线检查 · WKT → GeoJSON：${wktResult.passed} 通过 / ${wktResult.failed} 失败`);
  console.log(`  ${mapsResult.failed ? '✘' : '✔'} 离线检查 · 地图包自洽：${mapsResult.passed} 通过 / ${mapsResult.failed} 失败`);
  console.log(`  ${verifyResult.failed ? '✘' : '✔'} 离线检查 · 子代理产出校验器：${verifyResult.passed} 通过 / ${verifyResult.failed} 失败`);
  console.log(`  ${areaPickResult.failed ? '✘' : '✔'} 离线检查 · 面积抽取器回归：${areaPickResult.passed} 通过 / ${areaPickResult.failed} 失败`);
  console.log(`  ${progressResult.failed ? '✘' : '✔'} 离线检查 · 进度与成就账本：${progressResult.passed} 通过 / ${progressResult.failed} 失败`);
  console.log(`  ${shareResult.failed ? '✘' : '✔'} 离线检查 · 分享图文案：${shareResult.passed} 通过 / ${shareResult.failed} 失败`);
  console.log(`  ${scoreResult.failed ? '✘' : '✔'} 离线检查 · 计分规则（平衡）：${scoreResult.passed} 通过 / ${scoreResult.failed} 失败`);
  console.log(`  ${contributeResult.failed ? '✘' : '✔'} 离线检查 · 众包纠错文案与链接：${contributeResult.passed} 通过 / ${contributeResult.failed} 失败`);
  console.log(`  ${bundleResult.failed ? '✘' : '✔'} 离线检查 · 单文件离线打包：${bundleResult.passed} 通过 / ${bundleResult.failed} 失败`);
  console.log(`  ${chinaProvResult.failed ? '✘' : '✔'} 离线检查 · 中国图省级条目与链接：${chinaProvResult.passed} 通过 / ${chinaProvResult.failed} 失败`);
  results.forEach(({ suite, result }) => {
    const mark = result.crashed ? '✘ 未收到结果' : (result.failed ? '✘' : '✔');
    const secs = result.elapsedMs ? `（${(result.elapsedMs / 1000).toFixed(1)}s）` : '';
    console.log(`  ${mark} ${suite.name}${secs}：${result.passed || 0} 通过 / ${result.failed || 0} 失败`);
  });
  console.log(`  合计：${totalPassed} 通过 / ${totalFailed} 失败`);
  if (broken.length) console.log('  未收到结果的套件：' + broken.join('、'));

  process.exitCode = totalFailed || broken.length ? 1 : 0;
}

main().catch((err) => {
  console.error('测试驱动出错：', err);
  process.exitCode = 1;
});
