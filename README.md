# 🤖 CoinsBot (Coins.ph Edition)

CoinsBot is a Telegram bot for monitoring cryptocurrency pairs from the **Coins.ph Pro API** using technical indicators like **RSI (14)**, **EMA (50)**, and **EMA (200)**. It can send hourly market updates, generate on-demand chart-based reports, and provide signal-style summaries directly in Telegram.

## ✨ Features

- **Hourly market monitoring** for all configured coins
- **Signal alerts** for oversold / overbought conditions
- **Trend detection** using **EMA 50** and **EMA 200**
- **Dual price display** in **PHP** and **USDT**
- **Chart image generation** for alerts and `/price` lookups
- **Telegram bot controls** for starting, stopping, and refreshing polling
- **Health-check web server** for uptime monitoring / deployment platforms
- **Resilient polling restart logic** for common Telegram connection issues

## 🧰 Tech Stack

- **Node.js**
- **node-telegram-bot-api**
- **technicalindicators**
- **axios**
- **node-cron**
- **express**
- **dotenv**

## 📁 Project Structure

```text
.
├── index.js         # Telegram bot, scheduler, polling control, commands
├── indicators.js    # Market analysis, RSI/EMA logic, chart generation
├── README.md
└── .env             # Environment variables (create this yourself)
```

## ⚙️ Requirements

Before you begin, make sure you have:

- **Node.js 18+** recommended
- A **Telegram bot token** from [@BotFather](https://t.me/BotFather)
- Your Telegram **chat ID**
- A valid list of tradable symbols supported by **Coins.ph Pro**

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
COINS=BTCPHP,ETHPHP,SOLPHP,XRPPHP
PORT=3000
```

### Variable Notes

- `TELEGRAM_BOT_TOKEN` – Your Telegram bot token
- `TELEGRAM_CHAT_ID` – Default chat ID where scheduled alerts are sent
- `COINS` – Comma-separated list of symbols to monitor
- `PORT` – Port used by the Express health-check server

### Supported Input Formats

The bot normalizes user input for convenience:

- `BTC` → `BTCPHP`
- `BTCUSD` → `BTCUSDT`
- `BTCUSDT` → `BTCUSDT`
- `BTCPHP` → `BTCPHP`

> Scheduled monitoring uses the symbols from `COINS` exactly as configured.

## 📦 Installation

```bash
npm install
```

## ▶️ Running the Bot

```bash
npm start
```

When the bot starts, it will:

1. Load environment variables
2. Start the Express server
3. Initialize Telegram polling
4. Schedule an hourly market check (`0 * * * *`)

## 🤖 Telegram Commands

| Command | Description |
|---|---|
| `/start` | Enable automated hourly monitoring alerts |
| `/end` | Pause automated alerts |
| `/restart` | Restart Telegram polling manually |
| `/now` | Trigger an immediate market analysis for all configured coins |
| `/coins` | Show the list of tracked coins |
| `/price [coin]` | Generate a report + chart for a specific coin |
| `/help` or `/commands` | Show the command list |

### Example

```text
/price SOL
```

This will normalize to `SOLPHP` and generate a chart-based market report if data is available.

## 📊 Alert / Report Contents

Each alert or on-demand report may include:

- Signal banner / status icon
- Coin label
- Recommendation summary
- Trend
- RSI (14)
- EMA (50)
- EMA (200)
- Current PHP price
- Current USDT price
- 24h percentage change
- Chart image (when generation succeeds)

If chart generation fails, the bot falls back to sending a text-only message.

## ⏰ Scheduler

CoinsBot runs an automated check every hour using:

```cron
0 * * * *
```

This means the bot processes all configured symbols at the start of every hour.

## 🌐 Health Check Endpoint

The Express server exposes a simple endpoint:

```http
GET /
```

Response:

```text
CoinsBot is running.
```

This is useful for:

- Render / Railway / VPS health checks
- External uptime monitors
- Keeping the service awake with periodic pings

## ☁️ Deployment Notes

You can deploy CoinsBot to services like **Render**, **Railway**, or any Node.js-compatible VPS.

### Suggested Deployment Flow

1. Push the repository to GitHub
2. Create a new web service
3. Add the environment variables from `.env`
4. Set the start command (if needed) to:

```bash
npm start
```

5. Optionally configure an uptime monitor to ping your app regularly

## 🛡️ Reliability Features

The bot includes several protections for long-running operation:

- Graceful polling start / stop handling
- Auto-restart with backoff for recoverable polling errors
- Recovery for errors like:
  - `409 Conflict`
  - `ECONNRESET`
  - `ETIMEDOUT`
  - `EFATAL`
- Graceful shutdown on `SIGINT` / `SIGTERM`
- Basic safe-send wrappers for Telegram messaging

## 📌 Notes

- Make sure the symbols in `COINS` are valid for the market you want to monitor.
- `/price [coin]` accepts flexible input, but scheduled monitoring depends on your configured list.
- This project is intended as a market monitoring tool, **not** a trading bot.

## ⚠️ Disclaimer

**This bot is not financial advice.**

Cryptocurrency markets are highly volatile. Signals and recommendations generated by this bot are based on historical indicator calculations and should only be used as informational support. Always do your own research before making financial decisions.

## 👨‍💻 Author

Developed by **ZedTheGreat**.