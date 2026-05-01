const config = require('./config');

function getSignal(score, trend) {
  // =========================
  // FAKE / INVALID ZONE
  // =========================
  if (score <= 0) {
    return {
      signal: "❌ NO TRADE",
      label: "invalid"
    };
  }

  // =========================
  // STRONG BUY / SELL
  // =========================
  if (score >= config.score.strongBuy) {
    return {
      signal: trend === "bull"
        ? "🟢 STRONG BUY"
        : "🔴 STRONG SELL",
      label: "strong"
    };
  }

  // =========================
  // NORMAL BUY / SELL
  // =========================
  if (score >= config.score.buy) {
    return {
      signal: trend === "bull"
        ? "🟢 BUY"
        : "🔴 SELL",
      label: "normal"
    };
  }

  // =========================
  // WAIT ZONE
  // =========================
  if (score >= config.score.wait) {
    return {
      signal: "⚪ WAIT / WATCH",
      label: "wait"
    };
  }

  // =========================
  // WEAK MARKET
  // =========================
  return {
    signal: "⚪ NO CLEAR SETUP",
    label: "weak"
  };
}

module.exports = getSignal;