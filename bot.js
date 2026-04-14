require("dotenv").config();
const axios = require("axios");
const express = require("express");
const { RSI } = require("technicalindicators");
const fs = require("fs");

const Logger = require("./utils/logger");
const Storage = require("./utils/storage");

// ========== LOAD CONFIG ==========
const configFile = "./config.json";
if (!fs.existsSync(configFile)) {
  console.error("config.json not found!");
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configFile, "utf8"));

// ========== INITIALIZE SERVICES ==========
const logger = new Logger(config.logging);
const storage = new Storage("./data");
const app = express();
const PORT = process.env.PORT || config.web.port || 3000;

// ========== STATE ==========
const lastSignal = storage.load("lastSignal", {});
const priceCache = storage.load("priceCache", {});
const botStats = storage.load("botStats", {});

let isRunning = false;
let isBotHealthy = true;
let lastCheckTime = null;
let lastErrorTime = null;
let totalChecks = botStats.totalChecks || 0;
let totalAlerts = botStats.totalAlerts || 0;

// ========== WEB SERVER ==========
app.use(express.json());

app.get("/", (req, res) => {
  res.send("RSI Alert Bot is running...");
});

app.get("/health", (req, res) => {
  const health = {
    status: isBotHealthy ? "healthy" : "unhealthy",
    lastCheck: lastCheckTime,
    lastError: lastErrorTime,
    totalChecks,
    totalAlerts,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
  res.status(isBotHealthy ? 200 : 503).json(health);
});

app.get("/stats", (req, res) => {
  const enabledCoins = config.coins.filter(c => c.enabled);
  res.json({
    coins: enabledCoins.map(c => c.symbol),
    totalChecks,
    totalAlerts,
    lastSignals: lastSignal,
    cacheKeys: Object.keys(priceCache)
  });
});

app.listen(PORT, () => {
  logger.info(`Web service running on port ${PORT}`);
});

// ========== RETRY LOGIC ==========
async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const waitTime = delay * Math.pow(2, i); // exponential backoff
      logger.warn(`Retry attempt ${i + 1}/${maxRetries} after ${waitTime}ms`, {
        error: err.message
      });
      await new Promise(r => setTimeout(r, waitTime));
    }
  }

  throw lastError;
}

// ========== TELEGRAM ==========
async function sendMessage(text) {
  if (!config.notifications.telegram.enabled) return;

  try {
    await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        chat_id: process.env.CHAT_ID,
        text,
        parse_mode: config.notifications.telegram.parseMode
      },
      {
        timeout: 10000
      }
    );

    logger.debug("Telegram message sent", { preview: text.substring(0, 50) });
  } catch (err) {
    logger.error("Telegram error", { error: err.message });
  }
}

async function handleAdminCommand(message) {
  const text = message.text.toLowerCase().trim();
  const parts = text.split(" ");
  const command = parts[0].replace("/", "");

  try {
    switch (command) {
      case "status":
        return await sendStatus();
      case "history":
        return await sendHistory(parseInt(parts[1]) || 10);
      case "coins":
        return await sendCoinsList();
      case "help":
        return await sendHelp();
      case "restart":
        return await restartBot();
      case "set_rsi":
        return await updateRSIThresholds(parts);
      default:
        await sendMessage("❌ Unknown command. Type `/help` for available commands.");
    }
  } catch (err) {
    logger.error("Admin command error", { command, error: err.message });
    await sendMessage(`❌ Error executing command: ${err.message}`);
  }
}

async function sendStatus() {
  const enabledCoins = config.coins.filter(c => c.enabled);
  const status = `
📊 *BOT STATUS*
Status: ${isBotHealthy ? "🟢 Healthy" : "🔴 Unhealthy"}
Total Checks: ${totalChecks}
Total Alerts: ${totalAlerts}
Uptime: ${Math.floor(process.uptime() / 60)}min
Coins: ${enabledCoins.map(c => c.symbol).join(", ")}
Last Check: ${lastCheckTime || "never"}
  `.trim();
  await sendMessage(status);
}

async function sendHistory(limit = 10) {
  const trades = logger.getTrades(limit);
  if (trades.length === 0) {
    await sendMessage("📭 No trades recorded yet.");
    return;
  }

  let msg = "📜 *RECENT TRADES* (last " + limit + ")\n\n";
  trades.slice(0, limit).forEach((trade, idx) => {
    const icon = trade.signal.includes("BUY") ? "🟢" : "🔴";
    msg += `${idx + 1}. ${icon} ${trade.signal} - ${trade.symbol} @ ${trade.rsi.toFixed(2)} RSI\n`;
  });

  await sendMessage(msg);
}

