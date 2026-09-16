'use strict';
/* =====================================================================
 * 公共库 · GeoJSON → 可内联的 .js 模块
 * ---------------------------------------------------------------------
 * 路径：tools/lib/inline-geo.js
 *
 * 为什么把 GeoJSON 内联成 .js 而不是留 .json？
 *   因为 index.html 要支持本地双击（file://）打开，而 file:// 下浏览器
 *   会拦截对本地 .json 的 fetch（CORS）；写成普通 <script> 不受影响。
 *   整个项目因此保持零依赖、零服务器。
 *
 * 被谁用：
 *   tools/build-data.js   只重刷成都一张（保留的老入口）
 *   tools/add-map.js      自动化接入任意地图
 * 两边共用本文件 —— 转换规则只有一份，不会出现"两个脚本生成的数据不一样"。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const https = require('https');

/** 经纬度保留 5 位小数 ≈ 1 米精度，肉眼和像素级渲染都够用，还能压体积 */
const PRECISION = 5;

const DATAV_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound';

/** 下载失败最多尝试 2 次（项目红线：两次不成要停下来问人，不许死磕） */
const DATAV_ATTEMPTS = 2;
const HTTP_TIMEOUT_MS = 20000;
const RETRY_DELAY_MS = 600;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const round = (n) => Number(n.toFixed(PRECISION));
const roundRing = (ring) => ring.map(([lon, lat]) => [round(lon), round(lat)]);

/**
 * 是不是一个"真正的行政区划代码"（6 位数字）。
 *
 * 为什么要判这个：DataV 的全国数据里混着**非行政区**的 feature ——
 * 南海九段线的 adcode 是字符串 `"100000_JD"`。它必须留在 GeoJSON 里
 * （底图要画出这段国界），但**不能当拼图块**：
 *   - 它不是一块可以"拼对"的行政区
 *   - 它的 adcode 不是数字，写成对象字面量的 key 会变成非法 JS（真实踩过）
 */
const isAdminAdcode = (adcode) => /^\d{6}$/.test(String(adcode));

/** 数字串的 adcode 统一成 Number，保证 Map 的 key、比较、排序都一致 */
const normalizeAdcode = (adcode) =>
  /^\d+$/.test(String(adcode)) ? Number(adcode) : adcode;

/**
 * 把任意 DataV GeoJSON 规范化成引擎吃的样子：
 *   - 几何一律补齐成 MultiPolygon（DataV 有的给 Polygon、有的给 MultiPolygon）
 *   - 坐标降精度
 *   - 只保留 adcode / name / center 三个属性，扔掉冗余字段
 *
 * @param {object} raw 原始 FeatureCollection
 * @param {string} [source] 数据来源 URL，写进产物里做溯源
 * @returns {object} 规范化后的 FeatureCollection
 */
function normalizeGeo(raw, source) {
  if (!raw || !Array.isArray(raw.features)) {
    throw new Error('不是合法的 GeoJSON FeatureCollection（缺 features 数组）');
  }

  const features = raw.features.map((f) => {
    const geo = f.geometry;
    if (!geo || !geo.coordinates) {
      throw new Error('feature 缺 geometry：' + JSON.stringify(f.properties || {}));
    }

    // Polygon 是 [环][点]，MultiPolygon 多一层 [多边形][环][点]，统一补成后者
    const polygons = geo.type === 'MultiPolygon' ? geo.coordinates : [geo.coordinates];

    const props = {
      adcode: normalizeAdcode(f.properties.adcode),
      name: f.properties.name,
    };
    // center 是 DataV 给的标注点；引擎的落点判定用的是 geomap 自己算的质心，
    // 这个字段目前只是保留下来备用（信息卡定位兜底），有就带上
    if (Array.isArray(f.properties.center)) {
      props.center = f.properties.center.map(round);
    }

    return {
      type: 'Feature',
      properties: props,
      geometry: {
        type: 'MultiPolygon',
        coordinates: polygons.map((poly) => poly.map(roundRing)),
      },
    };
  });

  const out = { type: 'FeatureCollection' };
  if (source) out.source = source; // 溯源：这份边界是从哪个 URL 拿的
  out.features = features;
  return out;
}

/**
 * 生成内联模块的源码文本。
 *
 * 产物形态： (window.MAP_GEO = window.MAP_GEO || {}).<id> = {...};
 * 防御性初始化是为了"动态注入脚本"时对加载顺序免疫。
 *
 * @param {object} geo   normalizeGeo 的产物
 * @param {object} opts  { id, label, adcode, sourceUrl, generator }
 * @returns {string} js 源码
 */
