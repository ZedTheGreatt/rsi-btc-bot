function calculateRisk({
  lastCandle,
  atr,
  config
}) {
  const entry = lastCandle.c;

  const slDistance = atr * config.risk.slMultiplier;
  const tp1Distance = atr * config.risk.tp1Multiplier;
  const tp2Distance = atr * config.risk.tp2Multiplier;

  // Bullish trade
  const long = {
    entry,
    sl: entry - slDistance,
    tp1: entry + tp1Distance,
    tp2: entry + tp2Distance
  };

  // Bearish trade
  const short = {
    entry,
    sl: entry + slDistance,
    tp1: entry - tp1Distance,
    tp2: entry - tp2Distance
  };

  return {
    long,
    short
  };
}

module.exports = calculateRisk;