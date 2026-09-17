/* =====================================================================
 * 计分规则 · 纯逻辑层（零 DOM、零引擎依赖）
 * ---------------------------------------------------------------------
 * 路径：js/score.js
 *
 * 【为什么单独一层】
 * "放对一块得几分"是纯计算，与"怎么画这块拼图"无关。
 * 抽出来以后：
 *   ① 可测：公式能在 Node 里跑断言（tools/test-score.js）
 *   ② 可调：想改平衡只动这一个文件，不用碰 1566 行的引擎
 *   ③ 可移植：换平台时公式原样复用
 *
 * 【平衡设计】
 *   放对一块 = 100 × min(连击, 5)
 *     · 连击**封顶 ×5**：不封顶会让"最后几块"变成刷分游戏，
 *       封顶后"保持不断"才是重点 —— 这正好是想要的行为
 *   通关时间奖励 = 该关连击满分的 **50%**，随耗时线性衰减
 *     · 【为什么按关卡规模缩放，而不是定死 2000】
 *       实测踩过：原本定死 2000，但 5 块关卡的连击满分只有 1500 ——
 *       于是小关卡里"快"比"准"更重要，与设计意图相反。
 *       改成比例以后，任何规模的关卡里**准都稳定压过快**。
 *   提示扣分 = 每次 150
 *     · 让"用提示"有代价但不致命（宁可玩家用了提示继续玩，而不是卡住退出）
 * ===================================================================== */

(function (global) {
  'use strict';

  const PER_PLACE = 100;        // 放对一块的基础分
  const COMBO_CAP = 5;          // 连击倍率上限
  const TIME_BONUS_RATIO = 0.5; // 时间奖励 = 连击满分的这个比例（永远次要）
  const TIME_BONUS_SECONDS = 120; // 多少秒内还有时间奖励（之后归零）
  const HINT_COST = 150;        // 每次提示扣分

  /**
   * 放对一块得多少分。
   * @param {number} combo  本次放置后的连击数（第 1 块 = 1）
   */
  function forPlacement(combo) {
    const c = Math.max(1, Math.floor(Number(combo) || 1));
    return PER_PLACE * Math.min(c, COMBO_CAP);
  }

  /** 一整关"全程不断连击"能拿到多少分（不含时间奖励） */
  function maxPlacementScore(pieceCount) {
    const n = Math.max(0, Math.floor(Number(pieceCount) || 0));
    let total = 0;
    for (let i = 1; i <= n; i++) total += forPlacement(i);
    return total;
  }

  /**
   * 通关的时间奖励。
   * @param {number} elapsedMs  本关用时
   * @param {number} pieceCount 本关块数（决定奖励上限 —— 见上面「为什么按规模缩放」）
   */
  function timeBonus(elapsedMs, pieceCount) {
    const max = Math.round(maxPlacementScore(pieceCount) * TIME_BONUS_RATIO);
    const secs = Math.max(0, Math.floor((Number(elapsedMs) || 0) / 1000));
    if (secs >= TIME_BONUS_SECONDS) return 0;
    return Math.round(max * (1 - secs / TIME_BONUS_SECONDS));
  }

  /** 用一次提示扣多少分（不会扣成负数） */
  function applyHintCost(score) {
    return Math.max(0, (Number(score) || 0) - HINT_COST);
  }

  /** 整关的理论满分（评估"这局打得怎么样"的参照，也用于评级） */
  function maxForLevel(pieceCount) {
    const m = maxPlacementScore(pieceCount);
    return m + Math.round(m * TIME_BONUS_RATIO);
  }

  /**
   * 按得分给一个档位（用于结算画面的一句话评价）。
   * 阈值用"占满分的比例"，这样对不同大小的关卡都公平。
   */
  function rankOf(score, maxScore) {
    const r = maxScore > 0 ? (Number(score) || 0) / maxScore : 0;
    if (r >= 0.9) return { id: 's', name: '完美', desc: '几乎没浪费任何一块' };
    if (r >= 0.75) return { id: 'a', name: '出色', desc: '失误很少' };
    if (r >= 0.55) return { id: 'b', name: '不错', desc: '稳扎稳打' };
    if (r >= 0.35) return { id: 'c', name: '及格', desc: '还能更准一些' };
    return { id: 'd', name: '加油', desc: '多试几次就熟了' };
  }

  global.MapScore = {
    PER_PLACE, COMBO_CAP, TIME_BONUS_RATIO, TIME_BONUS_SECONDS, HINT_COST,
    forPlacement, maxPlacementScore, timeBonus, applyHintCost, maxForLevel, rankOf,
  };
})(typeof window !== 'undefined' ? window : globalThis);
