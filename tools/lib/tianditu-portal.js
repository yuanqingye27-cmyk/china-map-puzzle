'use strict';
/* =====================================================================
 * 公共库 · 天地图服务中心「行政区划」官方数据（cloudcenter）
 * ---------------------------------------------------------------------
 * 路径：tools/lib/tianditu-portal.js
 *
 * 这是**不走 API Key、也不需要登录**的官方数据通道，也是本项目的合规数据源：
 *   ① GET /api/portal/region/menu
 *        返回全国行政区划树（省 → 市 → 区县），每个节点带 gb / pGb / name / level
 *   ② GET /api/portal/region/map?gb=<gb>&level=<level>
 *        返回**该节点全部下级**的边界，是一份 GeoJSON FeatureCollection
 *
 * ⚠️ ② 的响应是**打包过的二进制**（不是 JSON），解码链是从官方前端 bundle 里逆出来的：
 *      HTTP gzip 解压 → 每 4 字节按大端读成 int32 → `>>2` → 取低字节
 *      → 拼成 UTF-8 → 得到 JSON
 *    校验点：前 4 字节 `00 00 01 ec` → int32 492 → >>2 = 123 = `{`（JSON 的左花括号）。
 *
 * 坐标字段：feature.properties.gb 是 "156" + adcode（156 是中国的 ISO 数字码），
 *           所以 adcode = Number(gb.slice(3))。
 *
 * 【合规口径】数据来自国家地理信息公共服务平台（天地图）服务中心的行政区划服务，
 *   即对外发布时标注「审图号：GS(2024)0650号」的那套数据。落盘时我们会把来源 URL、
 *   抓取时间、审图号一起写进 manifest，便于追溯。
 * ===================================================================== */

const http = require('http');
const https = require('https');
const zlib = require('zlib');

const BASE = 'https://cloudcenter.tianditu.gov.cn';
const MENU_URL = BASE + '/api/portal/region/menu';
const MAP_URL = BASE + '/api/portal/region/map';

/** 根节点「中华人民共和国」的 gb（它是 156000000，不是 156100000） */
const ROOT_GB = '156000000';

/** 官方审图号（随该套行政区划数据发布） */
const APPROVAL = 'GS(2024)0650号';
const PROVIDER_LABEL = '国家地理信息公共服务平台（天地图）· 服务中心行政区划';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT_MS = 30000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================ 解码 ============================ */

/**
 * 把官方打包的二进制还原成 JSON 文本。
 * 算法与官方前端一致：每 4 字节大端 int32 → 右移 2 位 → 取低字节 → UTF-8。
 */
function unpackPayload(buf) {
  let b = buf;
  // HTTP 层可能带 gzip（curl 不自动解、浏览器自动解，两种都要活）
  if (b.length > 2 && b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);

  const bytes = [];
  for (let i = 0; i + 3 < b.length; i += 4) {
    const n = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >> 2;
    bytes.push(n & 0xff);
  }
  return Buffer.from(bytes).toString('utf8');
}

/** 取一个节点的全部下级边界，返回我们项目用的 FeatureCollection */
function decodeRegionMap(buf) {
  const text = unpackPayload(buf);
  const raw = JSON.parse(text);
  if (!raw || !Array.isArray(raw.features)) {
    throw new Error('解码后不是 FeatureCollection：' + text.slice(0, 120));
  }
  return raw;
}

/* ============================ HTTP ============================ */

function httpGetBinary(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': BASE + '/administrativeDivision/',
        'Accept': '*/*',
        // 不要主动声明 gzip，让服务端按默认来；拿到了我们自己解
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode + '（' + url + '）'));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error('请求超时（' + TIMEOUT_MS + 'ms）')));
    req.on('error', reject);
  });
}

/** 行政区划树（省 → 市 → 区县），公开可访问，无需 Key 与登录 */
async function fetchRegionMenu(opts) {
  const log = (opts && opts.log) || (() => {});
  log('拉取官方行政区划树：' + MENU_URL);
  const buf = await httpGetBinary(MENU_URL);
  const json = JSON.parse(buf.toString('utf8'));
  if (json.status !== 200 || !Array.isArray(json.data)) {
    throw new Error('行政树接口异常：' + JSON.stringify(json).slice(0, 200));
  }
  return json.data;
}

/**
 * 取某个节点的下级边界（官方 GeoJSON）。
 * @param {string} gb    "156" + adcode，如 "156510100"
 * @param {number} level 该节点自己在树里的层级（menu 里带）
 */
