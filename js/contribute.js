/* =====================================================================
 * 众包纠错 · 纯逻辑层（不碰 DOM，可在 Node 里直接单测）
 * ---------------------------------------------------------------------
 * 路径：js/contribute.js
 *
 * 【为什么要有这个文件】
 *   全国 3200+ 个区县，靠一个人查资料是查不完的 —— 这是项目最大的成本。
 *   唯一的零成本解法是：让"发现错误的人"顺手把错误写下来。
 *
 * 【为什么不做后端】
 *   一个提交接口 = 一台服务器 + 一个数据库 + 一套审核 = 要钱、要备案、要运维。
 *   所以这里只做一件事：**把用户看到的那张资料卡，拼成一段结构化文本**，
 *   然后交给用户手上已有的通道发出去 —— GitHub Issue / 邮件 / 剪贴板。
 *   站点本身永远是纯静态的，零成本这条线不能破。
 *
 * 【配置】仓库地址和邮箱不写死在这里，而是由 index.html 里的
 *   window.MAP_PUZZLE_CONTRIB 传入（见 index.html 顶部），换仓库不用改代码。
 * ===================================================================== */

(function (global) {
  'use strict';

  /** 默认配置：没配 repo 时按钮会自动降级成"复制到剪贴板"，不会给出死链 */
  const DEFAULT_CONF = { repo: '', email: '', site: '' };

  let CONF = Object.assign({}, DEFAULT_CONF, global.MAP_PUZZLE_CONTRIB || {});

  /** 字段名 → 中文标签。顺序就是卡片上的展示顺序 */
  const FIELD_LABEL = {
    area: '面积',
    landmark: '地标',
    tagline: '一句话介绍',
    funFact: '冷知识',
  };

  const FIELD_ORDER = Object.keys(FIELD_LABEL);

  function configure(next) {
    CONF = Object.assign({}, CONF, next || {});
    return Object.assign({}, CONF);
  }

  function config() {
    return Object.assign({}, CONF);
  }

  /** repo 配成 "owner/name" 才算可用；其余情况一律走剪贴板 */
  function isRepoReady() {
    return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(String(CONF.repo || '').trim());
  }

  function isEmailReady() {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(CONF.email || '').trim());
  }

  /** 任何入口先过一次：调用方传 null/undefined/字符串都不该让页面崩 */
  function safe(ctx) {
    return ctx && typeof ctx === 'object' ? ctx : {};
  }

  /** 把 ctx.current 里为空的字段收成待补清单；非对象一律当空 */
  function missingFields(raw) {
    const cur = safe(raw).current || {};
    return FIELD_ORDER.filter(function (k) {
      const v = cur[k];
      return v === undefined || v === null || v === '' || v === '—';
    });
  }

  /** 缺哪些字段就补哪些 —— 标题一眼能看出这条报告是"纠错"还是"补资料" */
  function title(raw) {
    const ctx = safe(raw);
    const where = [ctx.mapName, ctx.districtName].filter(Boolean).join(' · ');
    const miss = missingFields(ctx);
    const kind = miss.length ? '资料补充' : '资料纠错';
    return '[' + kind + '] ' + (where || ctx.mapId || '地图') + '（' + (ctx.adcode || '') + '）';
  }

  /** 结构化正文：直接就是 Issue / 邮件的 body */
  function body(raw) {
    const ctx = safe(raw);
    const cur = ctx.current || {};
    const miss = missingFields(ctx);
    const lines = [];

    lines.push('### 位置');
    lines.push('');
    lines.push('- 地图：' + (ctx.mapName || '') + '（`' + (ctx.mapId || '') + '`）');
    lines.push('- 区县：' + (ctx.districtName || '') + '（`' + (ctx.adcode || '') + '`）');
    lines.push('- 点位：' + (ctx.levelName ? ctx.levelName : '（地图级，未指定关卡）'));
    lines.push('');

    lines.push('### 哪个字段');
    lines.push('');
    FIELD_ORDER.forEach(function (k) {
      const mark = miss.indexOf(k) >= 0 ? 'x' : ' ';
      lines.push('- [' + mark + '] ' + FIELD_LABEL[k]);
    });
    lines.push('');

    lines.push('### 现在页面上写的是');
    lines.push('');
    FIELD_ORDER.forEach(function (k) {
      const v = cur[k];
      const shown = v === undefined || v === null || v === '' ? '（空）' : String(v);
      lines.push('- ' + FIELD_LABEL[k] + '：' + shown);
    });
    lines.push('');

    lines.push('### 应该是');
    lines.push('');
    lines.push('<!-- 请写在下面。只改一项也行，其余留空 -->');
    lines.push('');
    lines.push('');

    lines.push('### 来源');
    lines.push('');
    lines.push('<!-- 官方页面 / 政府网站 / 统计年鉴 / 书名 + 页码，贴一个链接最好 -->');
    lines.push('');
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('_本段由「地图拼图」页面自动生成，方便定位到具体字段；请把不适用的小节删掉。_');

    return lines.join('\n');
  }

  /** GitHub Issue 预填链接（仓库没配好时返回空串，调用方应退回复制） */
  function issueUrl(ctx) {
    if (!isRepoReady()) return '';
    const repo = String(CONF.repo).trim();
    const q =
      'title=' + encodeURIComponent(title(ctx)) +
      '&body=' + encodeURIComponent(body(ctx));
    /* GitHub 对超长 URL 会截断，这里给个护栏：太长就让调用方退回复制 */
    if (q.length > 7000) return '';
    return 'https://github.com/' + repo + '/issues/new?' + q;
  }

  /** 邮件通道：给没有 GitHub 账号的人用（比如老师、家长） */
  function mailtoUrl(ctx) {
    if (!isEmailReady()) return '';
    return 'mailto:' + String(CONF.email).trim() +
      '?subject=' + encodeURIComponent(title(ctx)) +
      '&body=' + encodeURIComponent(body(ctx));
  }

  /** 剪贴板通道：兜底，任何环境都能用 */
  function clipboardText(ctx) {
    return title(ctx) + '\n\n' + body(ctx);
  }

  /** 报告里要带上的站点地址。
   *
   *  【为什么优先从"当前页面地址"推断，而不是读配置里的 site】
   *  写死站点地址会腐烂，而且我们**实测踩过**：`index.html` 里配的 site 是
   *  `map-puzzle-89v.pages.dev`，那其实是**另一个项目**的域名
   *  （真实站点在 `-1v6` 后缀上），于是众包纠错的报告会链到别人的旧站。
   *  改成从当前页面推断之后：部署到哪个域名、将来绑自有域名、
   *  甚至在本地 `file://` 打开，全都自动是对的，不需要人维护这个值。
   *  配置里的 site 保留为**可选覆盖**（例如将来有 OAuth 中转页时用）。 */
  function siteBase() {
    const configured = String(CONF.site || '').replace(/[?#].*$/, '');
    if (configured) return configured;
    try {
      const loc = global.location;
      if (loc && /^https?:$/.test(loc.protocol)) {
        return loc.origin + loc.pathname.replace(/[?#].*$/, '');
      }
    } catch (e) { /* 拿不到地址就不给链接，纠错功能本身不受影响 */ }
    return '';
  }

  /** 报告里带上面的地址，维护者点进来就能直接看到那一张图 */
  function siteUrlFor(raw) {
    const ctx = safe(raw);
    const base = siteBase();
    if (!base || !ctx.mapId) return '';
    return base + '?map=' + encodeURIComponent(ctx.mapId) +
      (ctx.levelIndex >= 0 ? '&level=' + encodeURIComponent(ctx.levelIndex + 1) : '');
  }

  global.MapContribute = {
    FIELD_LABEL: FIELD_LABEL,
    FIELD_ORDER: FIELD_ORDER,
    configure: configure,
    config: config,
    isRepoReady: isRepoReady,
    isEmailReady: isEmailReady,
    missingFields: missingFields,
    title: title,
    body: body,
    issueUrl: issueUrl,
    mailtoUrl: mailtoUrl,
    clipboardText: clipboardText,
    siteUrlFor: siteUrlFor,
  };
})(typeof window !== 'undefined' ? window : globalThis);
