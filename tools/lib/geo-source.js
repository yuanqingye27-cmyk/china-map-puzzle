'use strict';
/* =====================================================================
 * 公共库 · 地图数据源抽象
 * ---------------------------------------------------------------------
 * 路径：tools/lib/geo-source.js
 *
 * 为什么要有这一层：数据源会换（DataV → 天地图 → 也许还有别的），
 * 而"下载 → 规范化 → 写文件"的流程不该跟着改。把差异收口在 provider 里，
 * 换源就是加一个对象 + 命令行加一个 --source=xxx。
 *
 * 每个 provider 统一返回：
 *   {
 *     geo,        // 规范化后的 FeatureCollection（引擎直接吃）
 *     url,        // 数据来源（URL 或本地文件路径），会写进产物做溯源
 *     source: {   // 会写进 MAP_GEO_META，页面上的"数据来源/审图号"声明读它
 *       provider, label, approval, note
 *     }
 *   }
 *
 * 【审图号的关键约定】
 *   `approval` 是**这份数据自己的审图号**，没有就是 null。
 *   页面上的声明必须由它驱动 —— 数据是 DataV 却标天地图的审图号，
 *   那不是"合规"，那是伪造合规声明，比不写更糟。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const geoLib = require('./inline-geo');
const tianditu = require('./tianditu-geo');
const wkt = require('./wkt');
const slugs = require('./slugs');

/** 数据源清单。新增一个源 = 往这里加一项 */
const PROVIDERS = {
  /* ---- 阿里云 DataV.GeoAtlas：开发期的数据源，**没有审图号** ---- */
  datav: {
    id: 'datav',
    label: '阿里云 DataV.GeoAtlas',
    approval: null,
    note: '开发期数据源，未取得审图号，不可用于公开商用',
    async fetchGeo(adcode, opts) {
      const r = await geoLib.fetchDatavGeo(adcode, { log: opts && opts.log });
      return {
        geo: geoLib.normalizeGeo(r.raw, r.url),
        url: r.url,
        source: {
          provider: this.id,
          label: this.label,
          approval: this.approval,
          note: this.note,
        },
      };
    },
  },

  /* ---- 天地图（国家地理信息公共服务平台）：目标数据源 ---- */
  tianditu: {
    id: 'tianditu',
    label: '国家地理信息公共服务平台（天地图）',
    approval: 'GS(2024)0650号',
    note: '需开发者 Key；边界为接口返回的 WKT，经 tools/lib/wkt.js 转换',
    async fetchGeo(adcode, opts) {
      const r = await tianditu.fetchTianDiTuGeo(adcode, {
        tk: opts && opts.tk,
        log: opts && opts.log,
      });
      return {
        geo: r.geo,
        url: r.url,
        source: {
          provider: this.id,
          label: this.label,
          approval: this.approval,
          note: this.note,
        },
      };
    },
  },

  /* ---- 本地官方数据包：天地图/标准地图发布的带审图号数据集 ----
   * 两种用法：
   *   --dir=<目录>   目录下按 <adcode>.json / <adcode>_full.json 找
   *   --file=<文件>  一个大的 FeatureCollection，按 adcode 层级规则挑出下级
   * 之所以支持它：官方发布的**行政区划数据包**自带审图号，
   * 且没有 API 配额与"逐区县请求"的限制，批量替换时更稳。 */
  file: {
    id: 'file',
    label: '本地官方行政区划数据包',
    approval: '（以数据包自带为准，需人工确认）',
    note: '由 --dir / --file 指定；请确认为带审图号的官方数据',
    async fetchGeo(adcode, opts) {
      const dir = opts && opts.dir;
      const file = opts && opts.file;
      if (!dir && !file) {
        throw new Error('file 数据源需要 --dir=<目录> 或 --file=<GeoJSON 文件>');
      }

      /* 如果目录里有 manifest.json（tianditu-download.js 写的），
       * 就用它里面的来源与审图号 —— 声明跟着数据走，不自作主张。 */
      let manifest = null;
      if (dir) {
        const mf = path.join(dir, 'manifest.json');
        if (fs.existsSync(mf)) {
          try { manifest = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch (e) { manifest = null; }
        }
      }

      let raw = null;
      let url = '';
      if (file) {
        url = path.resolve(file);
        raw = JSON.parse(fs.readFileSync(url, 'utf8'));
      } else {
        const candidates = [
          adcode + '_full.json',
          adcode + '.json',
          adcode + '.geojson',
          adcode + '_full.geojson',
        ];
        for (const name of candidates) {
          const p = path.join(dir, name);
          if (fs.existsSync(p)) { url = p; raw = JSON.parse(fs.readFileSync(p, 'utf8')); break; }
        }
        if (!raw) {
          throw new Error('在 ' + dir + ' 里没找到 ' + adcode + ' 的数据（试过：' + candidates.join('、') + '）');
        }
      }

      const fc = raw.type === 'FeatureCollection' ? raw : (raw.data || raw);
      if (!fc || !Array.isArray(fc.features)) {
        throw new Error('不是 FeatureCollection：' + url);
      }

      /* 单个大文件：按 adcode 的层级规则挑出"直接下级"。
       *   100000 → 省级（XX0000）　　510000 → 四川的市（51XX00）　　510100 → 成都的区县（5101XX）
       * 规则是纯算术，所以不需要数据里额外带 parent 字段。 */
      const isDirectChild = (child) => {
        if (child === adcode) return false;
        if (adcode === 100000) return child % 10000 === 0;
        if (adcode % 10000 === 0) return Math.floor(child / 10000) === adcode / 10000;
        if (adcode % 100 === 0) return Math.floor(child / 100) === adcode / 100;
        return false;
      };
      const children = fc.features.filter((f) => {
        const a = Number(f.properties && (f.properties.adcode || f.properties.code));
        return isFinite(a) && isDirectChild(a);
      });

      const picked = children.length ? children : fc.features;
      return {
        geo: geoLib.normalizeGeo({ type: 'FeatureCollection', features: picked }, url),
        url,
        source: {
          provider: this.id,
          label: manifest ? (manifest.providerLabel || this.label) : this.label,
          approval: manifest ? (manifest.approval || this.approval) : this.approval,
          note: manifest
            ? ('官方数据抓取副本（' + (manifest.generatedAt || '').slice(0, 10) + '）' +
               (manifest.approvalNote ? '；' + manifest.approvalNote : ''))
            : this.note,
        },
      };
    },
  },
};

/** 当前项目默认用哪个源（还没换完之前保持 datav，避免把已有 23 张图搞乱） */
const DEFAULT_SOURCE = 'datav';

function getProvider(name) {
  const id = name || DEFAULT_SOURCE;
  const p = PROVIDERS[id];
  if (!p) {
    throw new Error('未知的地图数据源「' + id + '」。可用：' + Object.keys(PROVIDERS).join('、'));
  }
  return p;
}

/** 数据源清单（给 CLI 打印用） */
function listProviders() {
  return Object.keys(PROVIDERS).map((id) => ({
    id,
    label: PROVIDERS[id].label,
    approval: PROVIDERS[id].approval,
    note: PROVIDERS[id].note,
  }));
}

module.exports = {
  PROVIDERS,
  DEFAULT_SOURCE,
  getProvider,
  listProviders,
};
