module.exports = {
  // =========================
  // SIGNAL SCORE
  // =========================
  score: {
    strongBuy: 85,
    buy: 70,
    wait: 40,
    sell: 20
  },

  // =========================
  // RSI ZONES
  // =========================
  rsi: {
    overbought: 70,
    bullish: 50,
    neutralLow: 40,
    neutralHigh: 60,
    bearish: 50,
    oversold: 30
  },

  // =========================
  // ATR RISK MODEL
  // =========================
  risk: {
    slMultiplier: 1.2,
    tp1Multiplier: 1.5,
    tp2Multiplier: 2.5
  },

  // =========================
  // EMA TREND FILTER
  // =========================
  ema: {
    fast: 50,
    slow: 200
  },

  // =========================
  // CANDLE STRENGTH
  // =========================
  candle: {
    minStrength: 0.6
  },

  // =========================
  // VOLUME FILTER
  // =========================
  volume: {
    multiplier: 1.3
  },

  // =========================
  // ALERTS
  // =========================
  alerts: {
    fakeoutPenalty: -100,
    cooldownBars: 3
  }
};