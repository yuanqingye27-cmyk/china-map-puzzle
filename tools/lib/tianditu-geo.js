'use strict';
/* =====================================================================
 * 公共库 · 天地图行政区划接口（国家地理信息公共服务平台）
 * ---------------------------------------------------------------------
 * 路径：tools/lib/tianditu-geo.js
 *
 * 接口：GET http://api.tianditu.gov.cn/v2/administrative/district
 *        ?keyword=<名称> | &code=<adcode>   &child=<0|1>   &tk=<开发者Key>
 * 返回：JSON，其中 `boundary` 字段是 **WKT 字符串**（不是 GeoJSON），
 *       所以要用 tools/lib/wkt.js 转一道。
 *
 * ⚠️ 诚实声明：**本文件里的返回结构解析是"防御式"的，尚未用真 Key 验证过。**
 *    （写它的当晚没有可用的 tk，接口对匿名请求返回 {"code":301001,"msg":"非法key"}。）
 *    因此解析策略是"在响应树里找带 boundary 的对象"，而不是死认某个固定路径 ——
 *    天地图不同接口/版本的字段嵌套并不统一。拿到 Key 后请先跑：
 *      node tools/tianditu-check.js --adcode=510100
 *    确认解析结果再看别的。
 *
 * Key 的存放（按优先级）：
 *   1. 命令行 --tk=xxx
 *   2. 环境变量 TIANDITU_TK
 *   3. 配置文件 tools/tianditu.config.json  ← 已在 .gitignore 里，不会被提交
 *      内容：{ "tk": "你的Key", "delayMs": 600, "maxPerMinute": 60 }
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const wkt = require('./wkt');

const API_BASE = 'http://api.tianditu.gov.cn/v2/administrative/district';
const CONFIG_FILE = path.join(__dirname, '..', 'tianditu.config.json');

/** 请求间隔：天地图有配额，批量时必须慢下来（用户红线：加延时，不要死循环重试） */
const DEFAULT_DELAY_MS = 600;
/** 单次请求重试上限（红线：最多 2 次） */
const MAX_ATTEMPTS = 2;
const HTTP_TIMEOUT_MS = 20000;

/* 必须伪装成浏览器 UA。实测：不带 UA 时天地图的 WAF 直接返回 403/418（HTML 错误页），
 * 带上 UA 才会走到接口本身、返回 {"code":301001,"msg":"非法key"} 这种正经 JSON。
 * 这是本地实测出来的，不是猜的。 */
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* 这些错误码重试没有意义（Key 不对 / 没配额 / 参数错），要求"立刻失败并说清原因" */
const FATAL_CODES = {
  301001: 'Key 非法（请到天地图控制台确认 tk 是否正确、是否绑定了服务端调用）',
  301002: '该 Key 无此服务权限或当日配额已用尽',
  301003: '该 Key 未授权调用本服务',
  301004: '调用频率超限，请放慢（调大 delayMs）',
  301005: '配额已用尽',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================ Key 与配置 ============================ */

function loadConfig() {
  let fileCfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (err) {
      throw new Error('配置文件读不了（' + CONFIG_FILE + '）：' + err.message);
    }
  }
  return {
    tk: process.env.TIANDITU_TK || fileCfg.tk || '',
    delayMs: Number(fileCfg.delayMs) || DEFAULT_DELAY_MS,
    maxPerMinute: Number(fileCfg.maxPerMinute) || 60,
  };
}

/**
 * 取 Key：命令行 > 环境变量 > 配置文件。
 * 一个都拿不到就抛错，并把"怎么申请"直接写在错误里 —— 别让人去翻文档。
 */
