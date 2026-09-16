/**
 * 构建脚本：把阿里 DataV 的成都 GeoJSON 精简成前端可直接用的
 * js/maps/china/sichuan/chengdu.geo.js
 *
 * 为什么内联成 .js 而不是放 .json？
 * 因为 index.html 要支持本地双击（file:// 协议）打开，
 * 而 file:// 下浏览器会拦截对本地 .json 的 fetch 请求（CORS）。
 * 内联成普通 script 就没有这个问题，整个游戏零依赖、零服务器。
 *
 * 产物写进 window.MAP_GEO.chengdu（而不是过去的 window.CHENGDU_GEO）：
 * 地图包按 id 往共享命名空间里登记，一套命名空间养无限多张地图。
 *
 * ⚠️ 自动化接入新地图请看 tools/add-map.js（它会调用等价逻辑并顺带
 *    生成资料文件、改注册表）。本脚本只负责成都这一张，保留用于重刷。
 *
 * 用法：node tools/build-data.js [源 GeoJSON 路径]
 */

const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || '/tmp/cd_full.json';
const OUT = path.join(__dirname, '..', 'js', 'maps', 'china', 'sichuan', 'chengdu.geo.js');

// 经纬度保留 5 位小数 ≈ 1 米精度，肉眼和像素级渲染都完全够用，
// 但能把文件体积压下来不少。
const PRECISION = 5;

const round = (n) => Number(n.toFixed(PRECISION));
const roundRing = (ring) => ring.map(([lon, lat]) => [round(lon), round(lat)]);

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const features = raw.features.map((f) => {
  const geo = f.geometry;
  const polygons =
    geo.type === 'MultiPolygon' ? geo.coordinates : [geo.coordinates];

  return {
    type: 'Feature',
    properties: {
      adcode: f.properties.adcode,
      name: f.properties.name,
      // center 是 DataV 给的标注点，用作信息卡定位的兜底
      center: f.properties.center.map(round),
    },
    geometry: {
      type: 'MultiPolygon',
      // 每个 polygon 是 [外环, ...内环(空洞)]
      coordinates: polygons.map((poly) => poly.map(roundRing)),
    },
  };
});

const out = {
  type: 'FeatureCollection',
  // 数据来源标注，方便回溯
  source: 'https://geo.datav.aliyun.com/areas_v3/bound/510100_full.json',
  features,
};

const body = JSON.stringify(out);
const js =
  '/* 自动生成，请勿手改。重新生成：node tools/build-data.js */\n' +
  '/* 数据来源：阿里云 DataV.GeoAtlas 成都市（adcode 510100）行政区划边界 */\n' +
  '(window.MAP_GEO = window.MAP_GEO || {}).chengdu = ' +
  body +
  ';\n';

fs.writeFileSync(OUT, js, 'utf8');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`✔ 已生成 ${path.relative(process.cwd(), OUT)}`);
console.log(`  区县数量：${features.length}`);
console.log(`  文件体积：${kb(Buffer.byteLength(js))}（原始 ${kb(fs.statSync(SRC).size)}）`);
