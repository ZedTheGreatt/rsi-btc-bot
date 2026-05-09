
function parseNumber(value) {
  if (value == null) return NaN;
  return Number(value);
}

function computeScore(data) {
  // Phase 1 scoring per spec
  const rsi = parseNumber(data.rsi_raw ?? data.rsi);
  const ema50 = parseNumber(data.ema50_raw ?? data.ema50);
  const ema200 = parseNumber(data.ema200_raw ?? data.ema200);
  const price = parseNumber(data.price_raw ?? data.pricePHP);
  const volume = parseNumber(data.volume_raw ?? data.volume);
  const volumeSMA = parseNumber(data.volume_sma20 ?? data.volumeSMA20);
  const candlePct = parseNumber(data.candle_pct ?? 0);
  const bodyRatio = parseNumber(data.candle_body_ratio ?? 0);

  let score = 0;

  // Trend Alignment (30)
  let trendPoints = 0;
  const priceAboveEma50 = !Number.isNaN(price) && !Number.isNaN(ema50) && price > ema50;
  const ema50AboveEma200 = !Number.isNaN(ema50) && !Number.isNaN(ema200) && ema50 > ema200;
  const priceBelowEma50 = !Number.isNaN(price) && !Number.isNaN(ema50) && price < ema50;
  const ema50BelowEma200 = !Number.isNaN(ema50) && !Number.isNaN(ema200) && ema50 < ema200;

  if ((priceAboveEma50 && ema50AboveEma200) || (priceBelowEma50 && ema50BelowEma200)) {
    trendPoints = 30; // full alignment
  } else if (priceAboveEma50 || ema50AboveEma200 || priceBelowEma50 || ema50BelowEma200) {
    trendPoints = 15; // partial
  } else {
    trendPoints = 0;
  }
  score += trendPoints;

  // RSI Setup (25)
  let rsiPoints = 0;
  if (!Number.isNaN(rsi)) {
    if (rsi >= 25 && rsi <= 45) rsiPoints = 25; // ideal
    else if (rsi > 45 && rsi <= 55) rsiPoints = 10; // neutral
    else rsiPoints = 0; // poor
  }
  score += rsiPoints;

  // Momentum (20) - candle percent
  let momPoints = 0;
  const absCandle = Math.abs(candlePct);
  if (absCandle >= 2) momPoints = 20; // strong
  else if (absCandle >= 0.5) momPoints = 10; // small
  else momPoints = 0;
  score += momPoints;

  // Volume Confirmation (15)
  let volPoints = 0;
  if (!Number.isNaN(volume) && !Number.isNaN(volumeSMA) && volumeSMA > 0) {
    if (volume > volumeSMA * 1.1) volPoints = 15; // above
    else if (Math.abs(volume - volumeSMA) / volumeSMA <= 0.1) volPoints = 7; // average
    else volPoints = 0; // weak
  }
  score += volPoints;

  // Candle Strength (10)
  let candlePoints = 0;
  if (!Number.isNaN(bodyRatio)) {
    if (bodyRatio >= 0.6) candlePoints = 10; // strong body
    else if (bodyRatio >= 0.3) candlePoints = 5; // normal
    else candlePoints = 0;
  }
  score += candlePoints;

  // Bound and round
  score = Math.round(Math.max(0, Math.min(100, score)));
  return { score, breakdown: { trendPoints, rsiPoints, momPoints, volPoints, candlePoints } };
}

function determineBias(data) {
  // Bias detection per spec
  const rsi = parseNumber(data.rsi_raw ?? data.rsi);
  const prevRsi = parseNumber(data.rsi_prev ?? NaN);
  const candlePct = parseNumber(data.candle_pct ?? 0);
  const volume = parseNumber(data.volume_raw ?? 0);
  const volumeSMA = parseNumber(data.volume_sma20 ?? data.volumeSMA20 ?? 0);
  const price = parseNumber(data.price_raw ?? data.pricePHP);
  const ema50 = parseNumber(data.ema50_raw ?? data.ema50);

  let bullishScore = 0;
  let bearishScore = 0;

  if (!Number.isNaN(rsi) && !Number.isNaN(prevRsi) && rsi > prevRsi) bullishScore += 1;
  if (candlePct > 0) bullishScore += 1; else if (candlePct < 0) bearishScore += 1;
  if (!Number.isNaN(volume) && !Number.isNaN(volumeSMA) && volume > volumeSMA) bullishScore += 1;
  if (!Number.isNaN(price) && !Number.isNaN(ema50) && price > ema50) bullishScore += 1;
  if (!Number.isNaN(price) && !Number.isNaN(ema50) && price < ema50) bearishScore += 1;

  if (bullishScore >= 3) return 'Bullish';
  if (bearishScore >= 3) return 'Bearish';
  return 'Neutral';
}

