const axios = require('axios');
const { RSI, EMA } = require('technicalindicators');

function normalizeSymbol(rawSymbol) {
    const symbol = String(rawSymbol || '').toUpperCase().trim();
    if (symbol.endsWith('USDT')) return symbol;
    if (symbol.endsWith('USD')) return `${symbol}T`;
    return symbol;
}

/**
 * Generates an Image Chart from QuickChart.io using our market arrays
 * @param {number[]} closes - Array of closing prices.
 * @param {number[]} ema50Values - Array of EMA 50 values.
 * @param {number[]} ema200Values - Array of EMA 200 values.
 * @param {number[]} rsiValues - Array of RSI values.
 * @param {string} pair - The full trading pair symbol (e.g., 'BTCUSDT').
 * @returns {Promise<Buffer|null>} A buffer containing the chart image, or null on error.
 */
async function getChartBuffer(closes, ema50Values, ema200Values, rsiValues, pair) {
    try {
        // --- Align all indicator arrays to match the closing prices timeline ---
        const align = (values, length) =>
            values.length >= length
                ? values.slice(-length)
                : [...new Array(length - values.length).fill(null), ...values];

        const alignedEma50 = align(ema50Values, closes.length);
        const alignedEma200 = align(ema200Values, closes.length);
        const alignedRsi = align(rsiValues, closes.length);

        const visiblePoints = 72; // Show 3 days of hourly data
        const chartCloses = closes.slice(-visiblePoints);
        const chartEma50 = alignedEma50.slice(-visiblePoints);
        const chartEma200 = alignedEma200.slice(-visiblePoints);
        const chartRsi = alignedRsi.slice(-visiblePoints);
        
        // --- MODIFIED: Generate real date/time labels for the PH timezone ---
        const now = new Date();
        const labels = Array.from({ length: chartCloses.length }, (_, i) => {
            // The timestamp for the current data point in the loop
            const pointDate = new Date(now.getTime() - (chartCloses.length - 1 - i) * 3600 * 1000);
            // The timestamp for the previous data point, to check for day change
            const prevPointDate = new Date(pointDate.getTime() - 3600 * 1000);

            // Intl.DateTimeFormat is the modern way to handle timezones and locales
            const timeFormatter = new Intl.DateTimeFormat('en-SG', { // en-SG provides a clean 24h format like 09:00
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Asia/Manila'
            });
            const dateFormatter = new Intl.DateTimeFormat('en-US', {
                month: 'numeric',
                day: 'numeric',
                timeZone: 'Asia/Manila'
            });

            // For the very last point, display 'NOW' for clarity
            if (i === chartCloses.length - 1) {
                return 'NOW';
            }
            
            const currentDay = dateFormatter.format(pointDate);
            const prevDay = dateFormatter.format(prevPointDate);

            // If it's the first label in the chart, or if the day has changed
            // since the previous label, display the date as well.
            // Using a multi-line label array `[time, date]` for better readability.
            if (i === 0 || currentDay !== prevDay) {
                return [timeFormatter.format(pointDate), currentDay];
            }

            // Otherwise, just show the time
            return timeFormatter.format(pointDate);
        });
        // --- END OF MODIFICATION ---

        // Safely extract min/max to prevent QuickChart "Infinity" 400 errors
        const validPrices = [...chartCloses, ...chartEma50, ...chartEma200].filter(v => typeof v === 'number' && !isNaN(v));
        const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
        const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 100;
        const priceRange = (maxPrice - minPrice) === 0 ? (maxPrice * 0.01 || 1) : (maxPrice - minPrice);

        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Price',
                        yAxisID: 'yPrice',
                        data: chartCloses,
                        borderColor: 'rgba(41, 98, 255, 1)',
                        backgroundColor: 'rgba(41, 98, 255, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        pointRadius: 0
                    },
                    {
                        label: 'EMA (50)',
                        yAxisID: 'yPrice',
                        data: chartEma50,
                        borderColor: '#FBBF24',
                        borderWidth: 1.5,
                        fill: false,
                        pointRadius: 0,
                        spanGaps: true,
                    },
                    {
                        label: 'EMA (200)',
                        yAxisID: 'yPrice',
                        data: chartEma200,
                        borderColor: '#ef4444', // Light purple for EMA 200
                        borderWidth: 1.5,
                        fill: false,
                        pointRadius: 0,
                        spanGaps: true,
                    },
                    {
                        label: 'RSI (14)',
                        yAxisID: 'yRsi',
                        data: chartRsi,
                        borderColor: '#10b981', // Rose color for RSI
                        borderWidth: 1.5,
                        fill: false,
                        pointRadius: 0,
                        tension: 0.4
                    }
                ]
            },
            options: {
                title: { 
                    display: true, 
                    text: `Coins.ph ${pair} Chart (Last ${visiblePoints} Hrs)`, 
                    fontSize: 18,
                    fontColor: '#EAECEF',
                    fontFamily: 'sans-serif'
                },
                legend: { 
                    position: 'bottom',
                    labels: { fontColor: '#94A3B8', boxWidth: 15 }
                },
                scales: {
                    xAxes: [{ 
                        ticks: { maxTicksLimit: 6, fontColor: '#64748B' },
                        gridLines: { color: 'rgba(255, 255, 255, 0.07)', zeroLineColor: 'rgba(255, 255, 255, 0.1)' }
                    }],
                    yAxes: [
                        { 
                            id: 'yPrice',
                            position: 'right',
                            ticks: { 
                                fontColor: '#64748B',
                                min: minPrice - (priceRange * 0.733),
                                max: maxPrice + (priceRange * 0.1)
                            },
                            gridLines: { color: 'rgba(255, 255, 255, 0.07)', zeroLineColor: 'rgba(255, 255, 255, 0.1)' }
                        },
                        {
                            id: 'yRsi',
                            position: 'left',
                            ticks: {
                                min: 0,
                                max: 250,
                                callback: (value) => (value <= 100 ? value : null),
                                fontColor: '#64748B'
                            },
                            gridLines: { drawOnChartArea: false }
                        }
                    ]
                },
                annotation: {
                    annotations: [
                        { type: 'line', mode: 'horizontal', scaleID: 'yRsi', value: 70, borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 4] },
                        { type: 'line', mode: 'horizontal', scaleID: 'yRsi', value: 30, borderColor: '#10b981', borderWidth: 1, borderDash: [4, 4] }
                    ]
                }
            }
        };

        const response = await axios.post('https://quickchart.io/chart', {
            chart: chartConfig, width: 600, height: 400, backgroundColor: '#131722', format: 'png'
        }, { responseType: 'arraybuffer' });

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

        const closes = klineResp.data.map(d => parseFloat(d[4]));
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
        
        // <<< ADD THIS BLOCK TO CALCULATE THE TREND LABEL
        let trend = "⚪ SIDEWAYS";
        if (isBullTrend) trend = "📈 UPTREND";
        else if (isBearTrend) trend = "📉 DOWNTREND";
        // <<< END OF ADDED BLOCK

        // 6. Request chart image creation
        const chartBuffer = await getChartBuffer(closes, ema50Values, ema200Values, rsiValues, normalizedSymbol);

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
            trend, // <<< ADD THIS PROPERTY TO THE RETURNED OBJECT
        };
    } catch (error) {
        console.error(`Indicator Error (${symbol}):`, error.message);
        return null;
    }
}

module.exports = { getMarketAnalysis };