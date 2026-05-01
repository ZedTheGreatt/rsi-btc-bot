const axios = require('axios');

/**
 * Fetch OHLC candles from Coins.ph API
 * Standardized output for Gainz engine
 */
async function getCandles(symbol) {
  try {
    const url = `https://api.pro.coins.ph/openapi/v1/klines?symbol=${symbol}&interval=1h&limit=300`;

    const res = await axios.get(url);

    const candles = res.data.map(c => ({
      t: Number(c[0]),   // timestamp
      o: parseFloat(c[1]),
      h: parseFloat(c[2]),
      l: parseFloat(c[3]),
      c: parseFloat(c[4]),
      v: parseFloat(c[5] || 0)
    }));

    return candles;
  } catch (err) {
    console.error("Candles fetch error:", err.message);
    return [];
  }
}

module.exports = getCandles;