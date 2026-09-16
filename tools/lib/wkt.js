'use strict';
/* =====================================================================
 * 公共库 · WKT / 坐标串 → GeoJSON
 * ---------------------------------------------------------------------
 * 路径：tools/lib/wkt.js
 *
 * 为什么需要它：天地图的行政区划接口**不返回 GeoJSON**，返回的是
 *   boundary: "MULTIPOLYGON(((116.1 39.1, 116.2 39.2, ...)))"   ← WKT
 * 而本项目的引擎只吃 GeoJSON 的 Polygon / MultiPolygon。
 * 所以中间必须有这一层转换，本文件就是它。
 *
 * 还兼容一种老格式：早期接口返回的是纯坐标串
 *   "116.1,39.1;116.2,39.2;..."        （分号分隔点，多个面用 | 分隔）
 * 两种都吃，因为不同接口/不同版本给的形态并不统一。
 *
 * ⚠️ 这个文件**不联网**，是纯字符串 → 对象的转换，所以可以用真实样例
 *    离线测透（见 tools/test-wkt.js）。恰恰因为天地图要 Key 才能调，
 *    把"能测的部分"和"必须联网的部分"分开写，才不会整块卡住。
 * ===================================================================== */

/** 只允许数字、正负号、小数点、指数 —— 防止把畸形输入当数字读进来 */
const NUM_CHARS = /[-0-9.eE+]/;

/**
 * 递归下降解析 WKT 里的括号组。
 * `((a b, c d), (e f))` 这种嵌套结构会被解析成嵌套数组，
 * POLYGON 与 MULTIPOLYGON 的区别只是嵌套深度不同，解析完再对号入座。
 */
function parseGroup(str, i) {
  const items = [];
  i++; // 跳过 '('
  for (;;) {
    while (str[i] === ' ' || str[i] === '\n' || str[i] === '\r' || str[i] === '\t') i++;

    if (str[i] === '(') {
      const inner = parseGroup(str, i);
      items.push(inner.value);
      i = inner.next;
    } else {
      // 读一对 "lon lat"
      let j = i;
      while (j < str.length && NUM_CHARS.test(str[j])) j++;
      const lon = Number(str.slice(i, j));
      while (str[j] === ' ') j++;
      let k = j;
      while (k < str.length && NUM_CHARS.test(str[k])) k++;
      const lat = Number(str.slice(j, k));

      if (!isFinite(lon) || !isFinite(lat)) {
        throw new Error('WKT 里读不出坐标（位置 ' + i + '）：' + str.slice(Math.max(0, i - 20), i + 20));
      }
      items.push([lon, lat]);
      i = k;
    }

    while (str[i] === ' ' || str[i] === '\n' || str[i] === '\r' || str[i] === '\t') i++;
    if (str[i] === ',') { i++; continue; }
    if (str[i] === ')') { i++; return { value: items, next: i }; }
    throw new Error('WKT 结构异常（位置 ' + i + '）：' + str.slice(Math.max(0, i - 20), i + 20));
  }
}

/** 环首尾必须重合，否则 isPointInFill 会出怪事 —— 这里统一补上 */
function closeRing(ring) {
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return ring.concat([first.slice()]);
  return ring;
}

/** 老格式："lon,lat;lon,lat;…"，多个面用 | 分隔 */
function parseLegacyBoundary(text) {
  const parts = text.split('|').map((seg) =>
    seg.split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [lon, lat] = pair.split(',').map(Number);
        if (!isFinite(lon) || !isFinite(lat)) {
          throw new Error('坐标串里读不出数字：' + pair);
        }
        return [lon, lat];
      })
      .filter((p) => p.length === 2)
  // 至少 3 个顶点才构成面（闭合点由 closeRing 补，所以这里是 3 而不是 4）
  ).filter((ring) => ring.length >= 3);

  if (!parts.length) throw new Error('坐标串里没有有效的环');

  return parts.length === 1
    ? { type: 'Polygon', coordinates: [closeRing(parts[0])] }
    : { type: 'MultiPolygon', coordinates: parts.map((r) => [closeRing(r)]) };
}

/**
 * WKT → GeoJSON geometry（只返回 geometry，不含 properties）。
 *
 * 支持 POLYGON / MULTIPOLYGON / LINESTRING / MULTILINESTRING / POINT，
 * 带不带 `SRID=4326;` 前缀都行。天地图用的是前两种。
 */
