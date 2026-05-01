function calculateScore({
  market,
  filters,
  patterns
}) {
  let score = 0;

  // =========================
  // 1. TREND SCORE
  // =========================
  if (market.bullTrend || market.bearTrend) {
    score += 25;
  }

  // Strong trend bonus
  if (market.trendStrength > 2) {
    score += 5;
  }

  // =========================
  // 2. BREAKOUT SCORE
  // =========================
  if (market.breakoutBuy || market.breakoutSell) {
    score += 20;
  }

  // =========================
  // 3. VOLATILITY FILTER SCORE
  // =========================
  if (filters.volatilityOK) {
    score += 15;
  }

  // =========================
  // 4. MOMENTUM / PATTERN SCORE
  // =========================
  score += Math.min(patterns.patternScore, 25);

  // =========================
  // 5. VOLUME CONFIRMATION
  // =========================
  if (filters.volumeOK) {
    score += 10;
  }

  // =========================
  // 6. CHOP / FAKEOUT PENALTY
  // =========================
  if (filters.liquiditySweep) {
    score -= 100;
  }

  if (filters.isChop) {
    score -= 30;
  }

  // =========================
  // FINAL LIMIT
  // =========================
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return score;
}

module.exports = calculateScore;