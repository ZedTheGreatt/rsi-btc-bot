function formatCoinsBotAlert({ signal_icon = '', signal, score, bias_icon = '', bias, trend_icon = '', trend, symbol, price, rsi, rsi_status, ema50, ema200, entry, tp1, tp2, sl, reasons = [] }) {
  const reasonsText = reasons.map(r => `✓ ${r}`).join('\n');
  return [
    '🚨 CoinsBot Alert',
    '',
    `${signal_icon} ${signal} • ${score}/100`,
    `Bias: ${bias_icon} ${bias}`,
    `Trend: ${trend_icon} ${trend}`,
    '',
    `${symbol}: ${price}`,
    `RSI: ${rsi} (${rsi_status})`,
    `EMA50: ₱${ema50}`,
    `EMA200: ₱${ema200}`,
    '',
    `🎯 Entry: ${entry}`,
    `📈 TP: ${tp1} / ${tp2}`,
    `🛑 SL: ${sl}`,
    '',
    reasonsText
  ].join('\n');
}

module.exports = { formatCoinsBotAlert };