function parseWkt(input) {
  const raw = String(input == null ? '' : input).trim();
  if (!raw) throw new Error('WKT 是空的');

  // 老格式：不含字母，只有数字和 , ; |
  if (!/[A-Za-z]/.test(raw)) return parseLegacyBoundary(raw);

  const s = raw.replace(/^SRID=\d+;/i, '');
  const m = /^(MULTIPOLYGON|POLYGON|MULTILINESTRING|LINESTRING|POINT)\s*/i.exec(s);
  if (!m) {
    throw new Error('认不出的 WKT 类型：' + s.slice(0, 40));
  }
  const type = m[1].toUpperCase();
  const parsed = parseGroup(s, m[0].length);
  const v = parsed.value;

  if (type === 'POINT') {
    // POINT (lon lat) → 解析出来是 [lon, lat]
    return { type: 'Point', coordinates: v };
  }
  if (type === 'LINESTRING') {
    return { type: 'LineString', coordinates: v };
  }
  if (type === 'MULTILINESTRING') {
    return { type: 'MultiLineString', coordinates: v };
  }
  if (type === 'POLYGON') {
    return { type: 'Polygon', coordinates: v.map(closeRing) };
  }
  // MULTIPOLYGON
  return { type: 'MultiPolygon', coordinates: v.map((poly) => poly.map(closeRing)) };
}

/* ============================ 与项目约定的桥接 ============================ */

/** 从几何里挑一个"看起来像中心"的点：取最大环的顶点平均（够用且不依赖投影库） */
function roughCenter(geometry) {
  const rings = geometry.type === 'MultiPolygon'
    ? geometry.coordinates.map((poly) => poly[0]).filter(Boolean)
    : geometry.coordinates;
  let best = null;
  rings.forEach((ring) => {
    if (!best || ring.length > best.length) best = ring;
  });
  if (!best || !best.length) return null;

  /* 去掉结尾那个与首点重合的闭合点再平均 —— 否则那个重复点会把中心往首点方向拽
   * （这是实测踩到的：正方形本该是 (104.5, 30.5)，带上闭合点就偏成 (104.4, 30.4)） */
  const pts = best.slice();
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) pts.pop();
  }

  let sx = 0;
  let sy = 0;
  pts.forEach(([x, y]) => { sx += x; sy += y; });
  return [Number((sx / pts.length).toFixed(5)), Number((sy / pts.length).toFixed(5))];
}

/**
 * 把一批「行政区 → 边界字符串」组装成项目要的 FeatureCollection。
 *
 * @param {Array<{adcode:number|string, name:string, boundary?:string, geometry?:object}>} items
 * @param {object} [opts] { precision?:number }
 * @returns {object} FeatureCollection（features[].properties 带 adcode / name / center）
 */
function toFeatureCollection(items, opts) {
  const precision = opts && typeof opts.precision === 'number' ? opts.precision : 5;
  const round = (n) => Number(n.toFixed(precision));
  const roundRing = (ring) => ring.map(([x, y]) => [round(x), round(y)]);

  const features = items.map((it) => {
    const geometry = it.geometry || parseWkt(it.boundary);
    const coords = geometry.type === 'MultiPolygon'
      ? geometry.coordinates.map((poly) => poly.map(roundRing))
      : geometry.type === 'Polygon'
        ? geometry.coordinates.map(roundRing)
        : geometry.coordinates;

    // 引擎只吃 Polygon / MultiPolygon；线/点这类没法当拼图块，明确报错而不是默默塞进去
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      throw new Error((it.name || it.adcode) + ' 的边界是 ' + geometry.type +
        '，不是面（Polygon/MultiPolygon），无法作为拼图块');
    }

    const normalized = { type: geometry.type, coordinates: coords };
    return {
      type: 'Feature',
      properties: {
        adcode: it.adcode,
        name: it.name,
        center: it.center || roughCenter(normalized),
      },
      geometry: normalized,
    };
  });

  return { type: 'FeatureCollection', features };
}

module.exports = {
  parseWkt,
  parseLegacyBoundary,
  toFeatureCollection,
  closeRing,
  roughCenter,
};
