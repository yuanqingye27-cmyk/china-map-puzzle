'use strict';
/* =====================================================================
 * 公共库 · 地图树（扫描目录 / 读元信息 / 生成注册表）
 * ---------------------------------------------------------------------
 * 路径：tools/lib/map-tree.js
 *
 * 【目录规则】—— 一条递归规则，没有例外：
 *   地图 id 为 X 的包文件路径 = 「父地图的子目录」+ X.js
 *   而某张地图的「子目录」= 它自己包文件所在目录 + 它自己的 id + '/'
 *
 *   推导出来的实际布局（和第一步落地的结构完全吻合）：
 *     js/maps/china.js            中国（根，parent = null，放在 js/maps/ 下）
 *     js/maps/china/sichuan.js    四川（parent = china）
 *     js/maps/china/sichuan/chengdu.js   成都（parent = sichuan）
 *   每张地图三个文件：X.js（配置）/ X.geo.js（构建产物）/ X.data.js（人工资料）
 *
 * 【为什么在 Node 里"跑一遍"包文件来取元信息】
 *   因为 parent 是唯一真相来源，而 children 靠反向推导。
 *   包配置是纯数据 IIFE，在 vm 沙箱里喂一套假的 window（MAP_GEO / MAP_DATA
 *   给空对象）就能安全求值，不必真的加载 130KB 的 GeoJSON，也不必用正则去猜。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const MAPS_DIR = path.join(ROOT, 'js', 'maps');

/** 放在 js/maps/ 下但不是地图包的文件（扫描时跳过） */
const RESERVED_FILES = ['registry.js', 'loader.js'];

const GEO_SUFFIX = '.geo.js';
const DATA_SUFFIX = '.data.js';

const posixDir = (p) => {
  const d = p.split(path.sep).join('/');
  return d === '.' ? '' : d;
};

/** 递归列出 js/maps 下所有 .js 文件，返回相对 MAPS_DIR 的 posix 路径 */
function walk(dir, rel, out) {
  rel = rel || '';
  out = out || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? rel + '/' + entry.name : entry.name;
    const childAbs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(childAbs, childRel, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(childRel);
  }
  return out;
}

/** 找出所有「包配置文件」（排除 .geo.js / .data.js 与保留文件） */
function listPackageFiles() {
  if (!fs.existsSync(MAPS_DIR)) return [];
  return walk(MAPS_DIR)
    .filter((rel) => !rel.endsWith(GEO_SUFFIX) && !rel.endsWith(DATA_SUFFIX))
    .filter((rel) => !RESERVED_FILES.includes(path.posix.basename(rel)))
    .sort();
}

/**
 * 在沙箱里执行一个包配置文件，取出它登记的 MAP_PACKAGES[id]。
 * 只求值元信息，不碰磁盘上的 .geo.js / .data.js，所以很快。
 */
function loadPackageMeta(absFile) {
  const fakeWindow = {
    MAP_GEO: {},
    MAP_DATA: {},
    MAP_PACKAGES: {},
    MAP_REGISTRY: { version: 1, roots: [], orphans: [], maps: {} },
  };
  const sandbox = { window: fakeWindow, console: { log() {}, warn() {}, error() {} } };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const code = fs.readFileSync(absFile, 'utf8');
  new vm.Script(code, { filename: absFile }).runInContext(sandbox);

  const registered = Object.keys(fakeWindow.MAP_PACKAGES);
  if (registered.length !== 1) {
    throw new Error(
      '包配置应当正好登记 1 个地图配置（window.MAP_PACKAGES[<id>] = …），实际登记了 ' +
      registered.length + ' 个：' + (registered.join(', ') || '无')
    );
  }

  const id = registered[0];
  const pkg = fakeWindow.MAP_PACKAGES[id];
  return {
    id: pkg.id || id,
    name: pkg.name,
    parent: pkg.parent === undefined ? null : pkg.parent,
    adcode: pkg.adcode,
    // 配置里若自己声明了 children，只用来做「体检」，真相仍由 parent 反推
    declaredChildren: Array.isArray(pkg.children) ? pkg.children.slice() : null,
    registeredKey: id,
  };
}

/** 某张地图的「子目录」（它的孩子该放哪儿） */
function childDirOf(map) {
  const base = map.dir ? map.dir + '/' : '';
  return base + map.id;
}

/** 某张地图三个文件的路径（相对 js/maps/，给 registry 和 loader 用） */
function scriptsOf(map) {
  const base = map.dir ? map.dir + '/' : '';
  return [base + map.id + GEO_SUFFIX, base + map.id + DATA_SUFFIX, base + map.id + '.js'];
}

function absOf(relFromMaps) {
  return path.join(MAPS_DIR, relFromMaps);
}

/**
 * 扫描 js/maps/，读出全部地图包的元信息，并做一致性体检。
 *
 * @returns {{maps:Object, problems:Array<{level:string,message:string}>}}
 *          problems[].level: 'error' 会阻断生成；'warn' 只提示
 */
