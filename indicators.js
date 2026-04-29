const axios = require('axios');
const { SMA } = require('technicalindicators');

function normalizeSymbol(rawSymbol) {
    const symbol = String(rawSymbol || '').toUpperCase().trim();
    if (symbol.endsWith('USDT')) return symbol;
    if (symbol.endsWith('USD')) return `${symbol}T`;
    return symbol;
}

/**
 * Calculates the GainzAlgo indicator value for each kline.
 * GainzAlgo combines momentum, volatility, and volume strength.
 * @param {Array} klines - Array of kline data [timestamp, open, high, low, close, volume].
 * @returns {Array} An array of GainzAlgo values.
 */
function calculateGainzAlgo(klines) {
    if (!klines || klines.length < 20) {
        // Not enough data to calculate
        return [];
    }

    const volumes = klines.map(k => parseFloat(k[5]));
    const volumeSma20 = SMA.calculate({ period: 20, values: volumes });

    // Align SMA to have the same length as klines by padding at the start
    const alignedSma = [...new Array(klines.length - volumeSma20.length).fill(null), ...volumeSma20];

    const gainzAlgoValues = klines.map((kline, index) => {
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        const close = parseFloat(kline[4]);
        const volume = parseFloat(kline[5]);
        const smaVol = alignedSma[index];

        if (smaVol === null || smaVol === 0) return 0; // Skip if no SMA value yet

        const range = high - low;
        if (range === 0) return 0; // Avoid division by zero for doji candles

        // 1. Momentum Score (MS): Where did the price close within the candle's range? (-1 to +1)
        const momentumScore = ((close - low) - (high - close)) / range;

        // 2. Volatility Factor (VF): How large is the candle relative to its closing price?
        const volatilityFactor = range / close;
        
        // 3. Volume Strength (VS): Is the current volume above or below average?
        const volumeStrength = volume / smaVol;

        // Final Calculation
        const gainzAlgo = momentumScore * volatilityFactor * volumeStrength * 100;
        return gainzAlgo;
    });

    return gainzAlgoValues;
}


/**
 * Generates a Candlestick Chart with the GainzAlgo indicator from QuickChart.io.
 * @param {Array} klines - Raw kline data from the API.
 * @param {number[]} gainzAlgoValues - Array of GainzAlgo values.
 * @param {string} pair - The full trading pair symbol (e.g., 'BTCUSDT').
 * @returns {Promise<Buffer|null>} A buffer containing the chart image, or null on error.
 */
async function getChartBuffer(klines, gainzAlgoValues, pair) {
    // =========================================================================
    // <<< FIX: ADDED GUARD CLAUSE >>>
    // This prevents errors if the API returns insufficient data for a chart.
    if (!klines || klines.length === 0 || !gainzAlgoValues || gainzAlgoValues.length === 0) {
        console.error(`Chart generation skipped for ${pair}: Not enough data provided.`);
        return null;
    }
    // =========================================================================

    try {
        const visiblePoints = 72; // Show last 72 hours (3 days)
        const recentKlines = klines.slice(-visiblePoints);
        const recentGainzAlgo = gainzAlgoValues.slice(-visiblePoints);
        
        const candlestickData = recentKlines.map(k => ({
            x: parseInt(k[0]), // timestamp
            o: parseFloat(k[1]),
            h: parseFloat(k[2]),
            l: parseFloat(k[3]),
            c: parseFloat(k[4]),
        }));

        const gainzAlgoChartData = recentKlines.map((k, index) => ({
            x: parseInt(k[0]), // Use the same timestamp for alignment
            y: recentGainzAlgo[index] || 0, // Default to 0 if misaligned
            backgroundColor: (recentGainzAlgo[index] || 0) >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)',
            borderColor: (recentGainzAlgo[index] || 0) >= 0 ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)',
        }));
        
        // Safely extract min/max to prevent QuickChart "Infinity" 400 errors
        const validPrices = recentKlines.flatMap(k => [parseFloat(k[2]), parseFloat(k[3])]);
        const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
        const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 100;
        const priceRange = maxPrice - minPrice;

        const chartConfig = {
            type: 'bar', // Set to bar, but will be overridden by candlestick dataset
            data: {
                datasets: [
                    {
                        type: 'candlestick',
                        label: 'Price (OHLC)',
                        yAxisID: 'yPrice',
                        data: candlestickData
                    },
                    {
                        type: 'bar',
                        label: 'GainzAlgo',
                        yAxisID: 'yGainz',
                        data: gainzAlgoChartData,
                        borderWidth: 1,
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
                legend: { display: false },
                scales: {
                    xAxes: [{ 
                        type: 'time',
                        time: { unit: 'day', tooltipFormat: 'll HH:mm' },
                        ticks: { fontColor: '#64748B' },
                        gridLines: { color: 'rgba(255, 255, 255, 0.07)' }
                    }],
                    yAxes: [
                        { 
                            id: 'yPrice',
                            position: 'right',
                            scaleLabel: { display: true, labelString: 'Price', fontColor: '#94A3B8' },
                            ticks: { 
                                fontColor: '#64748B',
                                min: minPrice - priceRange * 0.1,
                                max: maxPrice + priceRange * 0.1
                            },
                            gridLines: { color: 'rgba(255, 255, 255, 0.07)' }
                        },
                        {
                            id: 'yGainz',
                            position: 'left',
                            scaleLabel: { display: true, labelString: 'GainzAlgo', fontColor: '#94A3B8' },
                            ticks: { fontColor: '#64748B', maxTicksLimit: 5 },
                            gridLines: { drawOnChartArea: false }
                        }
                    ]
                },
                plugins: {
                    // This specific key enables the financial charts plugin on QuickChart.io
                    financial: true
                },
                annotation: {
                    annotations: [
                        { type: 'line', mode: 'horizontal', scaleID: 'yGainz', value: 1.5, borderColor: '#10b981', borderWidth: 1, borderDash: [4, 4], label: { content: 'Strong Buy', enabled: true, position: 'right', fontColor: '#EAECEF' } },
                        { type: 'line', mode: 'horizontal', scaleID: 'yGainz', value: 0.5, borderColor: 'rgba(16, 185, 129, 0.5)', borderWidth: 1, borderDash: [2, 2] },
                        { type: 'line', mode: 'horizontal', scaleID: 'yGainz', value: -0.5, borderColor: 'rgba(239, 68, 68, 0.5)', borderWidth: 1, borderDash: [2, 2] },
                        { type: 'line', mode: 'horizontal', scaleID: 'yGainz', value: -1.5, borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 4], label: { content: 'Strong Sell', enabled: true, position: 'right', fontColor: '#EAECEF' } }
                    ]
                }
            }
        };

        const postData = {
            chart: chartConfig,
            width: 600,
            height: 400,
            backgroundColor: '#131722',
            format: 'png'
        };

        const response = await axios.post('https://quickchart.io/chart', postData, { 
            responseType: 'arraybuffer' 
        });

        return Buffer.from(response.data);
    } catch (error) {
        const errorMessage = error.response?.data?.toString() || error.message;
        console.error(`Failed to generate chart image for ${pair}:`, errorMessage);
        return null;
    }
}

