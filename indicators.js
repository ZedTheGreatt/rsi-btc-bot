const axios = require('axios');
const { RSI, EMA } = require('technicalindicators');

async function getMarketAnalysis(symbol) {
    try {
        // 1. Fetch Klines (OHLCV) - 1 hour interval
        const klineUrl = `https://api.pro.coins.ph/openapi/v1/klines?symbol=${symbol}&interval=1h&limit=100`;
        const klineResp = await axios.get(klineUrl);
        
        // 2. Fetch 24h Ticker for Change %
        const tickerUrl = `https://api.pro.coins.ph/openapi/v1/ticker/24hr?symbol=${symbol}`;
        const tickerResp = await axios.get(tickerUrl);

        const closes = klineResp.data.map(d => parseFloat(d[4]));
        const currentPricePHP = parseFloat(tickerResp.data.lastPrice);
        const change24h = tickerResp.data.priceChangePercent;

        // 3. Technical Indicators
        const rsiValues = RSI.calculate({ values: closes, period: 14 });
        const emaValues = EMA.calculate({ values: closes, period: 50 });

        const currentRSI = rsiValues[rsiValues.length - 1];
        const currentEMA = emaValues[emaValues.length - 1];

        // 4. USD Conversion (Estimated)
        const phpToUsdRate = 0.018; 
        const currentPriceUSD = (currentPricePHP * phpToUsdRate).toFixed(2);

        // Determine Sign
        let sign = "🟡[NEUTRAL]🟡";
        let alert = false;
        if (currentRSI <= 30) { 
            sign = "🟢[BUY ZONE]🟢"; 
            alert = true;
        }
        else if (currentRSI >= 70) { 
            sign = "🔴[SELL ZONE]🔴"; 
            alert = true;
        }

        return {
            symbol: symbol.replace('PHP', ''),
            sign,
            rsi: currentRSI.toFixed(2),
            ema: currentEMA.toFixed(2),
            pricePHP: currentPricePHP.toLocaleString(),
            priceUSD: currentPriceUSD,
            change: change24h,
            alert,
            trend: currentPricePHP > currentEMA ? "📈Bullish" : "📉Bearish"
        };
    } catch (error) {
        console.error(`Indicator Error (${symbol}):`, error.message);
        return null;
    }
}

module.exports = { getMarketAnalysis };