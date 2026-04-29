require("dotenv").config();

const express = require("express");
const cron = require("node-cron");

const { scanMarket } = require("./services/signalEngine");
const bot = require("./bot");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("CoinsBot running with GainzAlgo v2 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Run every hour
cron.schedule("0 * * * *", async () => {
  console.log("⏳ Scanning market...");
  await scanMarket();
});