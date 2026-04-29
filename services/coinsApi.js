const axios = require("axios");

// Coins.ph style klines (replace endpoint if needed)
async function getKlines(symbol = "BTCPHP") {
  const url = `https://api.coingecko.com/api/v3/coins/${symbol
    .replace("PHP", "")
    .toLowerCase()}/market_chart?vs_currency=php&days=1`;

  const res = await axios.get(url);

  const prices = res.data.prices;

  return prices.map((p) => ({
    time: p[0],
    open: p[1],
    high: p[1],
    low: p[1],
    close: p[1],
  }));
}

module.exports = { getKlines };