const axios = require('axios');
const { RSI, EMA } = require('technicalindicators');

function normalizeSymbol(rawSymbol) {
    const symbol = String(rawSymbol || '').toUpperCase().trim();
    if (symbol.endsWith('USDT')) return symbol;
    if (symbol.endsWith('USD')) return `${symbol}T`;
    return symbol;
}

/**
 * Generates an Image Chart from QuickChart.io (Chart.js v4 + candlesticks).
 * @param {{ t: number, o: number, h: number, l: number, c: number }[]} ohlcBars - Hourly OHLC (open time ms).
 * @param {number[]} ema50Values - Array of EMA 50 values.
 * @param {number[]} ema200Values - Array of EMA 200 values.
 * @param {number[]} rsiValues - Array of RSI values.
 * @param {string} pair - The full trading pair symbol (e.g., 'BTCUSDT').
 * @returns {Promise<Buffer|null>} A buffer containing the chart image, or null on error.
 */
async function getChartBuffer(ohlcBars, ema50Values, ema200Values, rsiValues, pair) {
    try {
        const align = (values, length) =>
            values.length >= length
                ? values.slice(-length)
                : [...new Array(length - values.length).fill(null), ...values];

        const n = ohlcBars.length;
        const alignedEma50 = align(ema50Values, n);
        const alignedEma200 = align(ema200Values, n);
        const alignedRsi = align(rsiValues, n);

        const visiblePoints = 73; // Show 3 days of hourly data
        const chartBars = ohlcBars.slice(-visiblePoints);
        const chartEma50 = alignedEma50.slice(-visiblePoints);
        const chartEma200 = alignedEma200.slice(-visiblePoints);
        const chartRsi = alignedRsi.slice(-visiblePoints);

        const lineSeries = (ys) =>
            chartBars.map((b, i) => {
                const y = ys[i];
                return {
                    x: b.t,
                    y: y != null && typeof y === 'number' && !Number.isNaN(y) ? y : null,
                };
            });

        // Include wicks + bodies + EMAs for y-axis bounds (avoid QuickChart Infinity errors)
        const validPrices = [];
        chartBars.forEach((b, i) => {
            [b.o, b.h, b.l, b.c].forEach((v) => {
                if (typeof v === 'number' && !Number.isNaN(v)) validPrices.push(v);
            });
            [chartEma50[i], chartEma200[i]].forEach((v) => {
                if (typeof v === 'number' && !Number.isNaN(v)) validPrices.push(v);
            });
        });
        const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
        const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 100;
        const priceRange = maxPrice - minPrice === 0 ? maxPrice * 0.01 || 1 : maxPrice - minPrice;

        const chartConfig = {
            data: {
                datasets: [
                    {
                        type: 'candlestick',
                        label: 'OHLC (1h)',
                        yAxisID: 'yPrice',
                        data: chartBars.map((b) => ({
                            x: b.t,
                            o: b.o,
                            h: b.h,
                            l: b.l,
                            c: b.c,
                        })),
                        borderColor: {
                            up: '#26a69a',
                            down: '#ef5350',
                            unchanged: '#94a3b8',
                        },
                        backgroundColor: {
                            up: 'rgba(38, 166, 154, 0.55)',
                            down: 'rgba(239, 83, 80, 0.55)',
                            unchanged: 'rgba(148, 163, 184, 0.45)',
                        },
                    },
                    {
                        type: 'line',
                        label: 'EMA (50)',
                        yAxisID: 'yPrice',
                        data: lineSeries(chartEma50),
                        borderColor: '#FFB000',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        spanGaps: true,
                    },
                    {
                        type: 'line',
                        label: 'EMA (200)',
                        yAxisID: 'yPrice',
                        data: lineSeries(chartEma200),
                        borderColor: '#1E88E5',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        spanGaps: true,
                    },
                    {
                        type: 'line',
                        label: 'RSI (14)',
                        yAxisID: 'yRsi',
                        data: lineSeries(chartRsi),
                        borderColor: '#B026FF',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        spanGaps: true,
                        tension: 0.4,
                    },
                ],
            },
            options: {
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour',
                            displayFormats: { hour: 'MMM d HH:mm' },
                        },
                        ticks: { color: '#64748B', maxTicksLimit: 12 },
                        grid: { color: 'rgba(255, 255, 255, 0.07)' },
                    },
                    yPrice: {
                        position: 'right',
                        min: minPrice - priceRange * 0.733,
                        max: maxPrice + priceRange * 0.1,
                        ticks: { color: '#64748B' },
                        grid: { color: 'rgba(255, 255, 255, 0.07)' },
                    },
                    yRsi: {
                        position: 'left',
                        min: 0,
                        max: 200,
                        ticks: { color: '#64748B' },
                        grid: { drawOnChartArea: false },
                    },
                },
                plugins: {
                    title: {
                        display: true,
                        text: `Coins.ph ${pair} Chart (Last ${visiblePoints - 1} Hrs)`,
                        color: '#EAECEF',
                        font: { size: 18, family: 'sans-serif' },
                    },
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94A3B8', boxWidth: 15 },
                    },
                    annotation: {
                        annotations: {
                            rsi70: {
                                type: 'line',
                                yMin: 70,
                                yMax: 70,
                                yScaleID: 'yRsi',
                                borderColor: '#ef4444',
                                borderWidth: 1,
                                borderDash: [4, 4],
                            },
                            rsi30: {
                                type: 'line',
                                yMin: 30,
                                yMax: 30,
                                yScaleID: 'yRsi',
                                borderColor: '#10b981',
                                borderWidth: 1,
                                borderDash: [4, 4],
                            },
                        },
                    },
                },
            },
        };

        const response = await axios.post(
            'https://quickchart.io/chart',
            {
                chart: chartConfig,
                version: '4',
                width: 600,
                height: 400,
                backgroundColor: '#131722',
                format: 'png',
            },
            { responseType: 'arraybuffer' },
        );

        return Buffer.from(response.data);
    } catch (error) {
        const errorMessage = error.response?.data?.toString() || error.message;
        console.error("Failed to generate chart image:", errorMessage);
        return null;
    }
}

