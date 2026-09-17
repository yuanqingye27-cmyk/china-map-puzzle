'use strict';
/* =====================================================================
 * 公共库 · 从官方边界几何计算面积
 * ---------------------------------------------------------------------
 * 路径：tools/lib/geo-area.js
 *
 * 【为什么要有这个】
 * 资料卡要填 `area`（km²），但天地图官方行政区划数据只给
 * `adcode / name / center`，**不带面积**。人工去各处抄面积有三个问题：
 *   1. 口径混乱（全域 / 直管 / "三调" / 含托管区，各源不一样）
 *   2. 抄错没人能发现
 *   3. 逐条抄，218 条要抄到明年
 *
 * 而项目里**已经有官方边界几何**了 —— 面积本来就是几何的属性。
 * 用球面多边形面积公式（与 d3.geoArea 同一个公式）直接算，
 * 结果可复现、可复核、可批量，且与拼图用的边界严格一致。
 *
 * 【实测精度】（乐山 11 个区县，与政府官网公布的数值比对）
 *   五通桥区   计算 465    官方 465    ✅ 完全一致
 *   峨边自治县 计算 2383   官方 2382   ✅ 差 1 km²
 *   11 区县合计 计算 12741  官方 1.27 万 ✅ 一致
 * 说明：差异来自边界的制图综合（官方制图会略去小碎岛/简化海岸线）。
 * **因此产物必须在文件头声明"几何计算值"，不能冒充官方公布值。**
 * ===================================================================== */

/** 平均地球半径（m），与 d3 / shapely 的 WGS84 球面近似一致 */
const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * 球面多边形环的有符号面积（球面度）。
 * 公式：Σ (λ_{i+1} − λ_{i−1}) · sin(φ_i) / 2 —— d3.geoArea 用的就是这个。
 */
function ringArea(ring) {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[(i + n - 1) % n];
    const [, y1] = ring[i];
    const [x2] = ring[(i + 1) % n];
    total += (toRad(x2) - toRad(x0)) * Math.sin(toRad(y1));
  }
  return total / 2;
}

/** 单个多边形（外环 − 孔洞）的面积，单位 m² */
function polygonArea(polygon) {
  let a = Math.abs(ringArea(polygon[0]));
  for (let i = 1; i < polygon.length; i++) a -= Math.abs(ringArea(polygon[i]));
  return Math.max(0, a) * EARTH_RADIUS_M * EARTH_RADIUS_M;
}

/** GeoJSON Geometry 的面积，单位 km² */
function geometryAreaKm2(geometry) {
  if (!geometry) return 0;
  if (geometry.type === 'Polygon') return polygonArea(geometry.coordinates) / 1e6;
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce((s, p) => s + polygonArea(p), 0) / 1e6;
  }
  return 0;
}

/**
 * 把面积规整成资料卡里好看的数字：
 *   ≥ 100 km² → 取整（465、2383）
 *   < 100 km² → 保留一位小数（62.0）
 * 与引擎 formatArea() 的展示口径一致（整数原样、否则一位小数）。
 */
function roundArea(km2) {
  return km2 >= 100 ? Math.round(km2) : Math.round(km2 * 10) / 10;
}

/** 从一份 FeatureCollection 算出 { adcode: 面积 } */
function areasFromFeatureCollection(fc) {
  const out = {};
  const features = (fc && fc.features) || [];
  features.forEach((f) => {
    const adcode = f.properties && f.properties.adcode;
    if (!adcode) return;
    out[adcode] = roundArea(geometryAreaKm2(f.geometry));
  });
  return out;
}

/**
 * 精度锚点：拿"官方公开公布过"的数值来校验计算方法。
 * 只放**能追到出处**的数字，用于自检，不参与写数据。
 */
const REFERENCE_ANCHORS = [
  {
    label: '乐山市 · 五通桥区',
    adcode: 511112,
    official: 465,
    tolerance: 1,
    source: '乐山市人民政府网《走进乐山 · 自然资源》：幅员面积最小的是五通桥区，为465平方公里',
  },
  {
    label: '乐山市 · 峨边彝族自治县',
    adcode: 511132,
    official: 2382,
    tolerance: 2,
    source: '同上：幅员面积最大的是峨边彝族自治县、为2382平方公里',
  },
  {
    label: '乐山市 · 全市合计',
    adcode: null,
    official: 12700,
    tolerance: 200,
    source: '同上：全市幅员面积为1.27万平方公里（应为 11 个区县之和）',
    sumOf: 511100,
  },
  /* ---- 地级市这一层的锚点（面积写在省包 china/sichuan.data.js 里） ---- */
  {
    label: '绵阳市',
    adcode: 510700,
    official: 20200,
    tolerance: 100,
    source: '百科条目引官方口径：辖区面积 2.02 万平方千米',
  },
  {
    label: '南充市',
    adcode: 511300,
    official: 12482,
    tolerance: 30,
    source: '百科条目引官方口径：总面积 12482 平方千米',
  },
];

module.exports = {
  EARTH_RADIUS_M,
  ringArea,
  polygonArea,
  geometryAreaKm2,
  roundArea,
  areasFromFeatureCollection,
  REFERENCE_ANCHORS,
};
