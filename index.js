require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const { getMarketAnalysis } = require('./indicators');

const app = express();

// =========================
// CONFIG
// =========================
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const coinList = (process.env.COINS || '')
  .split(',')
  .map(c => c.trim())
  .filter(Boolean);

if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
if (!chatId) throw new Error('Missing TELEGRAM_CHAT_ID');
if (!coinList.length) throw new Error('Missing COINS');

// IMPORTANT: polling false first
const bot = new TelegramBot(token, { polling: false });

const coinLogo = {
  BTC: '₿ BTC ₿',
  ETH: '⟠ ETH ⟠',
  SOL: '◎ SOL ◎',
  XRP: '✕ XRP ✕'
};

// =========================
// STATE
// =========================
let isBotActive = true;
let pollingStarted = false;
let restarting = false;

// =========================
// EXPRESS SERVER
// =========================
app.get('/', (req, res) => {
  res.status(200).send('CoinsBot is running.');
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`CoinsBot running on port ${PORT}`);
});

// =========================
// HELPERS
// =========================
function normalizeInputSymbol(rawSymbol) {
  const symbol = String(rawSymbol || '').toUpperCase().trim();

  if (!symbol) return null;
  if (symbol.endsWith('USDT')) return symbol;
  if (symbol.endsWith('USD')) return `${symbol}T`;
  if (symbol.endsWith('PHP')) return symbol;

  return `${symbol}PHP`;
}

function formatCoinsList(coins) {
  return coins
    .map(c => {
      const clean = c.replace(/(USDT|USD|PHP)$/i, '').trim().toUpperCase();
      return coinLogo[clean] || `⚪ ${clean}`;
    })
    .join('\n');
}

function formatChange(change) {
  const percent = Number(change || 0) * 100;
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

// Function to send standard text without charts
async function safeSend(chatId, text, options = {}) {
  try {
    await bot.sendMessage(chatId, text, options);
  } catch (err) {
    console.error('Send message failed:', err.message);
  }
}

// New Function specifically capable of pairing Images to your alert Captions
async function safeSendChartAndText(chatId, buffer, caption, options = {}) {
  try {
    if (buffer) {
      await bot.sendPhoto(chatId, buffer, {
        ...options, 
        caption: caption
      }, {
        filename: 'chart.png', 
        contentType: 'image/png' 
      });
    } else {
      // Graceful fallback to text formatting in case the image fails to generate
      await safeSend(chatId, caption, options);
    }
  } catch (err) {
    console.error('Send chart message failed:', err.message);
  }
}


// =========================
// POLLING CONTROL
// =========================
let reconnectDelay = 5000;
const MAX_DELAY = 60000;

async function startPolling() {
  if (pollingStarted || restarting) {
    console.log('Polling already active / restarting');
    return;
  }

  try {
    restarting = true;

    await bot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});
    await bot.stopPolling().catch(() => {});

    await bot.startPolling({
      restart: true,
      interval: 2000,
      autoStart: false,
      params: { timeout: 30 }
    });

    pollingStarted = true;
    reconnectDelay = 5000;
    console.log('CoinsBot polling started');
  } catch (err) {
    console.error('Start polling failed:', err.message);
    await restartPolling(reconnectDelay);
  } finally {
    restarting = false;
  }
}

async function stopPolling() {
  try {
    pollingStarted = false;
    await bot.stopPolling().catch(() => {});
    console.log('CoinsBot polling stopped');
  } catch (err) {
    console.error('Stop polling failed:', err.message);
  }
}

async function restartPolling(delay = reconnectDelay) {
  if (restarting) {
    console.log('Restart already in progress');
    return;
  }

  restarting = true;
  pollingStarted = false;

  await bot.stopPolling().catch(() => {});
  console.log(`Restarting CoinsBot in ${delay / 1000}s...`);

  setTimeout(async () => {
    try {
      reconnectDelay = Math.min(delay * 2, MAX_DELAY);
      await startPolling();
    } catch (err) {
      console.error('Restart failed:', err.message);
    } finally {
      restarting = false;
    }
  }, delay);
}
// =========================
// CORE UPDATE LOGIC
// =========================
async function processUpdates(forceNotify = false, targetChatId = chatId) {
  if (!isBotActive && !forceNotify) return;

  for (const symbol of coinList) {
    try {
      const data = await getMarketAnalysis(symbol);
      if (!data) continue;

      if (data.alert || forceNotify) {
        const message = [
          `${data.sign}`,
          `*—— ${coinLogo[data.symbol] || data.symbol} ——*`,
          `📝 *REC:* _${data.recommendation}_`,
          ``,
          `📊 *INDICATORS*`,
          `- Trend: ${data.trend}`, // <<< ADD THIS LINE
          `- RSI (14): ${data.rsi}`,
          `- EMA (50): ₱${data.ema50}`,
          `- EMA (200): ₱${data.ema200}`,
          ``,
          `💵 *PRICE*`,
          `- PHP: ₱${data.pricePHP}`,
          `- USDT: $${data.priceUSDT}`,
          `🔁 24h Change: ${formatChange(data.change)}%`,
          ``,
          `━━━━━━━━━━━━`,
          `© CoinsBot 2026 • Powered by Coins.ph API`,
          `⚠️ Market data may be delayed or vary slightly.`
        ].join('\n');

        await safeSendChartAndText(targetChatId, data.chartBuffer, message, {
          parse_mode: 'Markdown'
        });
      }
    } catch (err) {
      console.error(`Error processing ${symbol}:`, err.message);
    }
  }
}

