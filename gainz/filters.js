const { average, last } = require('./utils');

function analyzeFilters(data) {
  const {
    candles,
    atrValues,
    volume,
    volumeEMA
  } = data;

  const current = last(candles, 1);
  const prev = last(candles, 2);

  const currentATR = last(atrValues, 1);
  const atrAvg = average(atrValues.slice(-20));

  // =========================
  // 1. VOLATILITY FILTER
  // =========================
  const volatilityOK =
    currentATR > atrAvg;

  // =========================
  // 2. LIQUIDITY SWEEP FILTER
  // =========================
  const fakeBreakoutUp =
    current.h > prev.h &&
    current.c < prev.h;

  const fakeBreakoutDown =
    current.l < prev.l &&
    current.c > prev.l;

  const liquiditySweep =
    fakeBreakoutUp || fakeBreakoutDown;

  // =========================
  // 3. VOLUME CONFIRMATION
  // =========================
  const volumeOK =
    volume > volumeEMA;

  // =========================
  // 4. CHOP FILTER (small candles)
  // =========================
  const range = current.h - current.l;
  const body = Math.abs(current.c - current.o);

  const lowMomentum =
    body / range < 0.25;

  const isChop =
    lowMomentum && !volatilityOK;

  // =========================
  // FINAL FILTER DECISION
  // =========================
  const allowTrade =
    volatilityOK &&
    !liquiditySweep &&
    !isChop &&
    volumeOK;

  return {
    volatilityOK,
    volumeOK,
    liquiditySweep,
    isChop,
    allowTrade
  };
}

module.exports = analyzeFilters;