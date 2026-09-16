/* =====================================================================
 * 成都地图拼图 · 投影与几何构建
 * ---------------------------------------------------------------------
 * 这里手写 Web Mercator 投影，不引入 d3-geo。原因：
 *   1. 整个项目要零依赖 —— 双击 index.html 就能玩，不需要 npm / 服务器
 *   2. 用到的地理计算只有"经纬度 → 平面坐标"这一件事，自己写 20 行就够
 *
 * 输出的所有坐标都落在同一个 SVG viewBox 坐标系里，
 * 于是：地图用的 path 和碎片用的 path 可以是同一份数据，
 *      碎片只要把 viewBox 设成自己的 bbox 就能单独渲染出来。
 * ===================================================================== */

(function (global) {
  'use strict';

  const DEG = Math.PI / 180;

  /**
   * 经纬度 → 墨卡托平面坐标。
   * 返回值是两个"弧度级"的小数（还没缩放），后面统一靠 fit() 缩放到画布上。
   *
   * ⚠️ y 必须取负号，这不是笔误：
   * 墨卡托的原始公式 y = ln(tan(π/4 + φ/2)) 属于【数学坐标系】，那里 y 轴朝上，
   * 所以纬度越高 y 越大 = 越靠北，本身是对的。
   * 但 SVG 的 y 轴是朝【下】的，直接把这个 y 当 SVG 坐标用，整张地图就会南北颠倒
   * （彭州会跑到蒲江下面）。取负号后，纬度越高 y 越小 → 画在画布上方，方向才正确。
   * 经度方向无需处理：经度越大 x 越大 → 越靠右，和 SVG 一致。
   */
  function project(lon, lat) {
    return [lon * DEG, -Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2))];
  }

  /** 鞋带公式：多边形有向面积（投影坐标系下的相对面积，非真实平方公里） */
  function shoelace(ring) {
    let sum = 0;
    for (let i = 0, n = ring.length; i < n; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % n];
      sum += x1 * y2 - x2 * y1;
    }
    return sum / 2;
  }

  /** 多边形质心（面积加权）。比 bbox 中心更贴合 L 形、环形这类不规则形状 */
  function centroid(ring) {
    let cx = 0;
    let cy = 0;
    let a = 0;
    for (let i = 0, n = ring.length; i < n; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % n];
      const cross = x1 * y2 - x2 * y1;
      a += cross;
      cx += (x1 + x2) * cross;
      cy += (y1 + y2) * cross;
    }
    if (Math.abs(a) < 1e-12) return ring[0].slice(); // 退化情况：退回首个顶点
    return [cx / (3 * a), cy / (3 * a)];
  }

  /** 把一串点拼成 SVG path 的 d 字符串；舍入到 0.1 已远超屏幕像素精度 */
  const fmt = (n) => (Math.round(n * 10) / 10).toString();

  function ringToPath(ring) {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
      d += (i === 0 ? 'M' : 'L') + fmt(ring[i][0]) + ' ' + fmt(ring[i][1]);
    }
    return d + 'Z';
  }

  /**
   * 构建整张成都地图。
   *
   * @param {object} geo      GeoJSON FeatureCollection（window.CHENGDU_GEO）
   * @param {object} [options]
   * @param {number} [options.width=1000] 画布逻辑宽度（高度按地理比例自动推算）
   * @param {number} [options.padding=14] 画布四周留白
   * @returns {{width:number, height:number, viewBox:string, districts:Array}}
   */
  function buildGeoMap(geo, options) {
    const width = (options && options.width) || 1000;
    const padding = (options && options.padding) || 14;

    // ---- 1. 投影所有顶点，顺便记录全局包围盒 ----------------------------
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const shapes = geo.features.map((feature) => {
      const polygons = feature.geometry.coordinates.map((polygon) =>
        polygon.map((ring) =>
          ring.map(([lon, lat]) => {
            const p = project(lon, lat);
            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[1] > maxY) maxY = p[1];
            return p;
          })
        )
      );
      return { props: feature.properties, polygons };
    });

    // ---- 2. 等比缩放，让内容正好铺满画布宽度 ----------------------------
    const innerW = width - padding * 2;
    const scale = innerW / (maxX - minX);
    const height = (maxY - minY) * scale + padding * 2;

    const toCanvas = ([x, y]) => [
      (x - minX) * scale + padding,
      (y - minY) * scale + padding,
    ];

    // ---- 3. 逐个区县生成 path / bbox / 质心 / 面积 ----------------------
    const districts = shapes.map(({ props, polygons }) => {
      let d = '';
      let bx0 = Infinity;
      let by0 = Infinity;
      let bx1 = -Infinity;
      let by1 = -Infinity;
      let area = 0;

      // 质心取"最大的一块"来算，避免飞地被其他小块拉偏
      let mainRing = null;
      let mainRingArea = -1;

      polygons.forEach((polygon) => {
        polygon.forEach((ring, ringIndex) => {
          const canvasRing = ring.map(toCanvas);
          d += ringToPath(canvasRing);

          for (const [x, y] of canvasRing) {
            if (x < bx0) bx0 = x;
            if (x > bx1) bx1 = x;
            if (y < by0) by0 = y;
            if (y > by1) by1 = y;
          }

          // 第 0 环是外环，其余是空洞（相减）
          const signed = Math.abs(shoelace(canvasRing));
          area += ringIndex === 0 ? signed : -signed;
          if (ringIndex === 0 && signed > mainRingArea) {
            mainRingArea = signed;
            mainRing = canvasRing;
          }
        });
      });

      const bbox = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };
      const center = centroid(mainRing || [[bx0, by0]]);

      return {
        adcode: props.adcode,
        name: props.name,
        d,
        bbox,
        center,
        area: Math.abs(area),
      };
    });

    return {
      width,
      height,
      viewBox: `0 0 ${fmt(width)} ${fmt(height)}`,
      districts,
    };
  }

  global.GeoMap = { project, buildGeoMap };
})(window);
