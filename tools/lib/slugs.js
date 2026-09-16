'use strict';
/* =====================================================================
 * 公共库 · 地图包命名（adcode ↔ 拼音 slug）
 * ---------------------------------------------------------------------
 * 路径：tools/lib/slugs.js
 *
 * 为什么需要"表"：地图包的 id / 目录名 / 文件名用的是英文 slug（`zigong`），
 * 而 adcode 只给得出数字（510300），中文名只给得出汉字（自贡市）——
 * 拼音没法从这两样推出来，除非引一个拼音库（违背"零依赖"）。
 * 所以这里维护几张**小表**，其余一律走可预测的兜底命名。这和 add-map.js
 * 里原有的 PROVINCE_SLUGS 是同一个思路，只是搬到了公共库里让批量脚本也能用。
 *
 * 兜底规则：表里查不到就用 `map-<adcode>`。
 * 它不好看，但**一定能用**：批量接入一张陌生地图时不会因为"起不出名字"而失败，
 * 报告里会把"这个 slug 是自动兜底的、建议人工改成拼音"单独列出来。
 * ===================================================================== */

/** 省级：adcode 前两位 → slug */
const PROVINCE_SLUGS = {
  11: 'beijing', 12: 'tianjin', 13: 'hebei', 14: 'shanxi', 15: 'neimenggu',
  21: 'liaoning', 22: 'jilin', 23: 'heilongjiang',
  31: 'shanghai', 32: 'jiangsu', 33: 'zhejiang', 34: 'anhui', 35: 'fujian',
  36: 'jiangxi', 37: 'shandong',
  41: 'henan', 42: 'hubei', 43: 'hunan', 44: 'guangdong', 45: 'guangxi', 46: 'hainan',
  50: 'chongqing', 51: 'sichuan', 52: 'guizhou', 53: 'yunnan', 54: 'xizang',
  61: 'shaanxi', 62: 'gansu', 63: 'qinghai', 64: 'ningxia', 65: 'xinjiang',
  71: 'taiwan', 81: 'hongkong', 82: 'macau',
};

/**
 * 地级（adcode → slug）。按省逐步补：先做四川这一轮批量验证用到的 21 个。
 * 每补一个省，只在这里加几行 —— 不动任何逻辑。
 */
const CITY_SLUGS = {
  // ---- 四川省 21 个市州 ----
  510100: 'chengdu',
  510300: 'zigong',
  510400: 'panzhihua',
  510500: 'luzhou',
  510600: 'deyang',
  510700: 'mianyang',
  510800: 'guangyuan',
  510900: 'suining',
  511000: 'neijiang',
  511100: 'leshan',
  511300: 'nanchong',
  511400: 'meishan',
  511500: 'yibin',
  511600: 'guangan',
  511700: 'dazhou',
  511800: 'yaan',
  511900: 'bazhong',
  512000: 'ziyang',
  513200: 'aba',
  513300: 'ganzi',
  513400: 'liangshan',
};

const CHINA = { slug: 'china', adcode: 100000, parentSlug: null };

const slugToProvinceAdcode = (slug) => {
  const hit = Object.keys(PROVINCE_SLUGS).find((k) => PROVINCE_SLUGS[k] === slug);
  return hit ? Number(hit) * 10000 : null;
};

/** slug 是否合法（= 能不能当文件名 / 目录名 / URL 参数） */
const isValidSlug = (slug) => /^[a-z][a-z0-9_-]*$/.test(slug || '');

/**
 * 给一个 adcode 起名字。
 * @returns {{slug:string, source:'table'|'fallback'}}
 *   source='fallback' 表示表里没有、用了 `map-<adcode>`，报告里会提醒人工改名
 */
function slugForAdcode(adcode) {
  if (adcode === CHINA.adcode) return { slug: CHINA.slug, source: 'table' };
  const prov = PROVINCE_SLUGS[String(adcode).slice(0, 2)];
  const isProvince = adcode % 10000 === 0;
  if (isProvince && prov) return { slug: prov, source: 'table' };
  if (CITY_SLUGS[adcode]) return { slug: CITY_SLUGS[adcode], source: 'table' };
  return { slug: 'map-' + adcode, source: 'fallback' };
}

/**
 * 由 adcode 推断它该挂在哪个父级下面（只知道"层级"，不知道父级的 slug）。
 * @returns {{parentAdcode:number, level:'country'|'province'|'city'|'county'}}
 */
function parentAdcodeOf(adcode) {
  if (adcode === CHINA.adcode) return { parentAdcode: null, level: 'country' };
  if (adcode % 10000 === 0) return { parentAdcode: CHINA.adcode, level: 'province' };
  if (adcode % 100 === 0) return { parentAdcode: Math.floor(adcode / 10000) * 10000, level: 'city' };
  return { parentAdcode: Math.floor(adcode / 100) * 100, level: 'county' };
}

module.exports = {
  PROVINCE_SLUGS,
  CITY_SLUGS,
  CHINA,
  slugToProvinceAdcode,
  isValidSlug,
  slugForAdcode,
  parentAdcodeOf,
};