async function sendCoinsList() {
  let msg = "💰 *MONITORED COINS*\n\n";
  config.coins.forEach(coin => {
    const status = coin.enabled ? "✅" : "❌";
    msg += `${status} ${coin.emoji} ${coin.symbol} (${coin.id})\n`;
  });
  msg += "\n_To enable/disable coins, edit config.json_";
  await sendMessage(msg);
}

async function sendHelp() {
  const help = `
🤖 *AVAILABLE COMMANDS*

/status - Show bot status
/coins - List monitored coins
/history [limit] - Show recent trades
/set_rsi buy_zone sell_zone - Update thresholds
/restart - Restart bot
/help - Show this message
  `.trim();
  await sendMessage(help);
}

async function restartBot() {
  await sendMessage("🔄 Restarting bot...");
  logger.info("Bot restart requested via Telegram");
  process.exit(0);
}

async function updateRSIThresholds(parts) {
  if (parts.length < 3) {
    await sendMessage("Usage: `/set_rsi 40 60`");
    return;
  }

  const buyZone = parseFloat(parts[1]);
  const sellZone = parseFloat(parts[2]);

  if (isNaN(buyZone) || isNaN(sellZone) || buyZone >= sellZone) {
    await sendMessage("❌ Invalid values. Buy zone must be < sell zone");
    return;
  }

  config.rsi.buyZone = buyZone;
  config.rsi.sellZone = sellZone;

  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
  logger.info("RSI thresholds updated", { buyZone, sellZone });

  await sendMessage(
    `✅ RSI thresholds updated\nBuy Zone: ${buyZone}\nSell Zone: ${sellZone}`
  );
}

