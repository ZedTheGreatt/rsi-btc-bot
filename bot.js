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

const COMMAND_ALIASES = {
  set_thresholds: "set_rsi"
};

function normalizeCommand(command) {
  return COMMAND_ALIASES[command] || command;
}

function isCommandAllowed(command) {
  const allowed = config.admin?.allowedCommands || [];
  return allowed.length === 0 || allowed.includes(command);
}

function findCoin(query) {
  const normalized = String(query || "").trim().toLowerCase();
  return config.coins.find(
    coin =>
      coin.id.toLowerCase() === normalized ||
      coin.symbol.toLowerCase() === normalized
  );
}

function saveConfig() {
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

async function handleAdminCommand(message) {
  const text = message.text.trim();
  const parts = text.split(/\s+/);
  const rawCommand = parts[0].replace(/^\//, "").toLowerCase();
  const command = normalizeCommand(rawCommand);

  if (!command) return;
  if (!isCommandAllowed(command)) {
    await sendMessage(`❌ Command \/${rawCommand} is not allowed.`);
    return;
  }

  try {
    switch (command) {
      case "status":
        return await sendStatus();
      case "health":
        return await sendHealth();
      case "stats":
        return await sendStats();
      case "coins":
        return await sendCoinsList();
      case "price":
        return await sendPrice(parts[1]);
      case "history":
        return await sendHistory(parseInt(parts[1], 10) || 10);
      case "enable_coin":
        return await setCoinEnabled(parts[1], true);
      case "disable_coin":
        return await setCoinEnabled(parts[1], false);
      case "toggle_coin":
        return await toggleCoin(parts[1]);
      case "set_rsi":
        return await updateRSIThresholds(parts);
      case "settings":
        return await sendSettings();
      case "restart":
        return await restartBot();
      case "help":
      default:
        return await sendHelp();
    }
  } catch (err) {
    logger.error("Admin command error", { command, error: err.message });
    await sendMessage(`❌ Error executing command: ${err.message}`);
  }
}

async function sendStatus() {
  const enabledCoins = config.coins.filter(c => c.enabled);
  const status = [
    "📊 *BOT STATUS*",
    `Status: ${isBotHealthy ? "🟢 Healthy" : "🔴 Unhealthy"}`,
    `Total Checks: ${totalChecks}`,
    `Total Alerts: ${totalAlerts}`,
    `Uptime: ${Math.floor(process.uptime() / 60)}min`,
    `Monitored: ${enabledCoins.map(c => c.symbol).join(", ")}`,
    `Last Check: ${lastCheckTime || "never"}`
  ].join("\n");

  await sendMessage(status);
}

async function sendHealth() {
  const health = [
    "🩺 *BOT HEALTH*",
    `Status: ${isBotHealthy ? "🟢 Healthy" : "🔴 Unhealthy"}`,
    `Last Error: ${lastErrorTime || "none"}`,
    `Last Check: ${lastCheckTime || "never"}`,
    `Total Checks: ${totalChecks}`
  ].join("\n");

  await sendMessage(health);
}

async function sendStats() {
  await sendMessage(
    `📈 *STATS*\nTotal Checks: ${totalChecks}\nTotal Alerts: ${totalAlerts}\nCached Coins: ${Object.keys(priceCache).length}`
  );
}

async function sendSettings() {
  const thresholds = config.rsi;
  const intervals = config.intervals;
  const notifications = config.notifications.telegram;

  const msg = [
    "⚙️ *CURRENT SETTINGS*",
    `RSI period: ${thresholds.period}`,
    `Strong Buy: ${thresholds.strongBuy}`,
    `Buy Zone: ${thresholds.buyZone}`,
    `Sell Zone: ${thresholds.sellZone}`,
    `Strong Sell: ${thresholds.strongSell}`,
    "",
    `Check Interval: ${intervals.checkInterval / 60000} min`,
    `API Delay: ${intervals.apiDelay} ms`,
    `History Load Delay: ${intervals.historyLoadDelay} ms`,
    "",
    `Telegram notifications: ${notifications.enabled ? "✅" : "❌"}`
  ].join("\n");

  await sendMessage(msg);
}

async function sendPrice(query) {
  if (!query) {
    await sendMessage("Usage: `/price bitcoin` or `/price BTC`");
    return;
  }

  const coin = findCoin(query);
  if (!coin) {
    await sendMessage(`❌ Coin not found: ${query}`);
    return;
  }

  try {
    const res = await retryWithBackoff(async () => {
      return await axios.get(`${config.api.coingecko.baseUrl}/simple/price`, {
        params: {
          ids: coin.id,
          vs_currencies: "php,usd",
          include_24hr_change: true
        },
        timeout: config.api.coingecko.timeout
      });
    }, config.api.coingecko.retries);

    const data = res.data[coin.id];
    if (!data) {
      await sendMessage(`⚠️ Price data unavailable for ${coin.symbol}`);
      return;
    }

    await sendMessage([
      `💱 *${coin.symbol} PRICE*`,
      `${coin.emoji} ${coin.symbol}`,
      `USD: $${data.usd.toLocaleString()}`,
      `PHP: ₱${data.php.toLocaleString()}`,
      `24h Change: ${data.php_24h_change?.toFixed(2) || 0}%`
    ].join("\n"));
  } catch (err) {
    logger.error("Price query failed", { coin: coin.id, error: err.message });
    await sendMessage(`❌ Failed to fetch price for ${coin.symbol}`);
  }
}

async function setCoinEnabled(identifier, enabled) {
  if (!identifier) {
    await sendMessage(`Usage: /${enabled ? "enable_coin" : "disable_coin"} <coin>`);
    return;
  }

  const coin = findCoin(identifier);
  if (!coin) {
    await sendMessage(`❌ Coin not found: ${identifier}`);
    return;
  }

  coin.enabled = enabled;
  saveConfig();
  await sendMessage(`✅ ${coin.symbol} is now ${enabled ? "enabled" : "disabled"}.`);
}

async function toggleCoin(identifier) {
  if (!identifier) {
    await sendMessage("Usage: /toggle_coin <coin>");
    return;
  }

  const coin = findCoin(identifier);
  if (!coin) {
    await sendMessage(`❌ Coin not found: ${identifier}`);
    return;
  }

  coin.enabled = !coin.enabled;
  saveConfig();
  await sendMessage(`✅ ${coin.symbol} has been ${coin.enabled ? "enabled" : "disabled"}.`);
}

async function restartBot() {
  await sendMessage("🔄 Restarting bot...");
  logger.info("Bot restart requested via Telegram");
  process.exit(0);
}

async function updateRSIThresholds(parts) {
  if (parts.length < 3) {
    await sendMessage("Usage: `/set_rsi 40 60` (buyZone sellZone)");
    return;
  }

  const buyZone = parseFloat(parts[1]);
  const sellZone = parseFloat(parts[2]);

  if (isNaN(buyZone) || isNaN(sellZone) || buyZone >= sellZone) {
    await sendMessage("❌ Invalid values. Buy zone must be less than sell zone.");
    return;
  }

  config.rsi.buyZone = buyZone;
  config.rsi.sellZone = sellZone;
  saveConfig();
  logger.info("RSI thresholds updated", { buyZone, sellZone });

  await sendMessage(`✅ RSI thresholds updated\nBuy Zone: ${buyZone}\nSell Zone: ${sellZone}`);
}

async function sendHistory(limit = 10) {
  const trades = logger.getTrades(limit);
  if (trades.length === 0) {
    await sendMessage("📭 No trades recorded yet.");
    return;
  }

  let msg = `📜 *RECENT TRADES* (last ${limit})\n\n`;
  trades.forEach((trade, idx) => {
    const icon = trade.signal.includes("BUY") ? "🟢" : "🔴";
    msg += `${idx + 1}. ${icon} ${trade.signal} - ${trade.symbol} @ ${trade.rsi} RSI\n`;
  });

  await sendMessage(msg);
}

async function sendCoinsList() {
  let msg = "💰 *MONITORED COINS*\n\n";
  config.coins.forEach(coin => {
    const status = coin.enabled ? "✅" : "❌";
    msg += `${status} ${coin.emoji} ${coin.symbol} (${coin.id})\n`;
  });
  msg += "\nUse /enable_coin, /disable_coin or /toggle_coin to update coins.";
  await sendMessage(msg);
}

async function sendHelp() {
  const help = [
    "🤖 *AVAILABLE COMMANDS*",
    "/status - Show bot status",
    "/health - Show health details",
    "/stats - Show numeric bot stats",
    "/coins - List monitored coins",
    "/price <coin> - Show current price for a coin",
    "/history [limit] - Show recent trades",
    "/set_rsi <buy_zone> <sell_zone> - Update RSI thresholds",
    "/enable_coin <coin> - Enable monitoring for a coin",
    "/disable_coin <coin> - Disable monitoring for a coin",
    "/toggle_coin <coin> - Toggle coin monitoring",
    "/settings - Show current bot settings",
    "/restart - Restart the bot",
    "/help - Show this message"
  ].join("\n");

  await sendMessage(help);
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