function scanMaps() {
  const maps = {};
  const problems = [];

  for (const rel of listPackageFiles()) {
    const abs = absOf(rel);
    const expectId = path.posix.basename(rel, '.js');

    let meta;
    try {
      meta = loadPackageMeta(abs);
    } catch (err) {
      problems.push({ level: 'error', message: rel + ' 求值失败：' + err.message });
      continue;
    }

    if (meta.registeredKey !== meta.id) {
      problems.push({
        level: 'error',
        message: rel + ' 登记的 key（' + meta.registeredKey + '）与 id（' + meta.id + '）不一致',
      });
    }
    if (meta.id !== expectId) {
      problems.push({
        level: 'error',
        message: rel + ' 的文件名（' + expectId + '.js）与配置里的 id（' + meta.id + '）不一致',
      });
    }
    if (typeof meta.adcode !== 'number' && meta.adcode !== null) {
      problems.push({
        level: 'error',
        message: rel + ' 的 adcode 必须是数字，或 null（世界/大洲这类没有区划代码的层级）',
      });
    }

    maps[meta.id] = {
      id: meta.id,
      name: meta.name || meta.id,
      parent: meta.parent,
      adcode: meta.adcode,
      declaredChildren: meta.declaredChildren,
      dir: posixDir(path.posix.dirname(rel)),
      file: rel,
    };
  }

  // 体检 1：放置位置是否符合「父目录 = 父地图 id」规则
  for (const id of Object.keys(maps)) {
    const m = maps[id];
    if (m.parent === null) {
      if (m.dir !== '') {
        problems.push({
          level: 'error',
          message: id + ' 是根地图（parent = null），应当放在 js/maps/ 下，实际在 js/maps/' + m.dir + '/',
        });
      }
      continue;
    }
    const parent = maps[m.parent];
    if (!parent) {
      problems.push({
        level: 'warn',
        message: id + ' 声明的父级「' + m.parent + '」还没接入（该地图会先挂在"父级待接入"里）',
      });
      continue;
    }
    const expectDir = childDirOf(parent);
    if (m.dir !== expectDir) {
      problems.push({
        level: 'error',
        message:
          id + ' 放错位置：父级是 ' + parent.id + '，应当在 js/maps/' + expectDir +
          '/ 下，实际在 js/maps/' + (m.dir || '') + '/',
      });
    }
  }

  return { maps, problems };
}

/**
 * 由扫描结果生成注册表模型：**反向填充 children**。
 *
 * parent 是唯一真相来源；children 一律由「谁的 parent 指向我」推出来，
 * 所以新增一张地图只需在新包自己的配置里写 parent = '…'，
 * 不必回头去改父地图的文件（也就不会出现"两边写法打架"）。
 * 若父包里手写了 children，这里会对照检查，不一致就报警告。
 */
function buildRegistryModel(scan) {
  const maps = scan.maps;
  const problems = (scan.problems || []).slice();

  /* 按 adcode 升序；adcode 为 null 的（世界/大洲）视为 0 排在最前，
   * 同 adcode 时再按 id 字典序，保证生成结果稳定可复现 */
  const byAdcode = (a, b) =>
    (maps[a].adcode || 0) - (maps[b].adcode || 0) || a.localeCompare(b);

  // 反向填充：children
  const childrenOf = {};
  Object.keys(maps).forEach((id) => { childrenOf[id] = []; });
  Object.keys(maps).forEach((id) => {
    const parent = maps[id].parent;
    if (parent && childrenOf[parent]) childrenOf[parent].push(id);
  });

  const entries = {};
  Object.keys(maps).sort(byAdcode).forEach((id) => {
    const m = maps[id];
    const children = childrenOf[id].sort(byAdcode);

    // 体检 2：父包里手写的 children 与反推结果是否一致
    if (m.declaredChildren) {
      const declared = m.declaredChildren.slice().sort();
      const derived = children.slice().sort();
      if (declared.join(',') !== derived.join(',')) {
        problems.push({
          level: 'warn',
          message:
            id + ' 配置里手写的 children [' + declared.join(', ') + '] 与实际反推 [' +
            derived.join(', ') + '] 不一致（registry 以反推结果为准，建议手写的那份删掉或改对）',
        });
      }
    }

    entries[id] = {
      id: m.id,
      name: m.name,
      parent: m.parent,
      adcode: m.adcode,
      children,
      dir: m.dir,
      scripts: scriptsOf(m),
    };
  });

  const roots = Object.keys(entries).filter((id) => entries[id].parent === null).sort(byAdcode);

  /* 孤儿：声明了 parent，但那个父级地图还没接入（拼错 id 也会落进这里） */
  const orphans = Object.keys(entries)
    .filter((id) => entries[id].parent !== null && !entries[entries[id].parent])
    .map((id) => ({ id, parent: entries[id].parent }));

  return { version: 1, roots, orphans, maps: entries, problems };
}

