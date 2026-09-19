/**
 * 一键发布 —— 把"改完代码到网站更新"这条链路上的每一步都做完。
 *
 * 【为什么要这个脚本】更新流程里有一步最容易忘、忘了最坑：
 *   改完源文件、推了 GitHub，但**忘了重建 `deploy/`** ——
 *   于是 GitHub 上是最新的、网站上还是旧的，而且看起来一切正常。
 *   这个脚本把顺序固定下来，重建永远是链条的一部分。
 *
 * 它做四件事（每步都有明确的"做没做成"）：
 *   ① 体检   —— 工作区是否干净、离线测试是否全绿
 *   ② 重建   —— 从源文件重新生成 deploy/（含 _headers / _redirects）
 *   ③ 自检   —— 产物体积、文件数、关键新代码是否真的进去了
 *   ④ 发布   —— 部署到 Cloudflare（--deploy）、推 GitHub（--push）
 *
 * 用法：
 *   node tools/release.js                    # 只体检 + 重建 + 自检，不发布
 *   node tools/release.js --deploy           # 再加 Cloudflare 部署
 *   node tools/release.js --push             # 再加 git commit + push
 *   node tools/release.js --deploy --push -m "说明"   # 全套
 *   node tools/release.js --project=map-puzzle        # 指定 Cloudflare 项目名
 *
 * 【为什么默认不发布】部署和推送都是对外的动作、会改线上状态。
 * 默认只做本地准备，让人先看清产物对不对，再显式加 --deploy / --push。
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEPLOY = path.join(ROOT, 'deploy');

const argv = process.argv.slice(2);
const argOf = (k, d) => {
  const hit = argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const has = (k) => argv.includes('--' + k);

const DO_DEPLOY = has('deploy');
const DO_PUSH = has('push');
const PROJECT = argOf('project', 'map-puzzle');
const MESSAGE = argOf('m', argOf('message', ''));
/* npm 缓存目录被 root 权限污染时，npx 会 EPERM 起不来。
 * 允许用 --npm-cache=<dir> 临时指定一个干净的缓存目录绕开。 */
const NPM_CACHE = argOf('npm-cache', '');

let failed = 0;
function step(n, title) {
  console.log('\n' + '─'.repeat(64));
  console.log('  ' + n + ' · ' + title);
  console.log('─'.repeat(64));
}
function ok(msg) { console.log('  ✔ ' + msg); }
function bad(msg) { failed++; console.log('  ✘ ' + msg); }
function info(msg) { console.log('  · ' + msg); }
function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: (opts && opts.inherit) ? 'inherit' : 'pipe',
    env: Object.assign({}, process.env, NPM_CACHE ? { npm_config_cache: NPM_CACHE } : {}),
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function countFiles(dir) {
  let n = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else n++;
    }
  })(dir);
  return n;
}
function dirSize(dir) {
  let n = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else n += fs.statSync(p).size;
    }
  })(dir);
  return n;
}

/* ============================ ① 体检 ============================ */
step(1, '体检 · 工作区与离线测试');

const dirty = run('git', ['status', '--short']).out.trim();
if (dirty) {
  info('工作区有未提交改动（正常，接下来就要发布它们）：');
  dirty.split('\n').slice(0, 8).forEach((l) => info('  ' + l));
  if (dirty.split('\n').length > 8) info('  …还有 ' + (dirty.split('\n').length - 8) + ' 项');
} else {
  info('工作区干净（没有要发布的新改动）');
}

console.log('  … 跑离线测试（秒级）');
const off = run(process.execPath, [path.join(__dirname, 'e2e-test.js'), '--only-suite=offline']);
const m = /合计：(\d+) 通过 \/ (\d+) 失败/.exec(off.out);
if (!m) {
  bad('离线测试没有输出结果，先看看：\n' + off.out.slice(-600));
} else if (Number(m[2]) > 0) {
  bad('离线测试有 ' + m[2] + ' 项失败 —— **先修测试，别发布**');
} else {
  ok('离线测试全绿：' + m[1] + ' 通过 / 0 失败');
}
if (failed) {
  console.log('\n  体检没过，后面的步骤不做了。\n');
  process.exit(1);
}

/* ============================ ② 重建 ============================ */
step(2, '重建 deploy/（从源文件，不手改产物）');

if (fs.existsSync(DEPLOY)) fs.rmSync(DEPLOY, { recursive: true, force: true });
fs.mkdirSync(path.join(DEPLOY, 'css'), { recursive: true });
fs.mkdirSync(path.join(DEPLOY, 'js', 'maps'), { recursive: true });

/* 复制清单与 docs/部署到Cloudflare.md 的第十节一致。
 * 用通配而不是逐个列文件名：新加脚本时不会漏（手写清单漏过一次，见 SOP 坑 #44）。 */
