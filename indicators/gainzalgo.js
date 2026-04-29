function analyzeGainzAlgo(candles) {
  const closes = candles.map(c => c.close);

  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];

  // simple momentum
  const momentum = last > prev ? "Bullish" : "Bearish";

  // trend (basic)
  const avg = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const trend = last > avg ? "Bullish" : "Bearish";

  // volatility / strength
  const diff = Math.abs(last - prev);
  let strength = "Weak";
  if (diff > avg * 0.01) strength = "Strong";
  else if (diff > avg * 0.005) strength = "Medium";

  // signals
  let signal = "HOLD";

  if (trend === "Bullish" && momentum === "Bullish" && strength === "Strong") {
    signal = "STRONG BUY";
  } else if (trend === "Bullish") {
    signal = "BUY ZONE";
  } else if (trend === "Bearish" && momentum === "Bearish" && strength === "Strong") {
    signal = "STRONG SELL";
  } else if (trend === "Bearish") {
    signal = "SELL ZONE";
  }

  const confidence =
    strength === "Strong" ? 90 : strength === "Medium" ? 70 : 50;

  return {
    signal,
    trend,
    momentum: strength,
    confidence,
    price: last,
  };
}

module.exports = { analyzeGainzAlgo };