const axios = require("axios");

const MAP = {
  BTCPHP: "btc-php",
  ETHPHP: "eth-php",
  XRPPHP: "xrp-php",
  SOLPHP: "sol-php",
};

async function getKlines(symbol = "BTCPHP") {
  const pair = MAP[symbol];
  if (!pair) throw new Error(`Unsupported symbol: ${symbol}`);

  const url = `https://api.pro.coins.ph/openapi/quote/v1/klines?symbol=${pair}&interval=1h&limit=100`;

  const { data } = await axios.get(url, { timeout: 10000 });

  if (!data || !data.data) throw new Error("No candle data");

  return data.data.map(c => ({
    time: Number(c[0]),
    open: Number(c[1]),
    high: Number(c[2]),
    low: Number(c[3]),
    close: Number(c[4]),
    volume: Number(c[5]),
  }));
}

module.exports = { getKlines };