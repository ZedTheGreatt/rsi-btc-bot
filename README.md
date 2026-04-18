# 📈 RSI Alert Telegram Bot (Coins.ph)

A specialized Node.js Telegram bot that monitors cryptocurrency markets via the **Coins.ph Pro API**. It provides real-time RSI (Relative Strength Index) alerts, trend analysis via EMA, and hourly market updates.

## 🚀 Features
- **RSI Threshold Alerts:** Notifies when a coin enters the **Buy Zone (RSI ≤ 30)** or **Sell Zone (RSI ≥ 70)**.
- **Trend Confirmation:** Uses **EMA 50** to identify Bullish or Bearish market trends.
- **Automated Hourly Updates:** Sends a market snapshot every hour after startup.
- **Dual Currency Pricing:** Displays prices in both **PHP** and **USD**.
- **Render.com Ready:** Includes a built-in health-check server to run 24/7 on Render.

---

## 🛠 Tech Stack
- **Runtime:** Node.js
- **Bot API:** `node-telegram-bot-api`
- **Technical Analysis:** `technicalindicators`
- **Scheduler:** `node-cron`
- **Hosting:** Optimized for [Render.com](https://render.com)

---

## 📁 Project Structure
```text
rsi-bot/
├── .env                # Environment variables (Sensitive)
├── .gitignore          # Files to exclude from Git
├── index.js            # Bot logic and Telegram commands
├── indicators.js       # Coins.ph API logic and TA calculations
└── package.json        # Dependencies and scripts
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Install [Node.js](https://nodejs.org/)
- Get a **Bot Token** from [@BotFather](https://t.me/BotFather)
- Get your **Telegram Chat ID** from [@IDBot](https://t.me/myidbot)

### 2. Local Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/rsi-btc-bot.git
cd rsi-btc-bot

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
COINS=BTCPHP,ETHPHP,XRPPHP,SOLPHP
PORT=3000
```

### 4. Run the Bot
```bash
npm start
```

---

## 🤖 Telegram Commands

| Command | Description |
| :--- | :--- |
| `/start` | Start the hourly RSI monitoring |
| `/end` | Stop/Pause automated alerts |
| `/restart` | Restart and refresh market data |
| `/now` | Get real-time RSI and price for all tracked coins |
| `/price [coin]` | Get specific coin data (e.g., `/price BTC`) |
| `/coins` | List all coins currently being monitored |
| `/help` | Show available commands list |

---

## ☁️ Deployment (Render.com)

1. **Push to GitHub:** Ensure your `.env` is in `.gitignore`.
2. **Create Web Service:** Connect your repo to Render.
3. **Set Environment Variables:** Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `COINS` in the Render "Environment" tab.
4. **Keep-Alive:** Use [Cron-job.org](https://cron-job.org) to ping your Render URL every 10 minutes to prevent the bot from sleeping.

---

## 📊 Message Format
```text
🟢 [BUY ZONE]
BTC/PHP
RSI: 28.50 (Bullish Trend)
Price: USD 64,250.00
Price: PHP 3,600,000.00
24h Change: +2.5%
```

---

## ⚠️ Disclaimer
This bot is for **informational purposes only**. Cryptocurrency trading involves significant risk. The signals provided by this bot are based on technical indicators and do not guarantee profit. Always do your own research (DYOR).

---
*Created by ZedTheGreat 2026*