async function getMarketAnalysis(symbol) {
    try {
        const normalizedSymbol = normalizeSymbol(symbol);
        const baseAsset = normalizedSymbol.replace(/(USDT|USD|PHP)$/, '');
        const usdtSymbol = `${baseAsset}USDT`;

        // 1. Fetch Klines (full OHLCV data) - limit 300 for calculations
        const klineUrl = `https://api.pro.coins.ph/openapi/v1/klines?symbol=${normalizedSymbol}&interval=1h&limit=300`;
        const klineResp = await axios.get(klineUrl);
        const klines = klineResp.data;

        // Ensure we have data before proceeding
        if (!klines || klines.length < 20) {
            console.warn(`Insufficient kline data for ${normalizedSymbol} to generate analysis.`);
            return null;
        }

        // 2. Fetch Tickers
        const tickerUrl = `https://api.pro.coins.ph/openapi/v1/ticker/24hr?symbol=${normalizedSymbol}`;
        const tickerResp = await axios.get(tickerUrl);
        const usdtTickerUrl = `https://api.pro.coins.ph/openapi/v1/ticker/24hr?symbol=${usdtSymbol}`;
        const usdtTickerResp = await axios.get(usdtTickerUrl);

        const currentPricePHP = parseFloat(tickerResp.data.lastPrice);
        const change24h = tickerResp.data.priceChangePercent;
        const currentPriceUSDT = parseFloat(usdtTickerResp.data.lastPrice);

        // 3. Calculate GainzAlgo
        const gainzAlgoValues = calculateGainzAlgo(klines);
        const currentGainzAlgo = gainzAlgoValues[gainzAlgoValues.length - 1];

        // 4. NEW GainzAlgo STRATEGY LOGIC
        let sign = "⚪ [HOLD] ⚪";
        let recommendation = "Market is consolidating, wait for a clear signal.";
        let alert = false;
        
        if (currentGainzAlgo > 1.5) {
            sign = "🟢🟢 [STRONG BUY] 🟢🟢";
            recommendation = "Strong bullish momentum detected with high volume.";
            alert = true;
        } else if (currentGainzAlgo < -1.5) {
            sign = "🔴🔴 [STRONG SELL] 🔴🔴";
            recommendation = "Strong bearish momentum detected with high volume.";
            alert = true;
        } else if (currentGainzAlgo > 0.5) {
            sign = "🟢 [BUY ZONE] 🟢";
            recommendation = "Bullish pressure is building, potential entry point.";
            alert = true;
        } else if (currentGainzAlgo < -0.5) {
            sign = "🔴 [SELL ZONE] 🔴";
            recommendation = "Bearish pressure is building, consider taking profit or shorting.";
            alert = true;
        }

        // 5. Request chart image creation
        const chartBuffer = await getChartBuffer(klines, gainzAlgoValues, normalizedSymbol);

        return {
            symbol: baseAsset,
            pair: normalizedSymbol,
            sign,
            recommendation,
            chartBuffer,
            gainzAlgo: currentGainzAlgo.toFixed(3),
            pricePHP: Number(currentPricePHP).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            priceUSDT: Number(currentPriceUSDT).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            change: change24h,
            alert,
        };
    } catch (error) {
        // Handle cases where the ticker might not exist (e.g., SOLUSDT vs SOLPHP)
        if (error.response && error.response.status === 400) {
            console.warn(`Could not fetch market data for ${symbol}. It may not be a valid pair.`);
        } else {
            console.error(`Indicator Error (${symbol}):`, error.message);
        }
        return null;
    }
}

module.exports = { getMarketAnalysis };