// =========================
// TELEGRAM COMMANDS
// =========================
bot.onText(/\/start$/, async msg => {
  isBotActive = true;
  await safeSend(
    msg.chat.id,
    '🤖 *CoinsBot Activated*\nMonitoring every hour for strategic entry/exit zones.',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/end$/, async msg => {
  isBotActive = false;
  await safeSend(msg.chat.id, '🛑 *CoinsBot Paused*', { parse_mode: 'Markdown' });
});

bot.onText(/\/restart$/, async msg => {
  await safeSend(msg.chat.id, '🔄 *Restarting CoinsBot...*', { parse_mode: 'Markdown' });
  await restartPolling(2000);
});

bot.onText(/\/now$/, async msg => {
  await safeSend(msg.chat.id, '📡 *Fetching real-time market data & Generating Charts...*', { parse_mode: 'Markdown' });
  await processUpdates(true, msg.chat.id);
});

bot.onText(/\/coins$/, async msg => {
  const formatted = formatCoinsList(coinList);
  await safeSend(msg.chat.id, `📍 *Monitoring:*\n${formatted}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/price (.+)/, async (msg, match) => {
  try {
    const symbol = normalizeInputSymbol(match[1]);

    if (!symbol) {
      await safeSend(msg.chat.id, '❌ Invalid coin.');
      return;
    }

    const noticeMsg = await bot.sendMessage(msg.chat.id, '🛠 Generating report chart...');

    const data = await getMarketAnalysis(symbol);
    bot.deleteMessage(msg.chat.id, noticeMsg.message_id).catch(() => {});

    if (!data) {
      await safeSend(msg.chat.id, '❌ Coin not found on Pro Coins.PH Data base.');
      return;
    }

    const reportMessage = [
        `${data.sign}`,
          `*—— ${coinLogo[data.symbol] || data.symbol} ——*`,
          `📝 *REC:* _${data.recommendation}_`,
          ``,
          `📊 *INDICATORS*`,
          `- Trend: ${data.trend}`, // <<< ADD THIS LINE
          `- RSI (14): ${data.rsi}`,
          `- EMA (50): ₱${data.ema50}`,
          `- EMA (200): ₱${data.ema200}`,
          ``,
          `💵 *PRICE*`,
          `- PHP: ₱${data.pricePHP}`,
          `- USDT: $${data.priceUSDT}`,
          `🔁 24h Change: ${formatChange(data.change)}%`,
          ``,
          `━━━━━━━━━━━━`,
          `© CoinsBot 2026 • Powered by Coins.ph API`,
          `⚠️ Market data may be delayed or vary slightly.`
        ].join('\n');
        
    await safeSendChartAndText(msg.chat.id, data.chartBuffer, reportMessage, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(err.message);
    await safeSend(msg.chat.id, '⚠️ Failed to fetch price.');
  }
});

bot.onText(/\/help|\/commands/, async msg => {
  await safeSend(
    msg.chat.id,
    [
      '🤖 *CoinsBot Commands List:*',
      '/help or /commands - Show commands list',
      '/start - Start hourly alerts',
      '/end - Stop alerts',
      '/restart - Restart bot polling',
      '/now - Show market data now w/ charts',
      '/coins - List tracked coins',
      '/price [coin] - Price check and visual Chart.'
    ].join('\n'),
    { parse_mode: 'Markdown' }
  );
});

// =========================
// SCHEDULER
// =========================
cron.schedule('0 * * * *', async () => {
  console.log('Running hourly check...');
  await processUpdates(false);
});

// =========================
// ERROR HANDLING
// =========================
bot.on('polling_error', async (error) => {
  const msg = String(error.message || '');
  console.error('Polling error:', error.code, msg);

  const recoverable =
    msg.includes('409 Conflict') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EFATAL');

  if (recoverable) {
    console.log(`Recoverable error detected. Reconnecting in ${reconnectDelay / 1000}s...`);
    await restartPolling();
    return;
  }
  console.log('Non-recoverable polling error.');
});

bot.on('message', () => { reconnectDelay = 5000; });

process.on('unhandledRejection', (err) => { console.error('Unhandled rejection:', err); });
process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); });

// =========================
// SHUTDOWN
// =========================
async function shutdown(signal) {
  console.log(`${signal} received`);

  await stopPolling().catch(() => {});

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// =========================
// START
// =========================
console.log('CoinsBot starting...');
startPolling();