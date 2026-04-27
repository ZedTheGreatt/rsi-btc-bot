const axios = require('axios');
const { RSI, EMA } = require('technicalindicators');

function normalizeSymbol(rawSymbol) {
    const symbol = String(rawSymbol || '').toUpperCase().trim();
    if (symbol.endsWith('USDT')) return symbol;
    if (symbol.endsWith('USD')) return `${symbol}T`;
    return symbol;
}

// Generates an Image Chart from QuickChart.io using our market arrays
async function getChartBuffer(closes, emaValues, symbol) {
    try {
        // Ensure the EMA array maps to the exact same points in the Closes timeline
        const paddingCount = closes.length - emaValues.length;
        const alignedEma = [...(new Array(Math.max(0, paddingCount)).fill(null)), ...emaValues];

        // Changed from 60 to 24 for the Last 24hrs View
        const visiblePoints = 72;
        const chartCloses = closes.slice(-visiblePoints);
        const chartEma = alignedEma.slice(-visiblePoints);
        
        // Form generic bottom labels (-24h, -23h... -1h, NOW)
        const labels = Array.from({ length: chartCloses.length }, (_, i) => 
            i === chartCloses.length - 1 ? 'NOW' : `-${chartCloses.length - 1 - i}h`
        );

        // ============================================
        // AESTHETICS: Dark Mode / TradingView Style
        // ============================================
        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `${symbol} Price`,
                        data: chartCloses,
                        borderColor: '#00D8FF', // Neon Cyan
                        backgroundColor: 'rgba(0, 216, 255, 0.15)', // Light Cyan Tint
                        borderWidth: 2.5,
                        fill: true,
                        pointRadius: 0
                    },
                    {
                        label: 'EMA (50)',
                        data: chartEma,
                        borderColor: '#FFB100', // Gold / Orange
                        borderWidth: 2,
                        borderDash: [6, 6],
                        fill: false,
                        pointRadius: 0,
                        spanGaps: true
                    }
                ]
            },
            options: {
                title: { 
                    display: true, 
                    text: `${symbol}/PHP Chart (Last ${visiblePoints} Hrs)`, 
                    fontSize: 18,
                    fontColor: '#E2E8F0', // Light Slate Text
                    fontFamily: 'sans-serif'
                },
                legend: { 
                    position: 'bottom',
                    labels: {
                        fontColor: '#94A3B8', // Muted Gray Text
                        boxWidth: 20
                    }
                },
                scales: {
                    xAxes: [{ 
                        ticks: { maxTicksLimit: 6, fontColor: '#64748B' },
                        gridLines: { color: 'rgba(255, 255, 255, 0.05)', zeroLineColor: 'rgba(255, 255, 255, 0.1)' }
                    }],
                    yAxes: [{ 
                        ticks: { fontColor: '#64748B' },
                        gridLines: { color: 'rgba(255, 255, 255, 0.05)', zeroLineColor: 'rgba(255, 255, 255, 0.1)' }
                    }]
                }
            }
        };

        const response = await axios.post('https://quickchart.io/chart', {
            chart: chartConfig,
            width: 800,
            height: 400,
            // Dark aesthetic background matching professional crypto terminals
            backgroundColor: '#131722', 
            format: 'png'
        }, {
            responseType: 'arraybuffer' // Request raw binary stream (required to send photos inside TG natively)
        });

        return Buffer.from(response.data);
    } catch (error) {
        console.error("Failed to generate chart image:", error.message);
        return null;
    }
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

        // 7. Request chart image creation
        const chartBuffer = await getChartBuffer(closes, emaValues, baseAsset);

        return {
            symbol: baseAsset,
            pair: normalizedSymbol,
            sign,
            recommendation,
            chartBuffer,
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