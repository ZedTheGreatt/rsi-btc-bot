# 🤖 CoinsBot (Coins.ph Edition)

CoinsBot is a Telegram bot for monitoring cryptocurrency pairs from the **Coins.ph Pro API** using technical indicators like **RSI (14)**, **EMA (50)**, and **EMA (200)**[cite: 3]. It can send hourly market updates, generate on-demand chart-based reports, and provide signal-style summaries directly in Telegram[cite: 3].

## ✨ Features

- **Hourly market monitoring** for all configured coins[cite: 3].
- **5-Tier Strategy Alerts** detecting Strong Buy/Sell and Buy/Sell Zones based on RSI and EMA confluence[cite: 2].
- **Trend detection** (📈 UPTREND, 📉 DOWNTREND, ⚪ SIDEWAYS) using **EMA 50** and **EMA 200** crossovers[cite: 2].
- **Dual price display** in **PHP** and **USDT**[cite: 3].
- **Visual Chart Generation** using QuickChart.io, plotting 73 hours of 1h OHLC candlesticks alongside EMA and RSI lines[cite: 2].
- **Telegram bot controls** for starting, stopping, and refreshing polling[cite: 3].
- **Health-check web server** for uptime monitoring / deployment platforms[cite: 3].
- **Resilient polling restart logic** for common Telegram connection issues[cite: 3].

## 🧰 Tech Stack

- **Node.js**[cite: 3]
- **node-telegram-bot-api**[cite: 3]
- **technicalindicators**[cite: 3]
- **axios** (Used for API calls and fetching QuickChart.io images)[cite: 2, 3]
- **node-cron**[cite: 3]
- **express**[cite: 3]
- **dotenv**[cite: 3]

## 📁 Project Structure
```text
.
├── index.js         # Telegram bot, scheduler, polling control, commands[cite: 3]
├── indicators.js    # Market analysis, 5-tier strategy logic, RSI/EMA calc, chart generation[cite: 3]
├── README.md
└── .env             # Environment variables (create this yourself)[cite: 3]
```

## ⚙️ Requirements

Before you begin, make sure you have:

- **Node.js 18+** recommended[cite: 3]
- A **Telegram bot token** from [@BotFather](https://t.me/BotFather)[cite: 3]
- Your Telegram **chat ID**[cite: 3]
- A valid list of tradable symbols supported by **Coins.ph Pro**[cite: 3]

## 🔐 Environment Variables

Create a `.env` file in the project root:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
COINS=BTCPHP,ETHPHP,SOLPHP,XRPPHP
PORT=3000
```

### Variable Notes

- `TELEGRAM_BOT_TOKEN` – Your Telegram bot token[cite: 3]
- `TELEGRAM_CHAT_ID` – Default chat ID where scheduled alerts are sent[cite: 3]
- `COINS` – Comma-separated list of symbols to monitor[cite: 3]
- `PORT` – Port used by the Express health-check server[cite: 3]

### Supported Input Formats

The bot normalizes user input for convenience:

- `BTC` → `BTCPHP`[cite: 1]
- `BTCUSD` → `BTCUSDT`[cite: 1]
- `BTCUSDT` → `BTCUSDT`[cite: 1]
- `BTCPHP` → `BTCPHP`[cite: 1]

> Scheduled monitoring uses the symbols from `COINS` exactly as configured[cite: 3].

## 📦 Installation
```bash
npm install
```

## ▶️ Running the Bot

```bash
npm start
```

When the bot starts, it will:

1. Load environment variables[cite: 3]
2. Start the Express server[cite: 3]
3. Initialize Telegram polling[cite: 3]
4. Schedule an hourly market check (`0 * * * *`)[cite: 1, 3]

## 🤖 Telegram Commands

| Command | Description |
|---|---|
| `/start` | Enable automated hourly monitoring alerts[cite: 1, 3] |
| `/end` | Pause automated alerts[cite: 1, 3] |
| `/restart` | Restart Telegram polling manually[cite: 1, 3] |
| `/now` | Trigger an immediate market analysis for all configured coins[cite: 1, 3] |
| `/coins` | Show the list of tracked coins[cite: 1, 3] |
| `/price [coin]` | Generate a report + chart for a specific coin[cite: 1, 3] |
| `/help` or `/commands` | Show the command list[cite: 1, 3] |

### Example
```text
/price SOL
```

This will normalize to `SOLPHP` and generate a chart-based market report if data is available[cite: 1, 3].

## 🧠 5-Tier Strategy Logic

The bot analyzes the market and assigns one of five action zones[cite: 2]:

1. **🟢🟢 STRONG BUY**: RSI < 30 in a confirmed uptrend (Price >= EMA 50). Prime reversal opportunity.[cite: 2]
2. **🔴🔴 STRONG SELL**: RSI > 70 in a confirmed downtrend (Price < EMA 50). Prime exit opportunity.[cite: 2]
3. **🟢 BUY ZONE**: Early entry zone (30 <= RSI < 45) with price above EMA 50 and upward momentum forming.[cite: 2]
4. **🔴 SELL ZONE**: Weakness showing (55 < RSI <= 70) with price below EMA 50.[cite: 2]
5. **⚪ HOLD**: No strong direction, wait for confirmation.[cite: 2]

## 📊 Alert / Report Contents

Each alert or on-demand report includes[cite: 1, 3]:

- Signal banner / status icon[cite: 1]
- Coin label[cite: 1]
- Recommendation summary[cite: 1]
- **Trend (📈 UPTREND, 📉 DOWNTREND, ⚪ SIDEWAYS)**[cite: 1, 2]
- RSI (14)[cite: 1]
- EMA (50)[cite: 1]
- EMA (200)[cite: 1]
- Current PHP price[cite: 1]
- Current USDT price[cite: 1]
- 24h percentage change[cite: 1]
- Chart image (when generation succeeds)[cite: 1]

If chart generation fails, the bot gracefully falls back to sending a text-only formatted message[cite: 1, 3].

## ⏰ Scheduler

CoinsBot runs an automated check every hour using:
```cron
0 * * * *
```

This means the bot processes all configured symbols at the start of every hour[cite: 3].

## 🌐 Health Check Endpoint

The Express server exposes a simple endpoint:
```http
GET /
```

Response:

```text
CoinsBot is running.
```

This is useful for[cite: 3]:

- Render / Railway / VPS health checks[cite: 3]
- External uptime monitors[cite: 3]
- Keeping the service awake with periodic pings[cite: 3]

## ☁️ Deployment Notes

You can deploy CoinsBot to services like **Render**, **Railway**, or any Node.js-compatible VPS[cite: 3].

### Suggested Deployment Flow

1. Push the repository to GitHub[cite: 3]
2. Create a new web service[cite: 3]
3. Add the environment variables from `.env`[cite: 3]
4. Set the start command (if needed) to:
```bash
npm start
```

5. Optionally configure an uptime monitor to ping your app regularly[cite: 3]

## 🛡️ Reliability Features

The bot includes several protections for long-running operation:

- Graceful polling start / stop handling[cite: 3]
- Auto-restart with backoff for recoverable polling errors[cite: 3]
- Recovery for errors like:
  - `409 Conflict`[cite: 1, 3]
  - `ECONNRESET`[cite: 1, 3]
  - `ETIMEDOUT`[cite: 1, 3]
  - `EFATAL`[cite: 1, 3]
- Graceful shutdown on `SIGINT` / `SIGTERM`[cite: 1, 3]
- Basic safe-send wrappers for Telegram messaging, handling image buffers and captions[cite: 1, 3]

## 📌 Notes

- Make sure the symbols in `COINS` are valid for the market you want to monitor[cite: 3].
- `/price [coin]` accepts flexible input, but scheduled monitoring depends on your configured list[cite: 3].
- This project is intended as a market monitoring tool, **not** a trading bot[cite: 3].

## ⚠️ Disclaimer

**This bot is not financial advice.**[cite: 3]

Cryptocurrency markets are highly volatile[cite: 3]. Signals and recommendations generated by this bot are based on historical indicator calculations and should only be used as informational support[cite: 3]. Always do your own research before making financial decisions[cite: 3].

## 👨‍💻 Author

Developed by **ZedTheGreat**[cite: 3].