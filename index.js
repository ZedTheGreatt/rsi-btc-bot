require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const app = express();
const { getMarketAnalysis } = require('./indicators');

// Config
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const coinList = process.env.COINS.split(',');
const bot = new TelegramBot(token, { 
    polling: {
        params: {
            timeout: 10
        }
    } 
});
const coinLogo = {
    BTC: "₿ BTC",
    ETH: "⟠ ETH",
    SOL: "◎ SOL",
    XRP: "✕ XRP"
};

function normalizeInputSymbol(rawSymbol) {
    const symbol = String(rawSymbol || '').toUpperCase().trim();
    if (symbol.endsWith('USDT')) return symbol;
    if (symbol.endsWith('USD')) return `${symbol}T`;
    if (symbol.endsWith('PHP')) return symbol;
    return `${symbol}PHP`;
}

// State
let isBotActive = true;

// Render.com compatibility: Express server
const PORT = process.env.PORT;

if (PORT) {
    app.listen(PORT, () => {
        console.log("CoinsBot running on Render");
    });
} else {
    app.listen(3000, () => {
        console.log("CoinsBot running locally on 3000");
    });
}
/**
 * Core Message Generator
 */
async function processUpdates(forceNotify = false) {
    if (!isBotActive && !forceNotify) return;

    for (const symbol of coinList) {
        const data = await getMarketAnalysis(symbol);
        if (!data) continue;

        // Notify if it's a Buy/Sell signal OR if user requested /now
        if (data.alert || forceNotify) {
            const message = `
${data.sign}
💰*${data.pair}*
RSI: ${data.rsi} (${data.trend})
Price: ₮${data.priceUSDT}
Price: ₱${data.pricePHP}
24h Change: ${(data.change * 100).toFixed(2)}%
            `;
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
    }
}

// --- TELEGRAM COMMANDS ---

bot.onText(/\/start/, (msg) => {
    isBotActive = true;
    bot.sendMessage(msg.chat.id, "🤖*RSI Bot Activated*\nMonitoring every hour for Buy/Sell zones.", { parse_mode: 'Markdown' });
});

bot.onText(/\/end/, (msg) => {
    isBotActive = false;
    bot.sendMessage(msg.chat.id, "🛑*Bot Paused*");
});

bot.onText(/\/restart/, (msg) => {
    bot.sendMessage(msg.chat.id, "🔄*Restarting monitor...*");
    processUpdates(true);
});

bot.onText(/\/now/, (msg) => {
    processUpdates(true);
});

bot.onText(/\/coins/, (msg) => {
    const coins = process.env.COINS.split(",");

    const formatted = coins
        .map(c => {
            const clean = c.replace(/(USDT|USD|PHP)$/, "").trim();
            return coinLogo[clean] || `⚪ ${clean}`;
        })
        .join("\n");

    bot.sendMessage(msg.chat.id, `📍 *Monitoring:*\n${formatted}`, {
        parse_mode: "Markdown"
    });
});

bot.onText(/\/price (.+)/, async (msg, match) => {
    const symbol = normalizeInputSymbol(match[1]);
    const data = await getMarketAnalysis(symbol);
    if (data) {
        bot.sendMessage(msg.chat.id, `💰 *${data.pair}*\nPrice: ₮${data.priceUSDT} \nPrice: ₱${data.pricePHP}\nRSI: ${data.rsi}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(msg.chat.id, "❌ Coin not found.");
    }
});

bot.onText(/\/help|\/commands/, (msg) => {
    bot.sendMessage(msg.chat.id, `
*Commands List:*
/start - Start hourly alerts
/end - Stop alerts
/restart - Clear state and check now
/now - Show market data for all coins
/coins - List tracked coins
/price [coin] - Quick price check (e.g. /price BTC)
    `, { parse_mode: 'Markdown' });
});

// --- SCHEDULER ---

// Runs every hour (at minute 0)
cron.schedule('0 * * * *', () => {
    console.log('Running Hourly Check...');
    processUpdates(false);
});

console.log('Telegram Bot is running...');

// Add this to index.js
bot.on('polling_error', (error) => {
    if (error.code === 'ECONNRESET') {
        console.log('Network connection reset. Retrying...');
    } else {
        console.error('Polling error:', error.code, error.message);
    }
});
