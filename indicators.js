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
            symbol: normalizedSymbol.replace(/(USDT|USD|PHP)$/, ''),
            pair: normalizedSymbol,
            sign,
            rsi: currentRSI.toFixed(2),
            ema: currentEMA.toFixed(2),
            pricePHP: currentPricePHP.toLocaleString(),
            priceUSDT: currentPriceUSDT,
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
