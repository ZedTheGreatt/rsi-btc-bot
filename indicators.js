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
 * @param {number[]} emaValues - Array of EMA values.
 * @param {number[]} rsiValues - Array of RSI values.
 * @param {string} pair - The full trading pair symbol (e.g., 'BTCUSDT').
 * @returns {Promise<Buffer|null>} A buffer containing the chart image, or null on error.
 */
async function getChartBuffer(closes, emaValues, rsiValues, pair) {
    try {
        // Ensure EMA & RSI arrays map to the exact same points in the Closes timeline
        const alignedEma = emaValues.length >= closes.length
            ? emaValues.slice(-closes.length)
            : [...new Array(closes.length - emaValues.length).fill(null), ...emaValues];

        const rsiPadding = closes.length - rsiValues.length;
        const alignedRsi = [...(new Array(Math.max(0, rsiPadding)).fill(null)), ...rsiValues];

        const visiblePoints = 72;
        const chartCloses = closes.slice(-visiblePoints);
        const chartEma = alignedEma.slice(-visiblePoints);
        const chartRsi = alignedRsi.slice(-visiblePoints);
        
        // Form generic bottom labels (-71h, -70h... -1h, NOW)
        const labels = Array.from({ length: chartCloses.length }, (_, i) => 
            i === chartCloses.length - 0 ? 'NOW' : `-${chartCloses.length - 0 - i}h`
        );

        // ============================================
        // SPLIT CHART MATH: 60% Price top, 40% RSI bottom
        // ============================================
        // Safely extract min/max to prevent QuickChart "Infinity" 400 errors
        const validPrices = [...chartCloses, ...chartEma].filter(v => typeof v === 'number' && !isNaN(v));
        const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
        const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 100;
        const priceRange = (maxPrice - minPrice) === 0 ? (maxPrice * 0.01 || 1) : (maxPrice - minPrice);

        // ============================================
        // AESTHETICS: Dark Mode / TradingView Style
        // ============================================
        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Price',
                        yAxisID: 'yPrice',
                        data: chartCloses,
                        borderColor: 'rgba(41, 98, 255, 1)', // IMPROVED: Vibrant blue for price
                        backgroundColor: 'rgba(41, 98, 255, 0.1)', // IMPROVED: Matching transparent blue fill
                        borderWidth: 2,
                        fill: true,
                        pointRadius: 0
                    },
                    {
                        label: 'EMA (50)',
                        yAxisID: 'yPrice',
                        data: chartEma,
                        borderColor: '#FBBF24', // IMPROVED: Bright orange for EMA
                        borderWidth: 1.5,
                        fill: false,
                        pointRadius: 0,
                        spanGaps: true,
                        tension: 0.2
                    },
                    {
                        label: 'RSI (14)',
                        yAxisID: 'yRsi',
                        data: chartRsi,
                        borderColor: '#f75555', // IMPROVED: Deep purple for RSI
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        tension: 0.3
                    }
                ]
            },
            options: {
                title: { 
                    display: true, 
                    // UPDATED: Now uses the full pair for a more accurate title
                    text: `${pair} Chart (Last ${visiblePoints} Hrs)`, 
                    fontSize: 18,
                    fontColor: '#EAECEF', // IMPROVED: Slightly brighter title color
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
                            position: 'right', // Put price on right like TradingView
                            ticks: { 
                                fontColor: '#64748B',
                                // This math pads the bottom with ~40% empty space so the RSI chart fits cleanly underneath
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

                                callback: function(value) {
                                // Only return a value if it's in the 0-100 range
                                if (value <= 100) {
                                    return value;
                                }
                                // For anything above 100, return null to hide it completely
                                return null;
                            },

                                fontColor: '#64748B'
                            },
                            gridLines: {
                                drawOnChartArea: false
                            }
                        }
                    ]
                },
                // V2 Compatible Annotations for Overbought / Oversold
                annotation: {
                    annotations: [
                        {
                            type: 'line',
                            mode: 'horizontal',
                            scaleID: 'yRsi', 
                            value: 70,
                            borderColor: '#ef4444', // Red Overbought line
                            borderWidth: 1.5,
                            borderDash: [4, 4]
                        },
                        {
                            type: 'line',
                            mode: 'horizontal',
                            scaleID: 'yRsi', 
                            value: 30,
                            borderColor: '#10b981', // Green Oversold line
                            borderWidth: 1.5,
                            borderDash: [4, 4]
                        }
                    ]
                }
            }
        };

        const response = await axios.post('https://quickchart.io/chart', {
            chart: chartConfig,
            width: 600,
            height: 400, 
            backgroundColor: '#131722', 
            format: 'png'
        }, {
            responseType: 'arraybuffer'
        });

        return Buffer.from(response.data);
    } catch (error) {
        const errorMessage = error.response && error.response.data 
            ? error.response.data.toString() 
            : error.message;
        console.error("Failed to generate chart image:", errorMessage);
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

        if (currentRSI < 35 && trendLabel === "UPTREND") { 
            sign = "🟢 [BUY ZONE] 🟢"; 
            recommendation = "Buy dips in uptrend";
            alert = true;
        } else if (currentRSI > 65 && trendLabel === "DOWNTREND") { 
            sign = "🔴 [SELL ZONE] 🔴"; 
            recommendation = "Sell bounces in downtrend";
            alert = true;
        }

        // 7. Request chart image creation
        // UPDATED: Pass the full 'normalizedSymbol' for a more accurate chart title
        const chartBuffer = await getChartBuffer(closes, emaValues, rsiValues, normalizedSymbol);

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