async function fetchRegionMap(gb, level, opts) {
  const url = MAP_URL + '?gb=' + encodeURIComponent(gb) + '&level=' + encodeURIComponent(level);
  const buf = await httpGetBinary(url);
  return { geo: decodeRegionMap(buf), url, bytes: buf.length };
}

/* ============================ 归一化 ============================ */

/** gb（156510185）→ adcode（510185） */
function gbToAdcode(gb) {
  const s = String(gb || '');
  if (!/^\d{9}$/.test(s)) return null;
  return Number(s.slice(3));
}

/**
 * 把官方 FeatureCollection 转成项目引擎吃的样子：
 *   properties.adcode / name / center([lng,lat])，几何保留 MultiPolygon
 * 同时把官方给的 lng/lat 当作 center（比我们自己按顶点平均更权威）。
 */
function normalizeOfficialGeo(raw, opts) {
  const onSkip = (opts && opts.onSkip) || (() => {});
  const features = [];
  raw.features.forEach((f) => {
    const p = f.properties || {};
    const geom = f.geometry;
    const adcode = gbToAdcode(p.gb || p.code || p.adcode);

    /* 非面要素：官方数据里混着「境界线」（MultiLineString，国界/省界线）。
     * 引擎只认面（拼图块必须是面），所以这里跳过并汇报，不硬塞进去。
     * ⚠️ 注意：南海诸岛/九段线这类要素也在这一层，跳过意味着底图不画它 ——
     *    这一条要单独作为合规事项处理，不能默默丢掉。 */
    if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) {
      onSkip({ name: p.name || '(无名)', gb: p.gb, type: geom && geom.type, reason: '非面几何' });
      return;
    }
    if (adcode === null) {
      onSkip({ name: p.name || '(无名)', gb: p.gb, type: geom.type, reason: '没有可识别的 gb' });
      return;
    }
    const lng = Number(p.lng);
    const lat = Number(p.lat);
    features.push({
      type: 'Feature',
      properties: {
        adcode,
        name: p.name,
        center: isFinite(lng) && isFinite(lat) ? [lng, lat] : null,
      },
      geometry: geom,
    });
  });
  return { type: 'FeatureCollection', features };
}

/** 遍历整棵树，收集 gb → { gb, name, level, pGb, adcode } */
function flattenMenu(tree) {
  const out = {};
  const walk = (nodes, parent, depth) => {
    nodes.forEach((n) => {
      // 根节点特判：gb=156000000 → 我们要的 adcode 是 100000
      // （直接 gbToAdcode 会得到 Number("000000") = 0，匹配不上登记册里的中国）
      const adcode = n.gb === ROOT_GB ? 100000 : gbToAdcode(n.gb);
      out[n.gb] = {
        gb: n.gb,
        name: n.name,
        depth,                       // 树深度：中国=1、省=2、市=3、区县=4
        pGb: n.pGb,
        adcode,
        parentAdcode: parent ? gbToAdcode(parent.gb) : null,
      };
      if (Array.isArray(n.children) && n.children.length) walk(n.children, n, depth + 1);
    });
  };
  walk(tree, null, 1);
  return out;
}

/**
 * `/region/map` 要的 level 参数（**实测拟合出来的，不是文档里的**）：
 *   中国 → 2　　省级 → 2　　地级 → 3
 * 依据：中国+2 得到 34 个省级；四川(省)+2 得到 21 个市；成都(市)+3 得到 20 个区县。
 * 菜单里没有 level 字段，所以只能这样推 —— 而且是"先算再校验"：
 * 下载器会检查返回的 adcode 是不是该节点的下级，不对就换 level±1 再试一次（有界，不循环）。
 */
function levelForAdcode(adcode) {
  if (!adcode || adcode === 100000) return 2;   // 中国
  if (adcode % 10000 === 0) return 2;           // 省级
  if (adcode % 100 === 0) return 3;             // 地级
  return 4;                                     // 区县（未实测，暂留）
}

module.exports = {
  BASE,
  ROOT_GB,
  MENU_URL,
  MAP_URL,
  APPROVAL,
  PROVIDER_LABEL,
  USER_AGENT,
  sleep,
  unpackPayload,
  decodeRegionMap,
  httpGetBinary,
  fetchRegionMenu,
  fetchRegionMap,
  gbToAdcode,
  normalizeOfficialGeo,
  flattenMenu,
  levelForAdcode,
};
