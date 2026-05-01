const runGainzEngine = require('./engine');

function gainzWrapper(data) {
  const bars = Array.isArray(data?.ohlcBars) && data.ohlcBars.length > 0
    ? data.ohlcBars
    : Array.isArray(data?.candles) && data.candles.length > 0
    ? data.candles
    : [];

  // =========================
  // SAFETY CHECK (INSIDE FUNCTION ONLY)
  // =========================
  if (!data || bars.length < 2) {
    return {
      signal: "⚪ NO DATA",
      score: 0,
      entry: 0,
      tp1: 0,
      tp2: 0,
      sl: 0,
      trend: "UNKNOWN",
      reason: "Not enough candles"
    };
  }

  const gainzInput = {
    candles: bars,
    ema50: Number(data.ema50 || 0),
    ema200: Number(data.ema200 || 0),
    rsi: Number(data.rsi || 0),
    atr: data.atrValues || [],
    volume: data.volume || 0,
    volumeEMA: data.volumeEMA || 0
  };

  const result = runGainzEngine(gainzInput);

  if (!result) {
    return {
      signal: "⚪ NO TRADE",
      score: 0,
      entry: 0,
      tp1: 0,
      tp2: 0,
      sl: 0,
      trend: "UNKNOWN",
      reason: "Engine returned no result"
    };
  }

  return {
    signal: result.signal || "⚪ NO TRADE",
    score: Number.isFinite(Number(result.score)) ? Number(result.score) : 0,
    trend: result.trend || "⚪ SIDEWAYS",
    entry: Number.isFinite(Number(result.entry)) ? Number(result.entry) : 0,
    tp1: Number.isFinite(Number(result.tp1)) ? Number(result.tp1) : 0,
    tp2: Number.isFinite(Number(result.tp2)) ? Number(result.tp2) : 0,
    sl: Number.isFinite(Number(result.sl)) ? Number(result.sl) : 0,
    reason: result.reason || ''
  };
}

module.exports = gainzWrapper;