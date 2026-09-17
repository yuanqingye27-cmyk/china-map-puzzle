/* =====================================================================
 * 分享图 · 生成一张可以发出去的成绩卡片
 * ---------------------------------------------------------------------
 * 路径：js/share.js
 *
 * 【为什么需要它】
 * 现在玩家的路径是：拼完 → 结算画面 → **关掉，什么都没留下**。
 * 人玩完一个游戏最想做的事是"给人看"，而这个项目零成本就能提供 ——
 * 这是唯一的传播入口，也是最便宜的留存手段。
 *
 * 【分层：数据与绘制分开】
 *   buildCardData(...) 纯函数 → 一张卡片的全部文案与数字（可单测、可移植）
 *   drawCard(...)      把数据画到 canvas 上（依赖 Canvas API，平台相关）
 * 这样"卡片里写什么"是纯逻辑，"怎么画"才依赖平台 ——
 * 换成原生端只要重写 drawCard，文案与统计逻辑原样复用。
 *
 * 【设计约束】
 *   · 只用 Canvas 2D 基础能力（文字/矩形/路径），不用 DOM 截图
 *     —— 截图方案在 iOS WebView / 原生端都不可靠
 *   · 卡片尺寸固定 720×960（3:4），社交平台通用比例
 *   · 中文字体只用系统字体栈，不引外部字体（零依赖）
 * ===================================================================== */

