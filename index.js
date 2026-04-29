require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const { getMarketAnalysis } = require('./indicators');

const app = express();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const coinList = (process.env.COINS || '')
  .split(',')
  .map(c => c.trim())
  .filter(Boolean);

if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
if (!chatId) throw new Error('Missing TELEGRAM_CHAT_ID');
if (!coinList.length) throw new Error('Missing COINS');

const bot = new TelegramBot(token, { polling: false });

let isBotActive = true;

app.get('/', (req, res) => res.send('CoinsBot running'));

app.listen(process.env.PORT || 3000, () => {
  console.log('CoinsBot online');
});

// =========================
// SEND HELPERS
// =========================
async function send(chat, text) {
  try {
    await bot.sendMessage(chat, text, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Send error:', e.message);
  }
}

async function sendChart(chat, buffer, caption) {
  try {
    if (!buffer) return send(chat, caption);

    await bot.sendPhoto(chat, buffer, {
      caption,
      parse_mode: 'Markdown'
    });
  } catch (e) {
    console.error('Chart send error:', e.message);
  }
}

// =========================
// CORE LOOP
// =========================
async function process(force = false, target = chatId) {
  if (!isBotActive && !force) return;

  for (const coin of coinList) {
    try {
      const data = await getMarketAnalysis(coin);
      if (!data) continue;

      if (data.alert || force) {
        const msg = [
          `${data.sign}`,
          `*${data.symbol}*`,
          ``,
          `🧠 ${data.recommendation}`,
          ``,
          `📊 GainzAlgo: ${data.gainzAlgo}`,
          `💰 PHP: ₱${data.pricePHP}`,
          `💵 USDT: $${data.priceUSDT}`,
          `📈 24h: ${data.change}%`,
          ``,
          `_CoinsBot 2026_`
        ].join('\n');

        await sendChart(target, data.chartBuffer, msg);
      }

    } catch (err) {
      console.error('Process error:', err.message);
    }
  }
}

// =========================
// COMMANDS
// =========================
bot.onText(/\/start/, msg => {
  isBotActive = true;
  send(msg.chat.id, '🤖 Bot started');
});

bot.onText(/\/end/, msg => {
  isBotActive = false;
  send(msg.chat.id, '🛑 Bot stopped');
});

bot.onText(/\/now/, async msg => {
  await send(msg.chat.id, '📊 Generating...');
  await process(true, msg.chat.id);
});

bot.onText(/\/coins/, msg => {
  send(msg.chat.id, `📌 Coins:\n${coinList.join('\n')}`);
});

bot.onText(/\/price (.+)/, async (msg, match) => {
  const coin = match[1];

  await send(msg.chat.id, '📊 Loading chart...');

  const data = await getMarketAnalysis(coin);

  if (!data) return send(msg.chat.id, 'Invalid coin');

  const msgText = [
    `${data.sign}`,
    `*${data.symbol}*`,
    `🧠 ${data.recommendation}`,
    `💰 ₱${data.pricePHP}`
  ].join('\n');

  await sendChart(msg.chat.id, data.chartBuffer, msgText);
});

bot.onText(/\/help/, msg => {
  send(msg.chat.id,
`Commands:
/start
/end
/now
/coins
/price BTC`);
});

// =========================
// CRON
// =========================
cron.schedule('0 * * * *', () => {
  console.log('Hourly scan...');
  process(false);
});

// =========================
// START
// =========================
console.log('Bot starting...');