async function getMarketAnalysis(symbol) {
    try {
        const normalizedSymbol = normalizeSymbol(symbol);
        const baseAsset = normalizedSymbol.replace(/(USDT|USD|PHP)$/, '');
        const usdtSymbol = `${baseAsset}USDT`;

        // 1. Fetch Klines - Increased limit for EMA 200
        const klineUrl = `https://api.pro.coins.ph/openapi/v1/klines?symbol=${normalizedSymbol}&interval=1h&limit=300`;
        const klineResp = await axios.get(klineUrl);
        
        // 2. Fetch Tickers
        const tickerUrl = `https://api.pro.coins.ph/openapi/v1/ticker/24hr?symbol=${normalizedSymbol}`;
        const tickerResp = await axios.get(tickerUrl);
        const usdtTickerUrl = `https://api.pro.coins.ph/openapi/v1/ticker/24hr?symbol=${usdtSymbol}`;
        const usdtTickerResp = await axios.get(usdtTickerUrl);

        const ohlcBars = klineResp.data.map((d) => ({
            t: Number(d[0]),
            o: parseFloat(d[1]),
            h: parseFloat(d[2]),
            l: parseFloat(d[3]),
            c: parseFloat(d[4]),
        }));
        const closes = ohlcBars.map((b) => b.c);
        const currentPricePHP = parseFloat(tickerResp.data.lastPrice);
        const change24h = tickerResp.data.priceChangePercent;

        // 3. Technical Indicators
        const rsiValues = RSI.calculate({ values: closes, period: 14 });
        const ema50Values = EMA.calculate({ values: closes, period: 50 });
        const ema200Values = EMA.calculate({ values: closes, period: 200 });

        const currentRSI = rsiValues[rsiValues.length - 1];
        const currentEMA50 = ema50Values[ema50Values.length - 1];
        const currentEMA200 = ema200Values[ema200Values.length - 1];
        const prevEMA50 = ema50Values[ema50Values.length - 2];

        // 4. USDT Price
        const currentPriceUSDT = parseFloat(usdtTickerResp.data.lastPrice).toFixed(2);

        // 5. NEW 5-TIER STRATEGY LOGIC
        let sign = "⚪ [HOLD] ⚪";
        let recommendation = "No strong direction, wait for confirmation.";
        let alert = false;
        
        const isBullTrend = currentEMA50 > currentEMA200;
        const isBearTrend = currentEMA50 < currentEMA200;
        const isEma50Rising = currentEMA50 >= prevEMA50;

        if (currentRSI < 30 && currentPricePHP >= currentEMA50 && isBullTrend) {
            sign = "🟢🟢 [STRONG BUY] 🟢🟢";
            recommendation = "Oversold in a confirmed uptrend. Prime reversal opportunity.";
            alert = true;
        } else if (currentRSI > 70 && currentPricePHP < currentEMA50 && isBearTrend) {
            sign = "🔴🔴 [STRONG SELL] 🔴🔴";
            recommendation = "Overbought in a confirmed downtrend. Prime exit opportunity.";
            alert = true;
        } else if (currentRSI >= 30 && currentRSI < 45 && currentPricePHP > (currentEMA50 * 0.99) && (isEma50Rising || isBullTrend)) {
            sign = "🟢 [BUY ZONE] 🟢";
            recommendation = "Early entry zone as upward momentum may be forming.";
            alert = true;
        } else if (currentRSI > 55 && currentRSI <= 70 && currentPricePHP < (currentEMA50 * 1.01) && !isEma50Rising) {
            sign = "🔴 [SELL ZONE] 🔴";
            recommendation = "Weakness showing; a possible down move may be forming.";
            alert = true;
        }
        
        // Calculate the trend label
        let trend = "⚪ SIDEWAYS";
        if (isBullTrend) trend = "📈 UPTREND";
        else if (isBearTrend) trend = "📉 DOWNTREND";

        // 6. Request chart image creation
        const chartBuffer = await getChartBuffer(ohlcBars, ema50Values, ema200Values, rsiValues, normalizedSymbol);

        const formatNumber = (num) => Number(num).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

        return {
            symbol: baseAsset,
            pair: normalizedSymbol,
            sign,
            recommendation,
            chartBuffer,
            rsi: currentRSI.toFixed(2),
            ema50: formatNumber(currentEMA50),
            ema200: formatNumber(currentEMA200),
            pricePHP: Number(currentPricePHP).toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            priceUSDT: Number(currentPriceUSDT).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            change: change24h,
            alert,
            trend,
        };
    } catch (error) {
        console.error(`Indicator Error (${symbol}):`, error.message);
        return null;
    }
}

module.exports = { getMarketAnalysis };