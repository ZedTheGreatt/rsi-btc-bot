This is a renewed and modernized `README.md` for **CoinsBot**, reflecting the new branding, updated setup instructions, and deployment tips.

---

# START OF FILE README.md

# 🤖 CoinsBot (Coins.ph Edition)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![API](https://img.shields.io/badge/API-Coins.ph%20Pro-blue)](https://pro.coins.ph/)

**CoinsBot** is a professional-grade Telegram assistant designed to monitor cryptocurrency markets via the **Coins.ph Pro API**. It tracks Relative Strength Index (RSI) and Exponential Moving Averages (EMA) to provide real-time trade signals and hourly market snapshots.

---

## 🚀 Key Features

*   **RSI Alert System:** Automatic notifications when a coin enters the **Oversold (≤30)** or **Overbought (≥70)** zones.
*   **Trend Analysis:** Uses **EMA 50** to visually indicate whether the current trend is Bullish (📈) or Bearish (📉).
*   **Dual-Currency Tracking:** Live pricing in both **Philippine Peso (PHP)** and **US Tether (USDT)**.
*   **On-Demand Pricing:** Check any coin instantly with the `/price` command.
*   **Automation:** Built-in `node-cron` scheduler for hourly updates and `express` for 24/7 uptime monitoring.
*   **Resilient Polling:** Advanced error handling with automatic reconnection logic for stable Telegram connectivity.

---

## 🛠 Tech Stack

*   **Runtime:** Node.js
*   **Telegram API:** `node-telegram-bot-api`
*   **Indicators:** `technicalindicators` (RSI, EMA)
*   **Scheduling:** `node-cron`
*   **Networking:** `axios`
*   **Server:** `express` (Health Checks)

---

## ⚙️ Setup & Installation

### 1. Prerequisites
*   A Telegram account.
*   A Bot Token from [@BotFather](https://t.me/BotFather).
*   Your Chat ID from [@IDBot](https://t.me/myidbot).

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
COINS=BTCPHP,ETHPHP,SOLPHP,XRPPHP
PORT=3000
```
*Note: Use the format `SYMBOLPHP` to track Coins.ph pairs.*

### 3. Local Deployment
```bash
# Install dependencies
npm install

# Start the bot
npm start
```

---

## 🤖 Telegram Commands

| Command | Description |
| :--- | :--- |
| `/start` | Activate hourly monitoring and alerts. |
| `/now` | Force an immediate analysis of all tracked coins. |
| `/price [coin]` | Quick check for a specific coin (e.g., `/price SOL`). |
| `/coins` | View the list of currently monitored assets. |
| `/help` | Display the list of available commands. |
| `/end` | Pause the bot's automated alert system. |
| `/restart` | Manually refresh the Telegram polling connection. |

---

## 📊 Sample Alert Format
```text
🟢 [BUY ZONE] 🟢
*—— ₿ BTC ₿ ——*
📊 INDICATORS
- RSI (14): 28.40 📉
- EMA (50): ₱3,540,210.5
💵 PRICE
- BTC/PHP: ₱3,490,000.0
- BTC/USDT: $62,150.00
🔁 24h Change: -4.15%
```

---

## ☁️ Deployment (Render.com)

1.  Push this repository to **GitHub**.
2.  Create a new **Web Service** on [Render](https://render.com).
3.  Add your `.env` variables in the **Environment** tab.
4.  **Auto-Sleep Fix:** Use a service like [Cron-job.org](https://cron-job.org) to ping your Render URL (e.g., `https://coinsbot.onrender.com/`) every 10 minutes to keep the bot from sleeping.

---

## ⚠️ Disclaimer
**This bot is not financial advice.** Cryptocurrency trading carries high risk. CoinsBot is a technical analysis tool; signals are based on historical data and do not guarantee future results. Always perform your own research (DYOR).

---
*Developed by ZedTheGreat — 2025*