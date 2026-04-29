const { getKlines } = require("./coinsApi");
const { analyzeGainzAlgo } = require("../indicators/gainzalgo");
const { generateChart } = require("./chart");
const { sendSignal } = require("../bot");

const symbols = ["BTCPHP", "ETHPHP", "XRPPHP", "SOLPHP"];

async function scanMarket(force = false) {
  for (const symbol of symbols) {
    try {
      const candles = await getKlines(symbol);

      if (!candles || candles.length < 20) {
        console.log(`${symbol}: not enough candles`);
        continue; // valid here because we're inside for-loop
      }

      const result = analyzeGainzAlgo(candles);

      const chart = await generateChart(candles, result.signal);

      const message = `
${formatSignal(result.signal)}

${symbol}
Price: ₱${result.price.toLocaleString()}

Trend: ${result.trend}
Momentum: ${result.momentum}
Confidence: ${result.confidence}%

© CoinsBot GainzAlgo v2
`;

      if (force || result.signal !== "HOLD") {
        await sendSignal(message, chart);
      }

    } catch (error) {
      console.error(`${symbol}: ${error.message}`);
    }
  }
}

function formatSignal(signal) {
  switch (signal) {
    case "STRONG BUY":
      return "🚀 STRONG BUY";
    case "BUY ZONE":
      return "🟢 BUY ZONE";
    case "SELL ZONE":
      return "🔴 SELL ZONE";
    case "STRONG SELL":
      return "⚠️ STRONG SELL";
    default:
      return "🟡 HOLD";
  }
}

module.exports = { scanMarket };