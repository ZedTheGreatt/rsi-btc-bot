const fs = require("fs");
const path = require("path");

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class Logger {
  constructor(config = {}) {
    this.level = LOG_LEVELS[config.level || "info"] || LOG_LEVELS.info;
    this.logDir = config.logDir || "./logs";
    this.maxLogSize = config.maxLogSize || 10485760; // 10MB

    // Create log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    this.logFile = path.join(this.logDir, "bot.log");
    this.errorFile = path.join(this.logDir, "errors.log");
    this.tradesFile = path.join(this.logDir, "trades.json");
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let msg = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (data) {
      msg += ` | ${JSON.stringify(data)}`;
    }
    return msg;
  }

  write(file, message) {
    try {
      // Check file size and rotate if needed
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        if (stats.size > this.maxLogSize) {
          const timestamp = Date.now();
          const backupFile = `${file}.${timestamp}`;
          fs.renameSync(file, backupFile);
          console.log(`Log rotated: ${file} -> ${backupFile}`);
        }
      }

      fs.appendFileSync(file, message + "\n");
    } catch (err) {
      console.error("Logger write error:", err.message);
    }
  }

  error(message, data) {
    if (this.level >= LOG_LEVELS.error) {
      const formatted = this.formatMessage("error", message, data);
      console.error(formatted);
      this.write(this.errorFile, formatted);
    }
  }

  warn(message, data) {
    if (this.level >= LOG_LEVELS.warn) {
      const formatted = this.formatMessage("warn", message, data);
      console.warn(formatted);
      this.write(this.logFile, formatted);
    }
  }

  info(message, data) {
    if (this.level >= LOG_LEVELS.info) {
      const formatted = this.formatMessage("info", message, data);
      console.log(formatted);
      this.write(this.logFile, formatted);
    }
  }

  debug(message, data) {
    if (this.level >= LOG_LEVELS.debug) {
      const formatted = this.formatMessage("debug", message, data);
      console.log(formatted);
      this.write(this.logFile, formatted);
    }
  }

  logTrade(trade) {
    try {
      let trades = [];
      if (fs.existsSync(this.tradesFile)) {
        const data = fs.readFileSync(this.tradesFile, "utf8");
        trades = JSON.parse(data);
      }

      trades.push({
        ...trade,
        timestamp: new Date().toISOString()
      });

      // Keep only last 1000 trades
      if (trades.length > 1000) {
        trades = trades.slice(-1000);
      }

      fs.writeFileSync(this.tradesFile, JSON.stringify(trades, null, 2));
    } catch (err) {
      this.error("Trade log error", { error: err.message });
    }
  }

  getTrades(limit = 50) {
    try {
      if (fs.existsSync(this.tradesFile)) {
        const data = fs.readFileSync(this.tradesFile, "utf8");
        const trades = JSON.parse(data);
        return trades.slice(-limit).reverse();
      }
    } catch (err) {
      this.error("Get trades error", { error: err.message });
    }
    return [];
  }

  getRecentErrors(limit = 20) {
    try {
      if (fs.existsSync(this.errorFile)) {
        const content = fs.readFileSync(this.errorFile, "utf8");
        return content
          .split("\n")
          .filter(line => line.trim())
          .slice(-limit)
          .reverse();
      }
    } catch (err) {
      console.error("Get errors error:", err.message);
    }
    return [];
  }
}

module.exports = Logger;
