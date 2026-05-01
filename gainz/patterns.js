const {
  last,
  candleStrength,
  isBullishCandle,
  isBearishCandle,
  upperWick,
  lowerWick
} = require('./utils');

function analyzePatterns(data) {
  const { candles } = data;

  const current = last(candles, 1);
  const prev = last(candles, 2);

  // =========================
  // 1. BASIC DIRECTION
  // =========================
  const bullish = isBullishCandle(current);
  const bearish = isBearishCandle(current);

  // =========================
  // 2. ENGULFING PATTERN
  // =========================
  const bullishEngulfing =
    bullish &&
    current.c > prev.o &&
    current.o < prev.c;

  const bearishEngulfing =
    bearish &&
    current.c < prev.o &&
    current.o > prev.c;

  // =========================
  // 3. HAMMER / REJECTION
  // =========================
  const body = Math.abs(current.c - current.o);
  const range = current.h - current.l;

  const isHammer =
    lowerWick(current) > body * 2 &&
    candleStrength(current) > 0.4 &&
    bullish;

  const isShootingStar =
    upperWick(current) > body * 2 &&
    candleStrength(current) > 0.4 &&
    bearish;

  // =========================
  // 4. STRONG CANDLE CHECK
  // =========================
  const strength = candleStrength(current);

  const strongCandle = strength >= 0.6;

  // =========================
  // 5. SIGNAL QUALITY SCORE
  // =========================
  let patternScore = 0;

  if (bullishEngulfing) patternScore += 25;
  if (bearishEngulfing) patternScore += 25;

  if (isHammer) patternScore += 20;
  if (isShootingStar) patternScore += 20;

  if (strongCandle) patternScore += 10;

  // =========================
  // OUTPUT
  // =========================
  return {
    bullish,
    bearish,

    bullishEngulfing,
    bearishEngulfing,

    isHammer,
    isShootingStar,

    strongCandle,

    strength,

    patternScore
  };
}

function detectMarketRegime({ price, ema50, ema200 }) {
    let trend = "SIDEWAYS";
    let bias = "NEUTRAL";

    // BULL TREND
    if (price > ema50 && ema50 > ema200) {
        trend = "BULL";
        bias = "LONG";
    }

    // BEAR TREND
    else if (price < ema50 && ema50 < ema200) {
        trend = "BEAR";
        bias = "SHORT";
    }

    // SIDEWAYS / CHOP
    else {
        trend = "SIDEWAYS";
        bias = "WAIT";
    }

    return {
        trend,
        bias,
        isBull: trend === "BULL",
        isBear: trend === "BEAR",
        isSideways: trend === "SIDEWAYS"
    };
}

module.exports = { detectMarketRegime };

module.exports = analyzePatterns;