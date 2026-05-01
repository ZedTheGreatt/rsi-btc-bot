const config = require('./config');
const analyzeMarket = require('./market');
const analyzeFilters = require('./filters');
const analyzePatterns = require('./patterns');
const calculateScore = require('./score');
const calculateRisk = require('./risk');

function runGainzEngine(data) {
  const {
    candles,
    ema50,
    ema200,
    rsi,
    atr,
    volume,
    volumeEMA
  } = data;

  if (!candles || candles.length < 2) {
    return {
      signal: "⚪ NO DATA",
      score: 0,
      trend: "UNKNOWN",
      entry: 0,
      tp1: 0,
      tp2: 0,
      sl: 0
    };
  }

  const lastCandle = candles[candles.length - 1];

  // =========================
  // 1. MARKET ANALYSIS
  // =========================
  const market = analyzeMarket({
    candles,
    price: lastCandle.c,
    ema50,
    ema200
  });

  // =========================
  // 2. FILTERS (ANTI FAKE SIGNAL)
  // =========================
  const filters = analyzeFilters({
    candles,
    atrValues: atr,
    volume,
    volumeEMA
  });

  const trendLabel = market.bullTrend
    ? "📈 BULLISH"
    : market.bearTrend
    ? "📉 BEARISH"
    : "⚪ SIDEWAYS";

  // STOP EARLY IF INVALID
  if (!filters.allowTrade) {
    const reasons = [];
    if (!filters.volatilityOK) reasons.push('low volatility');
    if (!filters.volumeOK) reasons.push('low volume');
    if (filters.liquiditySweep) reasons.push('liquidity sweep');
    if (filters.isChop) reasons.push('choppy candle');
    return {
      signal: "⚪ NO TRADE",
      score: 0,
      trend: trendLabel,
      reason: reasons.length > 0 ? `Filtered: ${reasons.join(', ')}` : "Filtered by safety rules",
      entry: 0,
      tp1: 0,
      tp2: 0,
      sl: 0
    };
  }

  // =========================
  // 3. PATTERNS
  // =========================
  const patterns = analyzePatterns({ candles });

  // =========================
  // 4. SCORE ENGINE
  // =========================
  const score = calculateScore({
    market,
    filters,
    patterns
  });

  // =========================
  // 5. SIGNAL DECISION
  // =========================
  let signal = "⚪ WAIT";

  if (score >= config.score.strongBuy) {
    signal = market.bullTrend ? "🟢 STRONG BUY" : "🔴 STRONG SELL";
  } else if (score >= config.score.buy) {
    signal = market.bullTrend ? "🟢 BUY" : "🔴 SELL";
  } else {
    signal = "⚪ WAIT";
  }

  // =========================
  // 6. RISK (TP / SL)
  // =========================
  const risk = calculateRisk({
    lastCandle,
    atr: atr[atr.length - 1],
    config
  });

  // =========================
  // FINAL OUTPUT
  // =========================
  return {
    signal,
    score,

    trend: trendLabel,

    patternScore: patterns.patternScore,

    entry: lastCandle.c,

    tp1: market.bullTrend ? risk.long.tp1 : risk.short.tp1,
    tp2: market.bullTrend ? risk.long.tp2 : risk.short.tp2,
    sl: market.bullTrend ? risk.long.sl : risk.short.sl,

    debug: {
      market,
      filters,
      patterns
    }
  };
}

module.exports = runGainzEngine;