function determineSignal(data, score) {
  const bias = determineBias(data);
  const s = score;
  const rsi = parseNumber(data.rsi_raw ?? data.rsi);
  const momentumPos = (parseNumber(data.candle_pct ?? 0) > 0);
  const volConfirmed = parseNumber(data.volume_raw ?? 0) > parseNumber(data.volume_sma20 ?? 0);
  const isUptrend = (parseNumber(data.price_raw ?? 0) > parseNumber(data.ema50_raw ?? 0)) && (parseNumber(data.ema50_raw ?? 0) > parseNumber(data.ema200_raw ?? 0));
  const isDowntrend = (parseNumber(data.price_raw ?? 0) < parseNumber(data.ema50_raw ?? 0)) && (parseNumber(data.ema50_raw ?? 0) < parseNumber(data.ema200_raw ?? 0));

  // Strong Buy
  if (bias === 'Bullish' && isUptrend && s >= 80 && rsi >= 25 && rsi <= 45 && momentumPos && volConfirmed) return { signal: ' STRONG BUY 🟢', bias };
  // Buy
  if (bias === 'Bullish' && s >= 65) return { signal: ' BUY 🟢', bias };
  // Strong Sell
  if (bias === 'Bearish' && isDowntrend && s >= 80 && rsi >= 55 && rsi <= 75 && !momentumPos && volConfirmed) return { signal: ' STRONG SELL 🔴', bias };
  // Sell
  if (bias === 'Bearish' && s >= 65) return { signal: ' SELL 🔴', bias };
  // Watch
  if (s >= 50 && s < 65) return { signal: ' WATCH 🟡', bias };
  return { signal: ' HOLD ⚪', bias };
}

function generateReasons(data, score) {
  const reasons = [];
  // Use breakdown if available
  const rsi = parseNumber(data.rsi_raw ?? data.rsi);
  const vol = parseNumber(data.volume_raw ?? 0);
  const volSMA = parseNumber(data.volume_sma20 ?? 0);
  const candlePct = parseNumber(data.candle_pct ?? 0);
  const bodyRatio = parseNumber(data.candle_body_ratio ?? 0);

  // 1) Trend reason
  const price = parseNumber(data.price_raw ?? 0);
  const ema50 = parseNumber(data.ema50_raw ?? 0);
  const ema200 = parseNumber(data.ema200_raw ?? 0);
  if (!Number.isNaN(price) && !Number.isNaN(ema50) && !Number.isNaN(ema200)) {
    if (price > ema50 && ema50 > ema200) reasons.push('Trend: Uptrend (Price > EMA50 > EMA200)');
    else if (price < ema50 && ema50 < ema200) reasons.push('Trend: Downtrend (Price < EMA50 < EMA200)');
    else reasons.push(`Trend: ${data.trend || 'Sideways'}`);
  }

  // 2) RSI reason
  if (!Number.isNaN(rsi)) {
    if (rsi < 30) reasons.push(`RSI ${rsi.toFixed(1)} (Oversold)`);
    else if (rsi <= 45) reasons.push(`RSI ${rsi.toFixed(1)} (Weak/Early)`);
    else if (rsi <= 55) reasons.push(`RSI ${rsi.toFixed(1)} (Neutral)`);
    else if (rsi <= 70) reasons.push(`RSI ${rsi.toFixed(1)} (Strong)`);
    else reasons.push(`RSI ${rsi.toFixed(1)} (Overbought)`);
  }

  // 3) Momentum reason
  if (!Number.isNaN(candlePct)) {
    const sign = candlePct >= 0 ? '+' : '';
    reasons.push(`Candle: ${sign}${candlePct.toFixed(2)}%`);
  }

  // 4) Volume reason
  if (!Number.isNaN(vol) && !Number.isNaN(volSMA)) {
    if (vol > volSMA * 1.1) reasons.push('Volume: Above SMA20');
    else if (Math.abs(vol - volSMA) / (volSMA || 1) <= 0.1) reasons.push('Volume: Average');
    else reasons.push('Volume: Weak');
  }

  // 5) Candle strength
  if (!Number.isNaN(bodyRatio)) {
    if (bodyRatio >= 0.6) reasons.push('Candle body: Strong');
    else if (bodyRatio >= 0.3) reasons.push('Candle body: Normal');
    else reasons.push('Candle body: Weak');
  }

  // Pick top 3 distinct reasons
  const unique = Array.from(new Set(reasons)).slice(0, 6);
  return unique.slice(0, 3);
}

function getTradePlan(entryPrice, signal) {
  const entry = Number(entryPrice);
  if (Number.isNaN(entry)) return null;
  let tp1, tp2, sl;
  const isSell = /SELL/.test(signal.toUpperCase());
  if (!isSell) {
    tp1 = entry * 1.01;
    tp2 = entry * 1.02;
    sl = entry * 0.985;
  } else {
    tp1 = entry * 0.99;
    tp2 = entry * 0.98;
    sl = entry * 1.015;
  }
  const fmt = (v) => Number(v).toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  return { entry: fmt(entry), tp1: fmt(tp1), tp2: fmt(tp2), sl: fmt(sl) };
}

module.exports = { computeScore, generateReasons, determineSignal, determineBias, getTradePlan };