// ========== TELEGRAM BOT POLLING ==========
async function setupTelegramPolling() {
  let offset = 0;

  setInterval(async () => {
    try {
      const res = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getUpdates`,
        {
          params: { offset, allowed_updates: ["message"] }
        }
      );

      if (res.data.result && res.data.result.length > 0) {
        for (const update of res.data.result) {
          if (
            update.message &&
            update.message.text &&
            update.message.text.startsWith("/")
          ) {
            logger.debug("Telegram command received", {
              command: update.message.text.split(" ")[0]
            });
            await handleAdminCommand(update.message);
          }
          offset = update.update_id + 1;
        }
      }
    } catch (err) {
      logger.debug("Telegram polling error", { error: err.message });
    }
  }, 2000); // Check for new messages every 2 seconds
}

// ========== API WITH RATE LIMITING ==========
async function getMarketSnapshot() {
  try {
    const enabledCoins = config.coins.filter(c => c.enabled);
    const ids = enabledCoins.map(c => c.id).join(",");

    const res = await retryWithBackoff(async () => {
      return await axios.get(`${config.api.coingecko.baseUrl}/simple/price`, {
        params: {
          ids,
          vs_currencies: "php,usd",
          include_24hr_change: true
        },
        timeout: config.api.coingecko.timeout
      });
    }, config.api.coingecko.retries);

    return res.data;
  } catch (err) {
    logger.error("Market snapshot error", { error: err.message });
    isBotHealthy = false;
    lastErrorTime = new Date().toISOString();
    return {};
  }
}

// ========== LOAD HISTORY ==========
async function loadInitialHistory(coinId) {
  try {
    const res = await retryWithBackoff(async () => {
      return await axios.get(
        `${config.api.coingecko.baseUrl}/coins/${coinId}/market_chart`,
        {
          params: {
            vs_currency: "usd",
            days: 5,
            interval: "hourly"
          },
          timeout: config.api.coingecko.timeout
        }
      );
    }, config.api.coingecko.retries);

    priceCache[coinId] = res.data.prices
      .map(p => p[1])
      .slice(-100);

    logger.info(`Loaded ${priceCache[coinId].length} price points for ${coinId}`);
  } catch (err) {
    logger.error(`Initial history load failed (${coinId})`, {
      error: err.message
    });
    priceCache[coinId] = [];
  }
}

// ========== CACHE MANAGEMENT ==========
function updatePriceCache(coinId, latestPrice) {
  if (!priceCache[coinId]) return;

  priceCache[coinId].push(latestPrice);

  if (priceCache[coinId].length > 100) {
    priceCache[coinId].shift();
  }
}

// ========== RSI CALCULATION ==========
function getRSI(prices) {
  if (!prices || prices.length < config.rsi.minLength) return null;

  try {
    const result = RSI.calculate({
      values: prices,
      period: config.rsi.period
    });

    return result[result.length - 1] || null;
  } catch (err) {
    logger.warn("RSI calculation error", { error: err.message });
    return null;
  }
}

// ========== SIGNAL ENGINE ==========
function getSignal(rsi) {
  if (!rsi) return "NO_TRADE";

  if (rsi <= config.rsi.strongBuy) return "STRONG_BUY";
  if (rsi <= config.rsi.buyZone) return "BUY_ZONE";
  if (rsi >= config.rsi.strongSell) return "STRONG_SELL";
  if (rsi >= config.rsi.sellZone) return "SELL_ZONE";

  return "NO_TRADE";
}

// ========== MESSAGE FORMATTING ==========
function formatMessage(signal, coin, rsi, pricePHP, change24h) {
  const emoji =
    signal === "STRONG_BUY"
      ? "🟢"
      : signal === "BUY_ZONE"
        ? "🟡"
        : signal === "SELL_ZONE"
          ? "🟠"
          : signal === "STRONG_SELL"
            ? "🔴"
            : "⚪";

  return [
    `${emoji} *${signal}*`,
    `${coin.emoji} ${coin.symbol}/PHP ₱`,
    `RSI: ${rsi.toFixed(2)}`,
    `Price: ₱${pricePHP.toLocaleString()}`,
    `24h Change: ${change24h.toFixed(2)}%`,
    "",
    `_Data from CoinGecko • ${new Date().toLocaleTimeString()}_`
  ].join("\n");
}

// ========== MAIN BOT LOGIC ==========
async function checkCoins() {
  if (isRunning) {
    logger.debug("Bot already running, skipping check");
    return;
  }

  isRunning = true;
  lastCheckTime = new Date().toISOString();
  totalChecks++;

  try {
    const snapshot = await getMarketSnapshot();
    const enabledCoins = config.coins.filter(c => c.enabled);

    for (const coin of enabledCoins) {
      const market = snapshot[coin.id];
      if (!market) {
        logger.warn(`No market data for ${coin.symbol}`);
        continue;
      }

      updatePriceCache(coin.id, market.usd);

      const rsi = getRSI(priceCache[coin.id]);
      const signal = getSignal(rsi);

      if (signal === "NO_TRADE") {
        logger.debug(`${coin.symbol}: NO_TRADE (RSI: ${rsi?.toFixed(2) || "N/A"})`);
        continue;
      }

      const key = coin.symbol;

      // Check if signal changed
      if (lastSignal[key] === signal) {
        logger.debug(
          `${coin.symbol}: Signal unchanged (${signal})`
        );
        continue;
      }

      // Signal change detected!
      lastSignal[key] = signal;
      totalAlerts++;

      const message = formatMessage(
        signal,
        coin,
        rsi,
        market.php,
        market.php_24h_change || 0
      );

      logger.info(`Signal generated: ${signal} for ${coin.symbol}`, {
        rsi: rsi.toFixed(2),
        price: market.php
      });

      logger.logTrade({
        signal,
        symbol: coin.symbol,
        rsi: rsi.toFixed(2),
        price: market.php,
        change24h: market.php_24h_change || 0
      });

      await sendMessage(message);

      await new Promise(r =>
        setTimeout(r, config.intervals.apiDelay)
      );
    }

    isBotHealthy = true;
  } catch (err) {
    logger.error("Bot check error", { error: err.message });
    isBotHealthy = false;
    lastErrorTime = new Date().toISOString();
  } finally {
    isRunning = false;
    // Save state
    storage.save("lastSignal", lastSignal);
    storage.save("priceCache", priceCache);
    storage.save("botStats", { totalChecks, totalAlerts });
  }
}

// ========== BOT STARTUP ==========
async function startBot() {
  logger.info(
    "Bot starting...",
    { version: "2.0", coins: config.coins.filter(c => c.enabled).length }
  );

  // Load price history
  const enabledCoins = config.coins.filter(c => c.enabled);
  for (const coin of enabledCoins) {
    await loadInitialHistory(coin.id);
    await new Promise(r =>
      setTimeout(r, config.intervals.historyLoadDelay)
    );
  }

  logger.info("Initial history loaded");

  // First check
  await checkCoins();

  // Regular interval checks
  setInterval(checkCoins, config.intervals.checkInterval);
  logger.info(
    `Checks scheduled every ${config.intervals.checkInterval / 1000 / 60} minutes`
  );

  // Health check interval
  if (config.web.enableHealthCheck) {
    setInterval(() => {
      if (lastErrorTime) {
        const timeSinceError =
          Date.now() - new Date(lastErrorTime).getTime();
        if (timeSinceError > 5 * 60 * 1000) {
          isBotHealthy = true;
          logger.info("Bot health recovered");
        }
      }
    }, config.intervals.healthCheckInterval);
  }

  // Setup Telegram polling
  if (config.notifications.telegram.enabled) {
    logger.info("Telegram polling enabled");
    setupTelegramPolling();
  }

  logger.info("Bot fully started");
}

// ========== ERROR HANDLERS ==========
process.on("uncaughtException", err => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", err => {
  logger.error("Unhandled rejection", {
    error: err?.message || String(err)
  });
});

// ========== START ==========
startBot().catch(err => {
  logger.error("Fatal startup error", { error: err.message });
  process.exit(1);
});