(function (global) {
  'use strict';

  const CARD_W = 720;
  const CARD_H = 960;

  /* ---------------- 纯逻辑：卡片上写什么 ---------------- */

  /** 把毫秒格式化成 mm:ss（与引擎的 formatTime 同口径） */
  function fmtTime(ms) {
    const total = Math.max(0, Math.floor((ms || 0) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /**
   * 组装卡片数据（纯函数：给定输入，输出固定文案 —— 可单测）。
   * @param {object} o {
   *   mapName, levelName, levelIndex, levelTotal,
   *   elapsed, tries, hints, percent, solvedMaps, totalMaps,
   *   badges: [{name}], provinceName
   * }
   */
  function buildCardData(o) {
    o = o || {};
    const stats = [];
    if (o.elapsed != null) stats.push({ k: '用时', v: fmtTime(o.elapsed) });
    if (o.tries != null) stats.push({ k: '尝试', v: String(o.tries) });
    if (o.hints != null) stats.push({ k: '提示', v: String(o.hints) });

    // 一行"成就式"的评语：依据可数的事实给，不编造
    let verdict = '拼完了';
    if ((o.hints || 0) === 0 && (o.tries || 0) <= (o.levelTotal || 99) * 2) verdict = '一气呵成';
    else if ((o.hints || 0) === 0) verdict = '零提示通关';
    else if ((o.tries || 0) > (o.levelTotal || 1) * 6) verdict = '历尽波折';

    return {
      title: o.mapName || '地图拼图',
      subtitle: o.provinceName || '',
      levelText: o.levelTotal > 1
        ? ('第 ' + ((o.levelIndex || 0) + 1) + ' / ' + o.levelTotal + ' 关 · ' + (o.levelName || ''))
        : (o.levelName || '全部关卡'),
      verdict: verdict,
      stats: stats,
      progress: (o.solvedMaps != null && o.totalMaps)
        ? ('已拼 ' + o.solvedMaps + ' / ' + o.totalMaps + ' 张地图 · ' + (o.percent || 0) + '%')
        : '',
      badges: (o.badges || []).slice(0, 3).map((b) => (typeof b === 'string' ? b : b.name)),
      brand: '中国地图拼图',
      hint: '拖动碎片，认识中国的每一个区县',
    };
  }

  /** 分享文案（给"复制文字"用；不支持图片的平台走这条） */
  function buildShareText(data) {
    const parts = ['我在《' + data.brand + '》拼完了「' + data.title + '」'];
    if (data.levelText) parts.push(data.levelText);
    const st = data.stats.map((s) => s.k + ' ' + s.v).join(' · ');
    if (st) parts.push(st);
    if (data.progress) parts.push(data.progress);
    return parts.join(' | ');
  }

  /* ---------------- 绘制：依赖 Canvas ---------------- */

  /** 画圆角矩形（Canvas 没有内置的 roundRect 兼容性保证，自己写） */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

  /**
   * 把卡片数据画到 canvas 上。
   * @param {HTMLCanvasElement} canvas
   * @param {object} data   buildCardData 的产物
   * @param {object} opt    { mapPath: 'M…' } 可选：本关地图的 SVG path，画在卡片中央
   */
  function drawCard(canvas, data, opt) {
    opt = opt || {};
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // 背景：深墨绿渐变（与游戏主题一致）
    const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
    bg.addColorStop(0, '#0a1f1a');
    bg.addColorStop(1, '#05100d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // 顶部品牌
    ctx.fillStyle = '#5fd0a8';
    ctx.font = '600 26px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(data.brand, 56, 92);

    // 主标题（地图名）
    ctx.fillStyle = '#eaf5f0';
    ctx.font = '700 54px ' + FONT;
    ctx.fillText(data.title, 56, 168);

    // 副标题（省）
    if (data.subtitle) {
      ctx.fillStyle = '#8fb3a6';
      ctx.font = '400 24px ' + FONT;
      ctx.fillText(data.subtitle, 56, 206);
    }

    /* 中央：本关地图轮廓。
     * 用 SVG path 直接画在 Canvas 上（Path2D 支持 SVG 路径串）——
     * 比"截图"可靠得多，iOS WebView / 原生端都能用同一份数据。 */
    if (opt.mapPath && typeof global.Path2D === 'function') {
      ctx.save();
      ctx.translate(56, 250);
      const scale = Math.min(608 / (opt.vbW || 1000), 420 / (opt.vbH || 1000));
      ctx.scale(scale, scale);
      ctx.translate(-(opt.vbX || 0), -(opt.vbY || 0));
      try {
        const p = new global.Path2D(opt.mapPath);
        ctx.fillStyle = 'rgba(95, 208, 168, 0.22)';
        ctx.fill(p);
        ctx.strokeStyle = '#5fd0a8';
        ctx.lineWidth = 3 / scale;
        ctx.stroke(p);
      } catch (e) { /* path 不合法就跳过地图，卡片其余部分照常 */ }
      ctx.restore();
    }

    // 评语
    ctx.fillStyle = '#eaf5f0';
    ctx.font = '700 34px ' + FONT;
    ctx.fillText(data.verdict, 56, 760);

    // 关卡信息
    ctx.fillStyle = '#8fb3a6';
    ctx.font = '400 22px ' + FONT;
    ctx.fillText(data.levelText, 56, 796);

    // 数据小方块
    let x = 56;
    data.stats.forEach((s) => {
      roundRect(ctx, x, 820, 150, 66, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.fillStyle = '#5fd0a8';
      ctx.font = '700 26px ' + FONT;
      ctx.fillText(s.v, x + 16, 852);
      ctx.fillStyle = '#7f9c92';
      ctx.font = '400 16px ' + FONT;
      ctx.fillText(s.k, x + 16, 876);
      x += 162;
    });

    // 底部进度 + 成就
    if (data.progress) {
      ctx.fillStyle = '#cfe6dd';
      ctx.font = '500 20px ' + FONT;
      ctx.fillText(data.progress, 56, 918);
    }
    if (data.badges.length) {
      ctx.fillStyle = '#5fd0a8';
      ctx.font = '500 18px ' + FONT;
      /* 不用 emoji：Canvas 里的 emoji 在缺少 emoji 字体的环境
       * （部分 iOS WebView / Android 定制 ROM）会渲染成豆腐块。
       * 用纯文字最稳，视觉上也不差。 */
      ctx.fillText('成就：' + data.badges.join(' · '), 56, data.progress ? 944 : 918);
    }
    return true;
  }

  /** 导出成 dataURL（方便 <img> 预览或下载） */
  function toDataURL(canvas) {
    try { return canvas.toDataURL('image/png'); } catch (e) { return null; }
  }

  /* ---------------- 从页面状态采集输入 ---------------- */
  /**
   * 纯采集函数：输入引擎状态 + 进度文档 + 注册表信息，输出 buildCardData 的入参。
   * 放在这里而不是 game.js，是为了让"卡片内容"这件事只有一个来源。
   */
  function collectInput(state, progressSummary, entry, doc) {
    state = state || {};
    const levels = (doc && doc.levels) || null;
    return {
      mapName: (entry && entry.name) || '',
      provinceName: (entry && entry.provinceName) || '',
      levelName: state.levelName || '',
      levelIndex: state.levelIndex || 0,
      levelTotal: state.levelTotal || 1,
      elapsed: state.elapsed || 0,
      tries: state.tries || 0,
      hints: state.hints || 0,
      solvedMaps: progressSummary ? progressSummary.solvedMaps : null,
      totalMaps: progressSummary ? progressSummary.totalMaps : null,
      percent: progressSummary ? progressSummary.percent : 0,
      badges: (doc && doc.badges) || [],
    };
  }

  global.MapShare = {
    CARD_W, CARD_H,
    fmtTime, buildCardData, buildShareText, drawCard, toDataURL, collectInput,
  };
})(typeof window !== 'undefined' ? window : globalThis);