function resolveKey(explicit) {
  const cfg = loadConfig();
  const tk = explicit || cfg.tk;
  if (!tk) {
    throw new Error(
      '缺少天地图开发者 Key（tk）。三种给法，任选其一：\n' +
      '  1. 命令行：--tk=你的Key\n' +
      '  2. 环境变量：export TIANDITU_TK=你的Key\n' +
      '  3. 配置文件：' + CONFIG_FILE + '  内容 {"tk":"你的Key"}\n\n' +
      '申请步骤：\n' +
      '  ① 注册开发者账号 https://uums.tianditu.gov.cn/register （需手机号 + 实名）\n' +
      '  ② 登录控制台 https://console.tianditu.gov.cn/ → 创建应用\n' +
      '  ③ 在应用里勾选「行政区划」相关服务，拿到 Key（tk）\n' +
      '  ④ 把 Key 填进上面任一位置（配置文件已在 .gitignore 里，不会外泄）'
    );
  }
  return { tk, delayMs: cfg.delayMs, maxPerMinute: cfg.maxPerMinute };
}

/* ============================ HTTP ============================ */

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout: HTTP_TIMEOUT_MS,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.tianditu.gov.cn/',
      },
    }, (res) => {
      /* ⚠️ 实测结论（用假 Key 打出来的）：**天地图对"非法 Key"返回的是 HTTP 403，
       * 但 body 是正经 JSON** —— {"code":301001,"msg":"非法key",...}。
       * 所以绝不能只看状态码，必须先把 body 读出来：
       *   能解析成 JSON  → 交给上层按 code 判断（业务错误）
       *   解析不出来     → 才是 WAF/网关拦的 HTML 页（那种才是"网络层"问题）
       * 一开始我按状态码直接判成 WAF，把真正的鉴权错误盖掉了。 */
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = null;
        }
        if (json) { resolve(json); return; }

        const snippet = text.replace(/\s+/g, ' ').slice(0, 80);
        const err = new Error('HTTP ' + res.statusCode + '，返回的不是 JSON（' + snippet + '）' +
          '—— 多半被 WAF 拦了：检查 UA / 换网络出口');
        // WAF 拦截重试无意义（实测不带 UA 时会持续 403/418）
        if (res.statusCode === 403 || res.statusCode === 418) err.fatal = true;
        reject(err);
      });
    });
    req.on('timeout', () => req.destroy(new Error('请求超时（' + HTTP_TIMEOUT_MS + 'ms）')));
    req.on('error', reject);
  });
}

/* ============================ 响应解析 ============================ */

/**
 * 在响应树里把所有"带 boundary 的对象"收集起来。
 *
 * 为什么不做成固定路径：天地图的返回结构在不同接口/版本里嵌套不一样
 * （有 data 直接是数组的，也有 data.district / data.children 的），
 * 而我没法用真 Key 验证。与其猜错，不如按"特征"找 —— 只要有 boundary + 名字/编码，
 * 它就是我们要的行政区。
 */
function collectBoundaryItems(node, out, depth) {
  out = out || [];
  depth = depth || 0;
  if (!node || depth > 8) return out;

  if (Array.isArray(node)) {
    node.forEach((n) => collectBoundaryItems(n, out, depth + 1));
    return out;
  }
  if (typeof node !== 'object') return out;

  const boundary = node.boundary || node.boundaries;
  if (typeof boundary === 'string' && boundary.trim()) {
    out.push({
      adcode: node.code || node.adcode || node.id || node.pac,
      name: node.name || node.district || node.text || '',
      boundary: boundary.trim(),
      center: node.center || node.capital || null,
    });
    return out; // 这个节点本身就是一块边界，不再往下钻
  }

  Object.keys(node).forEach((k) => collectBoundaryItems(node[k], out, depth + 1));
  return out;
}

/** 中心点字段天地图可能给 "116.4,39.9" 这种字符串，统一成 [lon, lat] */
function parseCenter(v) {
  if (!v) return null;
  if (Array.isArray(v) && v.length >= 2) return [Number(v[0]), Number(v[1])];
  const parts = String(v).split(',');
  if (parts.length < 2) return null;
  const lon = Number(parts[0]);
  const lat = Number(parts[1]);
  return isFinite(lon) && isFinite(lat) ? [lon, lat] : null;
}