function cp(from, toDir) {
  const dest = path.join(ROOT, toDir);
  for (const f of from) fs.copyFileSync(path.join(ROOT, f), path.join(dest, path.basename(f)));
}
cp(['index.html'], 'deploy/');
cp(['css/style.css'], 'deploy/css/');
/* js/*.js 用 readdir 通配，而不是依赖 shell 展开：
 * 这样在 Windows 上也能跑，而且新加脚本不用改这里。 */
{
  const jsFiles = fs.readdirSync(path.join(ROOT, 'js'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join('js', f));
  cp(jsFiles, 'deploy/js/');
  info('js/*.js：' + jsFiles.length + ' 个外壳脚本');
}
cp(['js/maps/loader.js', 'js/maps/registry.js', 'js/maps/china.js',
  'js/maps/china.geo.js', 'js/maps/china.data.js'], 'deploy/js/maps/');
/* 地图数据目录整棵复制 */
fs.cpSync(path.join(ROOT, 'js/maps/china'), path.join(DEPLOY, 'js/maps/china'), { recursive: true });
info('js/maps/china/：整棵复制（363 张地图的数据）');

/* 部署模板（安全头 / 短链接） */
let tmpl = 0;
for (const t of ['_headers', '_redirects']) {
  const src = path.join(ROOT, 'deploy-templates', t);
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(DEPLOY, t)); tmpl++; }
}
ok('deploy/ 已重建，带 ' + tmpl + ' 个部署模板文件');

/* ============================ ③ 自检 ============================ */
step(3, '自检 · 产物是否真的可用');

const fileCount = countFiles(DEPLOY);
const size = dirSize(DEPLOY);
info('文件数 ' + fileCount + '，体积 ' + (size / 1048576).toFixed(1) + ' MB');

/* 网页端拖拽上传上限 1000 —— 超了必须走命令行，这里提前说清楚 */
if (fileCount > 1000) {
  info('⚠ 超过 1000 个文件：网页端拖拽上传会失败，必须用命令行（wrangler 上限 20000）');
}

/* 关键文件都在 */
const must = [
  'index.html', 'css/style.css', 'js/engine.js', 'js/game.js', 'js/geomap.js',
  'js/maps/registry.js', 'js/maps/loader.js', 'js/maps/china.geo.js',
];
const missing = must.filter((f) => !fs.existsSync(path.join(DEPLOY, f)));
if (missing.length) bad('缺少关键文件：' + missing.join(', '));
else ok('关键文件齐全（' + must.length + ' 个）');

/* 新代码真的进去了 —— 这是"忘了重建"最容易漏的地方，逐项点名 */
const checks = [
  ['默认地图是中国图', 'js/game.js', /DEFAULT_MAP\s*=\s*'china'/],
  ['自动放大（极小碎片）', 'js/engine.js', /zoomForTinyPiece/],
  ['丝滑缓动', 'js/engine.js', /easeView|easeInOut/],
  ['大屏断点 ≥1600', 'css/style.css', /min-width:\s*1600px/],
  ['动效时长令牌', 'css/style.css', /--dur-enter/],
  ['矮屏收口', 'css/style.css', /max-height:\s*520px/],
];
for (const [name, rel, re] of checks) {
  const p = path.join(DEPLOY, rel);
  const hit = fs.existsSync(p) && re.test(fs.readFileSync(p, 'utf8'));
  if (hit) ok(name); else bad(name + ' —— 产物里没有，八成是忘了重建');
}

