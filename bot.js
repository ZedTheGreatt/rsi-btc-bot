require("dotenv").config();
const axios = require("axios");
const express = require("express");
const { RSI } = require("technicalindicators");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- CONFIG ----------------
const COINS = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" }
];

const lastSignal = {};

// ---------------- KEEP SERVER ALIVE ----------------
app.get("/", (req, res) => {
  res.send("RSI Bot is running...");
});

app.listen(PORT, () => {
  console.log("Web service running on port", PORT);
});

// ---------------- TELEGRAM ----------------
async function sendMessage(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.CHAT_ID,
      text,
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.log("Telegram error:", err.message);
  }
}

// ---------------- COINGECKO PRICE HISTORY ----------------
async function getPrices(coinId) {
  const res = await axios.get(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
    {
      params: {
        vs_currency: "usd",
        days: "5",
        interval: "hourly"
      },
      timeout: 10000
    }
  );

  return res.data.prices.map(p => p[1]).slice(-100);
}

// ---------------- RSI ----------------
function getRSI(prices) {
  const rsi = RSI.calculate({
    values: prices,
    period: 14
  });

  return rsi[rsi.length - 1];
}

// ---------------- MARKET DATA (PHP) ----------------
async function getMarketData(coinId) {
  const res = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price`,
    {
      params: {
        ids: coinId,
        vs_currencies: "php",
        include_24hr_change: "true"
      },
      timeout: 10000
    }
  );

  return res.data[coinId];
}

// ---------------- SIGNAL ENGINE ----------------
function getSignal(rsi) {
  if (rsi <= 30) return "STRONG_BUY";
  if (rsi <= 40) return "BUY_ZONE";
  if (rsi >= 70) return "STRONG_SELL";
  if (rsi >= 60) return "SELL_ZONE";
  return "NO_TRADE";
}

// ---------------- FORMAT MESSAGE ----------------
function formatMessage(signal, coin, rsi, pricePHP, change24h) {
  const emoji =
    signal === "STRONG_BUY" ? "🟢" :
    signal === "BUY_ZONE" ? "🟡" :
    signal === "SELL_ZONE" ? "🟠" :
    signal === "STRONG_SELL" ? "🔴" : "⚪";

  return (
    `${emoji} *${signal}*\n` +
    `${coin.symbol}\n` +
    `RSI: ${rsi.toFixed(2)}\n` +
    `Price: ₱${pricePHP.toLocaleString()}\n` +
    `24h Change: ${change24h.toFixed(2)}%\n` +
    `_PS: Data may be inaccurate._\n` +
    `© CoinGecko 2026`
  );
}

// ---------------- BOT LOGIC ----------------
async function checkCoin(coin) {
  try {
    const prices = await getPrices(coin.id);
    const rsi = getRSI(prices);

    const market = await getMarketData(coin.id);

    const pricePHP = market.php;
    const change24h = market.php_24h_change;

    const signal = getSignal(rsi);
    const key = coin.symbol;

    console.log(`${coin.symbol} RSI:`, rsi, signal);

    if (signal === "NO_TRADE") return;
    if (lastSignal[key] === signal) return;

    lastSignal[key] = signal;

    await sendMessage(
      formatMessage(signal, coin, rsi, pricePHP, change24h)
    );

  } catch (err) {
    console.log(`Error (${coin.symbol}):`, err.message);
  }
}

// ---------------- LOOP ----------------
async function runBot() {
  for (const coin of COINS) {
    await checkCoin(coin);
  }
}

// initial run
runBot();

// hourly loop
setInterval(runBot, 60 * 60 * 1000);