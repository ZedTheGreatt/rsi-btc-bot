const axios = require('axios');
const { RSI, EMA } = require('technicalindicators');

function normalizeSymbol(rawSymbol) {
    const symbol = String(rawSymbol || '').toUpperCase().trim();
    if (symbol.endsWith('USDT')) return symbol;
    if (symbol.endsWith('USD')) return `${symbol}T`;
    return symbol;
}

async function getMarketAnalysis(symbol) {
    try {
        const normalizedSymbol = normalizeSymbol(symbol);
        const baseAsset = normalizedSymbol.replace(/(USDT|USD|PHP)$/, '');
        const usdtSymbol = `${baseAsset}USDT`;

        // 1. Fetch Klines (OHLCV) - 1 hour interval
        const klineUrl = `https://api.pro.coins.ph/openapi/v1/klines?symbol=${normalizedSymbol}&interval=1h&limit=100`;
        const klineResp = await axios.get(klineUrl);
        
        // 2. Fetch 24h Ticker for Change %
        const tickerUrl = `https://api.pro.coins.ph/openapi/v1/ticker/24hr?symbol=${normalizedSymbol}`;
        const tickerResp = await axios.get(tickerUrl);
        const usdtTickerUrl = `https://api.pro.coins.ph/openapi/v1/ticker/24hr?symbol=${usdtSymbol}`;
        const usdtTickerResp = await axios.get(usdtTickerUrl);

        const closes = klineResp.data.map(d => parseFloat(d[4]));
        const currentPricePHP = parseFloat(tickerResp.data.lastPrice);
        const change24h = tickerResp.data.priceChangePercent;

        // 3. Technical Indicators
        const rsiValues = RSI.calculate({ values: closes, period: 14 });
        const emaValues = EMA.calculate({ values: closes, period: 50 });

        const currentRSI = rsiValues[rsiValues.length - 1];
        const currentEMA = emaValues[emaValues.length - 1];

        // 4. USDT Price (Live Market Pair)
        const currentPriceUSDT = parseFloat(usdtTickerResp.data.lastPrice).toFixed(2);

        // 5. 📊 TREND RULES
        // Check if price is within 0.5% of the EMA (Sideways)
        const diffPercent = Math.abs((currentPricePHP - currentEMA) / currentEMA) * 100;
        
        let trendLabel = "";
        let trendIcon = "";

        if (diffPercent < 0.5) {
            trendLabel = "SIDEWAYS";
            trendIcon = "⚪";
        } else if (currentPricePHP > currentEMA) {
            trendLabel = "UPTREND";
            trendIcon = "📈";
        } else {
            trendLabel = "DOWNTREND";
            trendIcon = "📉";
        }

        // 6. ZONE STRATEGY LOGIC
        let sign = "⚪ [NEUTRAL / HOLD] ⚪";
        let recommendation = "No clear edge, wait";
        let alert = false;

        // 🟢 BUY ZONE: RSI < 35 AND Price > EMA (UPTREND only)
        if (currentRSI < 35 && trendLabel === "UPTREND") { 
            sign = "🟢 [BUY ZONE] 🟢"; 
            recommendation = "Buy dips in uptrend";
            alert = true;
        }
        // 🔴 SELL ZONE: RSI > 65 AND Price < EMA (DOWNTREND only)
        else if (currentRSI > 65 && trendLabel === "DOWNTREND") { 
            sign = "🔴 [SELL ZONE] 🔴"; 
            recommendation = "Sell bounces in downtrend";
            alert = true;
        }

        return {
            symbol: baseAsset,
            pair: normalizedSymbol,
            sign,
            recommendation,
            rsi: currentRSI.toFixed(2),
            ema: Number(currentEMA).toLocaleString('en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }),
            pricePHP: Number(currentPricePHP).toLocaleString('en-PH', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }),
            priceUSDT: Number(currentPriceUSDT).toLocaleString('en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }),
            change: change24h,
            alert,
            trend: `${trendIcon} ${trendLabel}`
        };
    } catch (error) {
        console.error(`Indicator Error (${symbol}):`, error.message);
        return null;
    }
}

module.exports = { getMarketAnalysis };