const { last } = require('./utils');

function analyzeMarket(data) {
  const {
    candles,
    price,
    ema50,
    ema200
  } = data;

  const prev = last(candles, 2);
  const current = last(candles, 1);

  // Trend
  const bullTrend =
    ema50 > ema200 &&
    price > ema200;

  const bearTrend =
    ema50 < ema200 &&
    price < ema200;

  const sideways =
    !bullTrend &&
    !bearTrend;

  // Candle highs/lows
  const brokePrevHigh =
    current.c > prev.h;

  const brokePrevLow =
    current.c < prev.l;

  // Signal triggers
  const breakoutBuy =
    bullTrend &&
    brokePrevHigh &&
    current.c > ema50;

  const breakoutSell =
    bearTrend &&
    brokePrevLow &&
    current.c < ema50;

  // EMA spread strength
  const emaGap = Math.abs(ema50 - ema200);
  const trendStrength =
    ema200 !== 0
      ? (emaGap / ema200) * 100
      : 0;

  return {
    bullTrend,
    bearTrend,
    sideways,

    brokePrevHigh,
    brokePrevLow,

    breakoutBuy,
    breakoutSell,

    trendStrength
  };
}

module.exports = analyzeMarket;