/**
 * 查询一个行政区；child=1 时连下级一起返回。
 *
 * @param {object} opts { code?, keyword?, child?, tk?, log?, delayMs? }
 * @returns {Promise<{raw:object, url:string, items:Array}>}
 */
async function fetchDistrict(opts) {
  const { tk, delayMs } = resolveKey(opts.tk);
  const log = opts.log || (() => {});

  const params = new URLSearchParams();
  if (opts.code) params.set('code', String(opts.code));
  if (opts.keyword) params.set('keyword', String(opts.keyword));
  params.set('child', opts.child ? '1' : '0');
  params.set('tk', tk); // 注意：tk 放最后，日志里不要整个打印出来
  const url = API_BASE + '?' + params.toString();

  const safeUrl = url.replace(/tk=[^&]+/, 'tk=***');
  const tried = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      log('请求天地图：' + safeUrl + (attempt > 1 ? '（第 ' + attempt + ' 次）' : ''));
      const raw = await httpGetJson(url);

      // 天地图的错误码在 code 字段；0 / 200 视为成功
      if (raw && raw.code !== undefined && Number(raw.code) !== 0 && Number(raw.code) !== 200) {
        const code = Number(raw.code);
        const fatal = FATAL_CODES[code];
        const err = new Error('天地图返回错误 ' + code + '：' + (raw.msg || '') +
          (fatal ? '\n  → ' + fatal : '') +
          (raw.resolve ? '\n  → 官方建议：' + raw.resolve : ''));
        err.fatal = !!fatal; // 致命错误不重试
        throw err;
      }

      const items = collectBoundaryItems(raw.data !== undefined ? raw.data : raw)
        .map((it) => ({ ...it, center: parseCenter(it.center) }));

      return { raw, url: safeUrl, items };
    } catch (err) {
      if (err.fatal) throw err; // Key/配额/参数问题：重试只是白烧配额
      tried.push('第 ' + attempt + ' 次：' + err.message);
      if (attempt === MAX_ATTEMPTS) {
        throw new Error('天地图请求失败（已尝试 ' + MAX_ATTEMPTS + ' 次，不再重试）：\n  ' +
          tried.join('\n  '));
      }
      await sleep(delayMs); // 红线：失败之间要有延时，不许贴着打
    }
  }

  throw new Error('不该走到这里');
}

/**
 * 取「某行政区 + 它的下级」的完整 GeoJSON。
 * child=1 一次就能把下级连边界一起拿回来（若接口没给下级边界，返回的 items 会少，
 * 调用方据此决定要不要逐个补 —— 这部分等真 Key 验证后再定策略）。
 */
async function fetchTianDiTuGeo(adcode, opts) {
  const { items, url, raw } = await fetchDistrict({ ...opts, code: adcode, child: true });
  if (!items.length) {
    throw new Error('天地图没有返回任何边界数据（adcode ' + adcode + '）。' +
      '原始响应片段：' + JSON.stringify(raw).slice(0, 200));
  }
  const geo = wkt.toFeatureCollection(items);
  return { geo, url, itemCount: items.length };
}

/** 带节流的批量查询：给批量脚本用（顺序 + 固定延时，绝不并发轰接口） */
function createThrottle(delayMs) {
  let last = 0;
  return async function wait() {
    const gap = Date.now() - last;
    if (gap < delayMs) await sleep(delayMs - gap);
    last = Date.now();
  };
}

module.exports = {
  API_BASE,
  CONFIG_FILE,
  DEFAULT_DELAY_MS,
  MAX_ATTEMPTS,
  FATAL_CODES,
  loadConfig,
  resolveKey,
  fetchDistrict,
  fetchTianDiTuGeo,
  collectBoundaryItems,
  parseCenter,
  createThrottle,
};