/** 生成 js/maps/registry.js 的源码文本 */
function renderRegistrySource(model) {
  const body = JSON.stringify(
    { version: model.version, roots: model.roots, orphans: model.orphans, maps: model.maps },
    null,
    2
  )
    .split('\n')
    .join('\n  '); // 跟着外层 IIFE 缩进，生成物也要像手写的一样整齐

  return (
    '/* =====================================================================\n' +
    ' * 地图总登记册（registry）· 自动生成，请勿手改\n' +
    ' * ---------------------------------------------------------------------\n' +
    ' * 路径：js/maps/registry.js\n' +
    ' * 生成：node tools/build-registry.js\n' +
    ' * 新增地图：node tools/add-map.js --adcode=<6位> --name=<slug> --parent=<父id>\n' +
    ' *\n' +
    ' * 作用：把 js/maps/ 下所有地图包登记成一份**只含元信息**的清单（不含 GeoJSON）。\n' +
    ' * 元信息很轻，可以一次性全量加载；体积巨大的 geo 数据等到真正切换地图时\n' +
    ' * 再由 js/maps/loader.js 按需注入脚本，于是"双击秒开"的体验不受地图数量影响。\n' +
    ' *\n' +
    ' * 【命名空间约定】引擎之外的共享存储\n' +
    ' *   window.MAP_REGISTRY    元信息树（本文件）\n' +
    ' *   window.MAP_GEO[id]     某张地图的 GeoJSON（由 <id>.geo.js 写入，构建产物）\n' +
    ' *   window.MAP_DATA[id]    某张地图的资料与关卡（由 <id>.data.js 写入，人工维护）\n' +
    ' *   window.MAP_PACKAGES[id] 组装好的引擎配置（由 <id>.js 写入）\n' +
    ' *   三个包文件都做防御性初始化，所以加载顺序不敏感。\n' +
    ' *\n' +
    ' * 【条目字段】\n' +
    ' *   id       地图包唯一 id（= 文件名 = MAP_PACKAGES 的 key）\n' +
    ' *   name     显示名，如"成都"\n' +
    ' *   parent   上一级地图包 id；根地图为 null\n' +
    ' *   adcode   本级行政区划代码\n' +
    ' *   children 下一级地图包 id（**由子地图的 parent 反向推导**，不是手写的）\n' +
    ' *   dir      相对 js/maps/ 的目录，如 "china/sichuan"（根地图为 ""）\n' +
    ' *   scripts  该地图三个文件的路径，相对 js/maps/，按依赖顺序排列\n' +
    ' *\n' +
    ' * 【roots / orphans】\n' +
    ' *   roots    树的根（parent 为 null 的地图）\n' +
    ' *   orphans  声明了 parent 但父级还没接入的地图，如 [{ id, parent }]\n' +
    ' *            —— 这是"父级空位还等着填"的信号，地图选择器会把它顶到根一级显示\n' +
    ' * ===================================================================== */\n' +
    '\n' +
    '(function (global) {\n' +
    "  'use strict';\n" +
    '\n' +
    '  /* 先把共享命名空间建好（已存在则保留，重复加载也安全） */\n' +
    '  global.MAP_GEO = global.MAP_GEO || {};\n' +
    '  global.MAP_DATA = global.MAP_DATA || {};\n' +
    '  global.MAP_PACKAGES = global.MAP_PACKAGES || {};\n' +
    '\n' +
    '  /* ↓↓↓ 以下内容由 tools/build-registry.js 扫描 js/maps/ 生成 ↓↓↓ */\n' +
    '  const REGISTRY =\n  ' + body + ';\n' +
    '  /* ↑↑↑ 生成内容结束 ↑↑↑ */\n' +
    '\n' +
    '  global.MAP_REGISTRY = REGISTRY;\n' +
    '})(window);\n'
  );
}

/** 生成并写入 js/maps/registry.js */
function writeRegistry(model) {
  const out = path.join(MAPS_DIR, 'registry.js');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderRegistrySource(model), 'utf8');
  return out;
}

/** 一次搞定：扫描 → 反推 → 写文件。两个 CLI 都调它 */
function regenerateRegistry(opts) {
  const scan = scanMaps();
  const model = buildRegistryModel(scan);
  const errors = model.problems.filter((p) => p.level === 'error');
  const warns = model.problems.filter((p) => p.level === 'warn');

  if (errors.length && !(opts && opts.force)) {
    return { ok: false, errors, warns, model };
  }

  const file = writeRegistry(model);
  return { ok: true, file, errors, warns, model };
}

module.exports = {
  ROOT,
  MAPS_DIR,
  RESERVED_FILES,
  GEO_SUFFIX,
  DATA_SUFFIX,
  listPackageFiles,
  loadPackageMeta,
  childDirOf,
  scriptsOf,
  absOf,
  scanMaps,
  buildRegistryModel,
  renderRegistrySource,
  writeRegistry,
  regenerateRegistry,
};