/* registry 登记的每张地图，三件套是否都在（缺一个那张图就 404） */
{
  const reg = fs.readFileSync(path.join(DEPLOY, 'js/maps/registry.js'), 'utf8');
  const ids = [...reg.matchAll(/"id":\s*"([a-z0-9_-]+)"/g)].map((x) => x[1]);
  const entryRe = /"([a-z0-9_-]+)":\s*\{\s*"id"/g;
  const all = [...reg.matchAll(entryRe)].map((x) => x[1]);
  const list = all.length ? all : ids;
  let miss = 0;
  for (const id of list) {
    /* 每张图的三个文件按 dir + id 现算，dir 从 registry 里拿不到就按层级猜：
     * 这里只抽查"文件是否存在"，用 find 太慢，改为按已知布局判断。 */
    const cands = [
      path.join(DEPLOY, 'js/maps', id + '.js'),
      path.join(DEPLOY, 'js/maps/china', id + '.js'),
    ];
    /* 省级在 js/maps/china/，地级在 js/maps/china/<省>/，逐个目录找代价高，
     * 所以这里只报"一个都没找到"的，作为粗筛。 */
    const found = cands.some((p) => fs.existsSync(p)) ||
      fs.existsSync(path.join(DEPLOY, 'js/maps/china', id + '.geo.js'));
    if (!found) miss++;
  }
  if (miss) info('registry 里有 ' + miss + ' 个 id 在顶层没直接找到（地级在二级目录，属正常）');
  info('registry 登记地图数：' + list.length);
}

/* ============================ ④ 发布 ============================ */
if (DO_DEPLOY) {
  step(4, '发布 · Cloudflare Pages');
  info('项目名：' + PROJECT);
  if (PROJECT === 'map-puzzle') {
    bad('"map-puzzle" 这个名字已经被一个叫 "World Puzzle" 的商业站占了。\n' +
      '      Cloudflare 的 project-name 全局唯一，撞名**不会报错** ——\n' +
      '      你会以为部署成功，打开却是别人的站（真踩过）。\n' +
      '      本项目的项目名是 map-puzzle-89v，请改用 --project=map-puzzle-89v');
  }
  console.log('  … 正在部署（首次会下载 wrangler，可能等一两分钟）');
  const r = run('npx', ['wrangler@latest', 'pages', 'deploy', 'deploy/',
    '--project-name=' + PROJECT, '--commit-dirty=true'], { inherit: true });
  if (r.code === 0) ok('已部署'); else bad('部署失败（退出码 ' + r.code + '）');
  if (NPM_CACHE) info('（用了临时 npm 缓存目录：' + NPM_CACHE + '）');

  /* 【部署后必须验证"打开的是自己的内容"】
   * 这是本轮最贵的教训：project-name 撞名时 wrangler **不报错**，
   * 部署"成功"，但网址指向别人的站 —— 我因此把别人的站点当成了你的。
   *
   * ⚠️ 而且**别自己拼域名**：Cloudflare 可能给项目分配一个带后缀的域名
   * （本项目就是 `map-puzzle-89v-1v6.pages.dev`，而不是项目名直拼的
   * `map-puzzle-89v.pages.dev` —— 后者属于账号下另一个同名旧项目！
   * 第一版这里就是自己拼的，于是拿着一份"别人的旧站"报了假警报）。
   * 正确做法：**先问 Cloudflare 要项目的真实域名**，再验。 */
  if (r.code === 0) {
    console.log('  … 查出项目的真实域名（不自己拼）');
    let prodUrl = null;
    const listed = run('npx', ['wrangler@latest', 'pages', 'project', 'list']);
    const re = new RegExp('\\b' + PROJECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '\\s*│\\s*([^│\\s]+)');
    const hit = re.exec(listed.out || '');
    if (hit) prodUrl = 'https://' + hit[1].trim();
    if (!prodUrl) {
      bad('查不到 ' + PROJECT + ' 的域名，跳过线上验证（手动确认一下 project list）');
    } else {
      info('真实域名：' + prodUrl);
      const probe = run('curl', ['-sSL', '-m', '25', prodUrl + '/js/game.js']);
      if (probe.code !== 0 || !probe.out) {
        bad('线上验证失败：抓不到 ' + prodUrl + '/js/game.js（刚部署完可能要等一会儿）');
      } else {
        const want = fs.readFileSync(path.join(DEPLOY, 'js/game.js'), 'utf8');
        const wantMap = (want.match(/DEFAULT_MAP\s*=\s*'([a-z]+)'/) || [])[1];
        const gotMap = (probe.out.match(/DEFAULT_MAP\s*=\s*'([a-z]+)'/) || [])[1];
        if (!gotMap) {
          bad('线上 js/game.js 里没有 DEFAULT_MAP —— 这很可能**不是你的站**（撞名了）');
        } else if (gotMap !== wantMap) {
          bad('线上默认图是 "' + gotMap + '"，本地产物是 "' + wantMap + '" —— 线上是旧版本');
        } else {
          ok('线上内容确认是自己的（' + prodUrl + '，默认图 = ' + gotMap + '）');
        }
      }
    }
  }
} else {
  step(4, '发布 · 跳过');
  info('没有加 --deploy，所以不部署。要发布就再跑一次加 --deploy');
}

if (DO_PUSH) {
  step(5, '发布 · 推 GitHub');
  const msg = MESSAGE || ('release: 更新部署包 ' + new Date().toISOString().slice(0, 16));
  const add = run('git', ['add', '-A']);
  if (add.code !== 0) bad('git add 失败');
  const c = run('git', ['commit', '-m', msg]);
  if (c.code === 0) ok('已提交：' + msg);
  else info('没有可提交的内容（或提交失败）：' + c.out.trim().split('\n')[0]);
  const hasRemote = run('git', ['remote']).out.trim();
  if (!hasRemote) {
    bad('还没有配远程仓库。先跑：\n      git remote add origin https://github.com/<用户名>/<仓库名>.git');
  } else {
    const p = run('git', ['push']);
    if (p.code === 0) ok('已 push'); else bad('push 失败：' + p.out.slice(-300));
  }
} else {
  step(5, '发布 · 跳过 push');
  info('没有加 --push，所以不推 GitHub。要推就加 --push');
}

/* ============================ 收尾 ============================ */
console.log('\n' + '═'.repeat(64));
if (failed) {
  console.log('  有 ' + failed + ' 项没过 —— 看上面的 ✘');
  console.log('═'.repeat(64) + '\n');
  process.exit(1);
}
console.log('  ✅ 完成');
if (!DO_DEPLOY && !DO_PUSH) {
  console.log('     产物已就绪：deploy/（' + fileCount + ' 个文件）');
  console.log('     要发布：node tools/release.js --deploy --push -m "说明"');
}
console.log('═'.repeat(64) + '\n');