function renderGeoModule(geo, opts) {
  const id = opts.id;
  const label = opts.label || id;
  const sourceUrl = opts.sourceUrl || DATAV_BASE + '/' + opts.adcode + '_full.json';
  const src = opts.source || {}; // { provider, label, approval, note }，见 tools/lib/geo-source.js

  /* 来源元信息跟数据写在同一个文件里 —— 这样"这份边界是哪来的、有没有审图号"
   * 永远和数据本身同生共死，不会因为换了数据源却忘了改声明而对不上。
   * 页面上的合规声明就读 MAP_GEO_META。 */
  const meta = {
    provider: src.provider || 'datav',
    providerLabel: src.label || '阿里云 DataV.GeoAtlas',
    approval: src.approval || null,
    note: src.note || '',
    adcode: opts.adcode,
    mapName: label,
    sourceUrl,
    fetchedAt: opts.fetchedAt || new Date().toISOString().slice(0, 10),
  };

  return (
    '/* 自动生成，请勿手改。重新生成：' + (opts.generator || 'node tools/add-map.js') + ' */\n' +
    '/* 数据来源：' + meta.providerLabel + ' ' + label + '（adcode ' + opts.adcode + '）行政区划边界 */' +
    (meta.approval ? '\n/* 审图号：' + meta.approval + ' */' : '\n/* 注意：本数据源未提供审图号 */') + '\n' +
    '(window.MAP_GEO = window.MAP_GEO || {}).' + id + ' = ' +
    JSON.stringify(geo) +
    ';\n' +
    '(window.MAP_GEO_META = window.MAP_GEO_META || {}).' + id + ' = ' +
    JSON.stringify(meta) +
    ';\n'
  );
}

/**
 * 写 .geo.js 到磁盘（自动建目录）。
 * @returns {{bytes:number, path:string}}
 */
function writeGeoModule(absFile, geo, opts) {
  const js = renderGeoModule(geo, opts);
  fs.mkdirSync(path.dirname(absFile), { recursive: true });
  fs.writeFileSync(absFile, js, 'utf8');
  return { bytes: Buffer.byteLength(js), path: absFile };
}

/** GET 一个 JSON（零依赖，用内置 https） */
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: HTTP_TIMEOUT_MS }, (res) => {
      if (res.statusCode === 404) {
        res.resume();
        const err = new Error('HTTP 404');
        err.notFound = true;
        reject(err);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          reject(new Error('返回的不是合法 JSON：' + e.message));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('请求超时（' + HTTP_TIMEOUT_MS + 'ms 无响应）')));
    req.on('error', reject);
  });
}

/**
 * 下载某个 adcode 的边界数据。
 *
 * 两个候选地址，语义不同：
 *   <adcode>_full.json  含【下级区划】——拼图要的就是这个
 *   <adcode>.json       只有自己一个 feature（叶子行政区没有下级时用）
 *
 * 重试规则（对应项目红线）：
 *   - 网络类失败：同一个地址最多试 2 次，仍失败就抛错并列出尝试记录
 *   - 404：不重试（这是"该层级没有下级"的正常信号），直接换下一个候选
 *
 * @returns {Promise<{raw:object, url:string, hasChildren:boolean}>}
 */
async function fetchDatavGeo(adcode, opts) {
  const log = (opts && opts.log) || (() => {});
  const tried = [];

  for (const candidate of [
    { suffix: '_full.json', hasChildren: true },
    { suffix: '.json', hasChildren: false },
  ]) {
    const url = DATAV_BASE + '/' + adcode + candidate.suffix;

    for (let attempt = 1; attempt <= DATAV_ATTEMPTS; attempt++) {
      try {
        log('下载中：' + url + (attempt > 1 ? '（第 ' + attempt + ' 次尝试）' : ''));
        const raw = await httpGetJson(url);
        return { raw, url, hasChildren: candidate.hasChildren };
      } catch (err) {
        if (err.notFound) {
          tried.push(url + ' → 404');
          break; // 这个候选不存在，换下一个；不算网络故障
        }
        tried.push(url + ' → 第 ' + attempt + ' 次失败：' + err.message);
        if (attempt === DATAV_ATTEMPTS) {
          throw new Error(
            '下载 GeoJSON 失败（已尝试 ' + DATAV_ATTEMPTS + ' 次，停下不再重试）：\n  ' +
            tried.join('\n  ') +
            '\n请检查网络，或手动下载后重跑。'
          );
        }
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    'DataV 上没有 adcode ' + adcode + ' 的边界数据：\n  ' + tried.join('\n  ') +
    '\n（连 <adcode>.json 都是 404，说明这个代码不存在或有误）'
  );
}

module.exports = {
  PRECISION,
  DATAV_BASE,
  DATAV_ATTEMPTS,
  isAdminAdcode,
  normalizeAdcode,
  normalizeGeo,
  renderGeoModule,
  writeGeoModule,
  httpGetJson,
  fetchDatavGeo,
};
