const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ CoinsBot activated (GainzAlgo v2)");
});

bot.onText(/\/now/, async (msg) => {
  bot.sendMessage(msg.chat.id, "⏳ Fetching live signals...");
  const { scanMarket } = require("./services/signalEngine");
  await scanMarket(true);
});

function sendSignal(text, image) {
  if (image) {
    bot.sendPhoto(chatId, image, { caption: text });
  } else {
    bot.sendMessage(chatId, text);
  }
}

module.exports = bot;
module.exports.sendSignal = sendSignal;