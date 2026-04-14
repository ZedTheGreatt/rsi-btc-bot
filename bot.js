require("dotenv").config();
const axios = require("axios");
const express = require("express");
const { RSI } = require("technicalindicators");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- CONFIG ----------------
const COINS = [
  { id: "bitcoin", symbol: "₿ BTC", emoji: "₿" },
  { id: "ethereum", symbol: "Ξ ETH", emoji: "Ξ" }
];

const lastSignal = {};
let isRunning = false;

// ---------------- WEB SERVER (Render) ----------------
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

// ---------------- COINGECKO BATCH PRICE (FIX 429) ----------------
async function getMarketDataAll() {
  try {
    const ids = COINS.map(c => c.id).join(",");

    const res = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: {
          ids,
          vs_currencies: "php",
          include_24hr_change: "true"
        },
        timeout: 10000
      }
    );

    return res.data;
  } catch (err) {
    console.log("Market data error:", err.message);
    return {};
  }
}

// ---------------- PRICE HISTORY ----------------
async function getPrices(coinId) {
  try {
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
  } catch (err) {
    console.log(`Price history error (${coinId}):`, err.message);
    return [];
  }
}

// ---------------- RSI ----------------
function getRSI(prices) {
  if (!prices.length) return null;

  const rsi = RSI.calculate({
    values: prices,
    period: 14
  });

  return rsi[rsi.length - 1] || null;
}

// ---------------- SIGNAL ENGINE (IMPROVED) ----------------
function getSignal(rsi) {
  if (!rsi) return "NO_TRADE";

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
    `${coin.emoji} ${coin.symbol}\n` +
    `RSI: ${rsi.toFixed(2)}\n` +
    `Price: ₱${pricePHP.toLocaleString()}\n` +
    `24h Change: ${change24h.toFixed(2)}%\n` +
    `_PS: Data may be inaccurate._\n` +
    `© CoinGecko 2026`
  );
}

// ---------------- CORE LOGIC ----------------
async function checkCoins() {
  if (isRunning) return; // prevent overlap runs
  isRunning = true;

  try {
    const marketData = await getMarketDataAll();

    for (const coin of COINS) {
      const prices = await getPrices(coin.id);
      const rsi = getRSI(prices);

      const signal = getSignal(rsi);

      if (signal === "NO_TRADE") continue;

      const key = coin.symbol;

      if (lastSignal[key] === signal) continue;

      lastSignal[key] = signal;

      const data = marketData[coin.id];

      if (!data) continue;

      await sendMessage(
        formatMessage(signal, coin, rsi, data.php, data.php_24h_change)
      );

      // 🔥 IMPORTANT: prevent CoinGecko rate limit
      await new Promise(r => setTimeout(r, 1500));
    }

  } catch (err) {
    console.log("Bot error:", err.message);
  } finally {
    isRunning = false;
  }
}

// ---------------- START BOT ----------------
async function start() {
  console.log("Bot started...");

  await checkCoins(); // initial run

  setInterval(checkCoins, 60 * 60 * 1000);
}

start();