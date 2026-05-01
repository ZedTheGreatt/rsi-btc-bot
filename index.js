require('dotenv').config();
const gainzWrapper = require('./gainz/wrapper');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const { getMarketAnalysis, getChartBuffer } = require('./indicators');
const { buildSignalArtifacts } = require('./charts/signalIntegration');

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

function formatPeso(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toNumberSafe(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeContextScore(data) {
  const ema50 = toNumberSafe(data.ema50Raw, toNumberSafe(String(data.ema50 || '').replace(/,/g, ''), 0));
  const ema200 = toNumberSafe(data.ema200Raw, toNumberSafe(String(data.ema200 || '').replace(/,/g, ''), 0));
  const price = toNumberSafe(String(data.pricePHP || '').replace(/,/g, ''), 0);
  const rsi = toNumberSafe(data.rsiRaw ?? data.rsi, 50);
  const atrValues = Array.isArray(data.atrValues) ? data.atrValues : [];
  const atr = atrValues.length > 0 ? toNumberSafe(atrValues[atrValues.length - 1], 0) : 0;
  const atrAvg = atrValues.length > 10
    ? atrValues.slice(-10).reduce((a, b) => a + toNumberSafe(b, 0), 0) / 10
    : atr;
  const volume = toNumberSafe(data.volume, 0);
  const volumeEMA = toNumberSafe(data.volumeEMA, 0);

  let score = 0;
  const trendAligned = (ema50 > ema200 && price > ema200) || (ema50 < ema200 && price < ema200);
  if (trendAligned) score += 30;
  else score += 12;

  const momentumOk = (ema50 > ema200 && rsi >= 50) || (ema50 < ema200 && rsi <= 50);
  if (momentumOk) score += 20;
  else score += 8;

  if (atr > 0 && atr >= atrAvg) score += 20;
  else if (atr > 0) score += 10;

  if (volumeEMA > 0 && volume >= volumeEMA) score += 15;
  else if (volume > 0) score += 7;

  // small remaining confidence from available market data
  score += 10;

  return Math.max(0, Math.min(95, Math.round(score)));
}

function normalizeGainzForDisplay(rawGainz, data) {
  const gainz = rawGainz || {};
  const hasBadSignal = !gainz.signal || String(gainz.signal).includes('NO DATA');
  const hasBadTrend = !gainz.trend || String(gainz.trend).toUpperCase() === 'UNKNOWN';
  const hasBadPlan =
    !Number.isFinite(Number(gainz.entry)) ||
    Number(gainz.entry) <= 0 ||
    !Number.isFinite(Number(gainz.tp1)) ||
    !Number.isFinite(Number(gainz.tp2)) ||
    !Number.isFinite(Number(gainz.sl));

  if (!hasBadSignal && !hasBadTrend && !hasBadPlan) {
    const rawScore = toNumberSafe(gainz.score, 0);
    const displayScore = rawScore > 0 ? rawScore : computeContextScore(data);
    return {
      signal: gainz.signal,
      score: displayScore,
      trend: gainz.trend,
      entry: toNumberSafe(gainz.entry, 0),
      tp1: toNumberSafe(gainz.tp1, 0),
      tp2: toNumberSafe(gainz.tp2, 0),
      sl: toNumberSafe(gainz.sl, 0),
      reason: gainz.reason || ''
    };
  }

  const ema50 = toNumberSafe(data.ema50Raw, toNumberSafe(String(data.ema50 || '').replace(/,/g, ''), 0));
  const ema200 = toNumberSafe(data.ema200Raw, toNumberSafe(String(data.ema200 || '').replace(/,/g, ''), 0));
  const price = toNumberSafe(String(data.pricePHP || '').replace(/,/g, ''), 0);
  const atr = Array.isArray(data.atrValues) && data.atrValues.length > 0
    ? toNumberSafe(data.atrValues[data.atrValues.length - 1], 0)
    : Math.max(price * 0.008, 1);

  const isBull = ema50 > ema200 && price > ema200;
  const isBear = ema50 < ema200 && price < ema200;
  const trend = isBull ? '📈 BULLISH' : isBear ? '📉 BEARISH' : '⚪ SIDEWAYS';

  const entry = price;
  const tp1 = isBull ? entry + (atr * 1.5) : isBear ? entry - (atr * 1.5) : entry + (atr * 0.8);
  const tp2 = isBull ? entry + (atr * 2.5) : isBear ? entry - (atr * 2.5) : entry + (atr * 1.2);
  const sl = isBull ? entry - (atr * 1.2) : isBear ? entry + (atr * 1.2) : entry - (atr * 0.8);

  return {
    signal: isBull ? '⚪ NO TRADE' : isBear ? '⚪ NO TRADE' : '⚪ NO TRADE',
    score: (() => {
      const rawScore = toNumberSafe(gainz.score, 0);
      return rawScore > 0 ? rawScore : computeContextScore(data);
    })(),
    trend,
    entry,
    tp1,
    tp2,
    sl,
    reason: gainz.reason || 'Fallback model used (engine returned incomplete data).'
  };
}

function analyzeGainz(data) {
  const ohlcBars = Array.isArray(data.ohlcBars) ? data.ohlcBars : (Array.isArray(data.candles) ? data.candles : []);
  const rawGainz = gainzWrapper({
    ohlcBars,
    candles: ohlcBars,
    ema50: data.ema50Raw ?? Number(String(data.ema50).replace(/,/g, '')),
    ema200: data.ema200Raw ?? Number(String(data.ema200).replace(/,/g, '')),
    rsi: data.rsiRaw ?? Number(data.rsi),
    atrValues: data.atrValues || [],
    volume: data.volume || 0,
    volumeEMA: data.volumeEMA || 0
  });

  return normalizeGainzForDisplay(rawGainz, data);
}

function getAlignedIndicatorValue(values, candleIndex, period) {
  if (!Array.isArray(values)) return undefined;
  const indicatorIndex = candleIndex - (period - 1);
  return indicatorIndex >= 0 ? values[indicatorIndex] : undefined;
}

function getSignalType(rawSignal) {
  const signalText = String(rawSignal || '').toUpperCase();
  if (signalText.includes('BUY')) return 'BUY';
  if (signalText.includes('SELL')) return 'SELL';
  return null;
}

function buildDirectionalSignalCandidate({ candles, candleIndex, ema50, ema200, rsi, atr, volumeEMA, rawGainz }) {
  const current = candles[candleIndex];
  const previous = candles[candleIndex - 1];
  if (!current || !previous) return null;

  const rawSignalType = getSignalType(rawGainz?.signal);
  const rawScore = toNumberSafe(rawGainz?.score, 0);
  const entry = current.c;
  const safeAtr = Math.max(toNumberSafe(atr, Math.abs(current.h - current.l) || entry * 0.006), entry * 0.001);
  const range = Math.max(current.h - current.l, entry * 0.0001);
  const body = Math.max(Math.abs(current.c - current.o), range * 0.05);
  const upperWick = current.h - Math.max(current.o, current.c);
  const lowerWick = Math.min(current.o, current.c) - current.l;
  const closePosition = (current.c - current.l) / range;
  const lookback = candles.slice(Math.max(0, candleIndex - 12), candleIndex + 1);
  const swingLow = Math.min(...lookback.map(c => c.l));
  const swingHigh = Math.max(...lookback.map(c => c.h));
  const volumeOk = !Number.isFinite(Number(volumeEMA)) || volumeEMA <= 0 || current.v >= volumeEMA * 0.85;
  const rsiValue = toNumberSafe(rsi, 50);
  const bullishTrend = ema50 >= ema200;
  const bearishTrend = ema50 <= ema200;

  let buyScore = 0;
  let sellScore = 0;

  if (rawSignalType === 'BUY') buyScore += rawScore;
  if (rawSignalType === 'SELL') sellScore += rawScore;

  if (lowerWick >= body * 0.85) buyScore += 18;
  if (upperWick >= body * 0.85) sellScore += 18;
  if (current.c > current.o) buyScore += 12;
  if (current.c < current.o) sellScore += 12;
  if (closePosition >= 0.56) buyScore += 12;
  if (closePosition <= 0.44) sellScore += 12;
  if (rsiValue <= 45) buyScore += 18;
  else if (rsiValue <= 55) buyScore += 9;
  if (rsiValue >= 55) sellScore += 18;
  else if (rsiValue >= 45) sellScore += 9;
  if (current.l <= swingLow + safeAtr * 0.55) buyScore += 13;
  if (current.h >= swingHigh - safeAtr * 0.55) sellScore += 13;
  if (bullishTrend && current.c >= ema50 * 0.99) buyScore += 10;
  if (bearishTrend && current.c <= ema50 * 1.01) sellScore += 10;
  if (current.l <= ema50 && current.c > ema50) buyScore += 9;
  if (current.h >= ema50 && current.c < ema50) sellScore += 9;
  if (previous.c < previous.o && current.c > previous.o) buyScore += 9;
  if (previous.c > previous.o && current.c < previous.o) sellScore += 9;
  if (volumeOk) {
    buyScore += 8;
    sellScore += 8;
  }

  const signal = buyScore >= sellScore ? 'BUY' : 'SELL';
  const score = Math.max(buyScore, sellScore);
  const minScore = rawSignalType ? 48 : 54;

  if (score < minScore) return null;

  return {
    signal,
    score: Math.min(100, Math.round(score)),
    trend: bullishTrend ? 'BULLISH' : bearishTrend ? 'BEARISH' : 'SIDEWAYS',
    rsi: rsiValue,
    entry,
    tp1: signal === 'BUY' ? entry + safeAtr * 1.5 : entry - safeAtr * 1.5,
    tp2: signal === 'BUY' ? entry + safeAtr * 2.5 : entry - safeAtr * 2.5,
    sl: signal === 'BUY' ? entry - safeAtr * 1.2 : entry + safeAtr * 1.2
  };
}

function pushAlternatingSignal(signals, nextSignal, minGap = 1) {
  if (!nextSignal) return;

  const last = signals[signals.length - 1];
  if (!last) {
    signals.push(nextSignal);
    return;
  }

  if (last.signal === nextSignal.signal) {
    const closeEnoughToReplace = nextSignal.index - last.index <= minGap;
    const stronger = toNumberSafe(nextSignal.strength, 0) > toNumberSafe(last.strength, 0);
    if (closeEnoughToReplace && stronger) {
      signals[signals.length - 1] = nextSignal;
    }
    return;
  }

  if (nextSignal.index - last.index >= minGap) {
    signals.push(nextSignal);
  }
}

function buildGainzSignalHistory(data, visibleCandles = 73) {
  const candles = Array.isArray(data?.ohlcBars) ? data.ohlcBars : [];
  if (candles.length === 0) {
    return {
      signals: [],
      latest: null
    };
  }

  const startIndex = Math.max(1, candles.length - visibleCandles);
  const signals = [];

  for (let candleIndex = startIndex; candleIndex < candles.length; candleIndex += 1) {
    const ema50 = getAlignedIndicatorValue(data.ema50Values, candleIndex, 50);
    const ema200 = getAlignedIndicatorValue(data.ema200Values, candleIndex, 200);
    const rsi = getAlignedIndicatorValue(data.rsiValues, candleIndex, 15);
    const volumeEMA = getAlignedIndicatorValue(data.volumeEMAValues, candleIndex, 20);
    const atrEndIndex = candleIndex - 14 + 1;

    if (
      !Number.isFinite(Number(ema50)) ||
      !Number.isFinite(Number(ema200)) ||
      !Number.isFinite(Number(rsi)) ||
      atrEndIndex <= 0
    ) {
      continue;
    }

    const candleSlice = candles.slice(0, candleIndex + 1);
    const atrValues = Array.isArray(data.atrValues) ? data.atrValues.slice(0, atrEndIndex) : [];
    const rawGainz = gainzWrapper({
      ohlcBars: candleSlice,
      candles: candleSlice,
      ema50,
      ema200,
      rsi,
      atrValues,
      volume: candles[candleIndex].v || 0,
      volumeEMA: Number.isFinite(Number(volumeEMA)) ? volumeEMA : 0
    });
    const latestAtr = atrValues[atrValues.length - 1];
    const candidate = buildDirectionalSignalCandidate({
      candles,
      candleIndex,
      ema50,
      ema200,
      rsi,
      atr: latestAtr,
      volumeEMA,
      rawGainz
    });

    const artifacts = buildSignalArtifacts(candidate, candleIndex, candles, {
      rsi,
      trend: candidate?.trend || rawGainz?.trend || data.trend,
      currency: 'PHP',
      score: candidate?.score || rawGainz?.score
    });

    if (artifacts?.signal) {
      pushAlternatingSignal(signals, artifacts.signal);
    }
  }

  return {
    signals,
    latest: signals[signals.length - 1] || null
  };
}

async function getSignalChartBuffer(data, signalHistory) {
  const signals = Array.isArray(signalHistory?.signals) ? signalHistory.signals : [];
  if (signals.length === 0) return data.chartBuffer;

  const buffer = await getChartBuffer(
    data.ohlcBars || [],
    data.ema50Values || [],
    data.ema200Values || [],
    data.rsiValues || [],
    data.pair || data.symbol,
    signals
  );

  return buffer || data.chartBuffer;
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
      const gainz = analyzeGainz(data);

      if (!gainz) continue;

      if (gainz.score >= 70 || forceNotify) {
        const signalHistory = buildGainzSignalHistory(data);
        const chartBuffer = await getSignalChartBuffer(data, signalHistory);
        const hasTradePlan =
          Number.isFinite(Number(gainz.entry)) &&
          Number.isFinite(Number(gainz.tp1)) &&
          Number.isFinite(Number(gainz.tp2)) &&
          Number.isFinite(Number(gainz.sl)) &&
          Number(gainz.entry) > 0;
        const trendLabel = gainz.trend || data.trend || '⚪ SIDEWAYS';
        const noTradeReason = gainz.reason ? `Reason: ${gainz.reason}` : 'Reason: Waiting for valid breakout/pullback confirmation.';
        const message = [
          `*${gainz.signal} ${coinLogo[data.symbol] || data.symbol}*`,
          `🧠 Gainz Score: *${gainz.score}/100*`,
          `🤖 _${data.recommendation}_`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `📊 *MARKET STRUCTURE*`,
          `Trend: ${trendLabel}`,
          `RSI (14): ${data.rsi}`,
          `EMA 50: ₱${data.ema50}`,
          `EMA 200: ₱${data.ema200}`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `💰 *PRICE*`,
          `PHP: ₱${data.pricePHP}`,
          `USDT: $${data.priceUSDT}`,
          `24H: ${formatChange(data.change)}`,
          `🌐 [Live Chart](https://www.coins.ph/en-ph/trade/${data.symbol}/PHP)`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `🎯 *TRADE PLAN*`,
          ...(hasTradePlan
            ? [
                `Entry: ₱${formatPeso(gainz.entry)}`,
                `TP1: ₱${formatPeso(gainz.tp1)}`,
                `TP2: ₱${formatPeso(gainz.tp2)}`,
                `SL: ₱${formatPeso(gainz.sl)}`,
              ]
            : ['No trade setup yet.', noTradeReason]),
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `⚡ _CoinsBot 2026_`,
          `Powered by Coins.ph API`,
          `⚠️ Market data may be delayed or slightly inaccurate`
        ].join('\n');

        await safeSendChartAndText(targetChatId, chartBuffer, message, {
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
    const gainz = analyzeGainz(data);
    const signalHistory = buildGainzSignalHistory(data);
    const chartBuffer = await getSignalChartBuffer(data, signalHistory);

    const reportMessage = [
        `*${data.sign} ${coinLogo[data.symbol] || data.symbol}*`,
        `🤖 _${data.recommendation}_`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `💵 *PRICE*`,
        `🌐 [Live Price](https://www.coins.ph/en-ph/trade/${data.symbol}/PHP)`,
        `₱ PHP: ₱${data.pricePHP}`,
        `$ USDT: $${data.priceUSDT}`,
        `🔁 24H Change: ${formatChange(data.change)}`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `⚡ _CoinsBot 2026_`,
        `Powered by Coins.ph API`,
        `⚠️ Market data may be delayed or slightly inaccurate`
        ].join('\n');
        
    await safeSendChartAndText(msg.chat.id, chartBuffer, reportMessage, { parse_mode: 'Markdown' });
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
