const axios = require('axios');
const { SMA, ATR } = require('technicalindicators');

function normalizeSymbol(rawSymbol) {
    const symbol = String(rawSymbol || '').toUpperCase().trim();
    if (symbol.endsWith('USDT')) return symbol;
    if (symbol.endsWith('USD')) return `${symbol}T`;
    return symbol;
}

/**
 * Calculates the GainzAlgo indicator value. This is a proxy for momentum.
 */
function calculateGainzAlgo(klines) {
    if (!klines || klines.length < 20) return [];
    
    const volumes = klines.map(k => parseFloat(k[5]));
    const volumeSma20 = SMA.calculate({ period: 20, values: volumes });
    const alignedSma = [...new Array(klines.length - volumeSma20.length).fill(null), ...volumeSma20];

    return klines.map((kline, index) => {
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        const close = parseFloat(kline[4]);
        const volume = parseFloat(kline[5]);
        const smaVol = alignedSma[index];
        if (smaVol === null || smaVol === 0) return 0;
        const range = high - low;
        if (range === 0) return 0;
        const momentumScore = ((close - low) - (high - close)) / range;
        const volatilityFactor = range / close;
        const volumeStrength = volume / smaVol;
        return momentumScore * volatilityFactor * volumeStrength * 100;
    });
}

/**
 * Generates discrete BUY/SELL signals based on GainzAlgo logic.
 * Also calculates TP and SL.
 */
function generateSignals(klines, gainzAlgoValues) {
    const signals = [];
    if (klines.length < 20) return signals;

    const atrInput = {
        high: klines.map(k => parseFloat(k[2])),
        low: klines.map(k => parseFloat(k[3])),
        close: klines.map(k => parseFloat(k[4])),
        period: 14
    };
    const atrValues = ATR.calculate(atrInput);
    // Align ATR to match klines array length
    const alignedAtr = [...new Array(klines.length - atrValues.length).fill(0), ...atrValues];

    const buyThreshold = 1.0;
    const sellThreshold = -1.0;

    for (let i = 1; i < gainzAlgoValues.length; i++) {
        const prevValue = gainzAlgoValues[i - 1];
        const currentValue = gainzAlgoValues[i];
        const kline = klines[i];
        const closePrice = parseFloat(kline[4]);
        const atr = alignedAtr[i] || (parseFloat(kline[2]) - parseFloat(kline[3]));
        
        let signal = null;

        // Buy Signal: Crosses up through the buy threshold
        if (prevValue < buyThreshold && currentValue >= buyThreshold) {
            signal = {
                type: 'BUY',
                time: parseInt(kline[0]),
                price: closePrice,
                sl: (closePrice - atr * 1.5).toFixed(4),
                tp: (closePrice + atr * 2.0).toFixed(4),
            };
        }
        // Sell Signal: Crosses down through the sell threshold
        else if (prevValue > sellThreshold && currentValue <= sellThreshold) {
            signal = {
                type: 'SELL',
                time: parseInt(kline[0]),
                price: closePrice,
                sl: (closePrice + atr * 1.5).toFixed(4),
                tp: (closePrice - atr * 2.0).toFixed(4),
            };
        }

        if (signal) signals.push(signal);
    }
    return signals;
}

/**
 * Generates a Candlestick Chart with GainzAlgo BUY/SELL signals plotted.
 */
async function getChartBuffer(klines, signals, pair) {
    if (!klines || klines.length === 0) {
        console.error(`Chart generation skipped for ${pair}: No kline data.`);
        return null;
    }

    try {
        const visiblePoints = 90; // Show last 90 hours
        const recentKlines = klines.slice(-visiblePoints);
        const startTime = recentKlines[0] ? parseInt(recentKlines[0][0]) : 0;

        // Filter signals to only those visible on the chart
        const visibleSignals = signals.filter(s => s.time >= startTime);

        const candlestickData = recentKlines.map(k => ({
            x: parseInt(k[0]),
            o: parseFloat(k[1]), h: parseFloat(k[2]),
            l: parseFloat(k[3]), c: parseFloat(k[4]),
        }));

        const buySignalsData = visibleSignals.filter(s => s.type === 'BUY').map(s => ({
            x: s.time,
            y: parseFloat(s.sl) * 0.998 // Position slightly below the candle
        }));

        const sellSignalsData = visibleSignals.filter(s => s.type === 'SELL').map(s => ({
            x: s.time,
            y: parseFloat(s.sl) * 1.002 // Position slightly above the candle
        }));

        const chartConfig = {
            type: 'candlestick',
            data: {
                datasets: [
                    {
                        label: 'Price',
                        data: candlestickData,
                    },
                    {
                        label: 'Buy Signals',
                        type: 'scatter',
                        data: buySignalsData,
                        backgroundColor: '#10B981',
                        pointStyle: 'triangle',
                        rotation: 0,
                        radius: 8,
                    },
                    {
                        label: 'Sell Signals',
                        type: 'scatter',
                        data: sellSignalsData,
                        backgroundColor: '#EF4444',
                        pointStyle: 'triangle',
                        rotation: 180,
                        radius: 8,
                    }
                ]
            },
            options: {
                title: { 
                    display: true, 
                    text: `Coins.ph ${pair} Chart with GainzAlgo Signals`, 
                    fontSize: 18, fontColor: '#EAECEF'
                },
                legend: { display: false },
                scales: {
                    xAxes: [{ 
                        type: 'time',
                        time: { unit: 'day', tooltipFormat: 'll HH:mm' },
                        ticks: { fontColor: '#64748B' },
                        gridLines: { color: 'rgba(255, 255, 255, 0.07)' }
                    }],
                    yAxes: [{ 
                        position: 'right',
                        ticks: { fontColor: '#64748B' },
                        gridLines: { color: 'rgba(255, 255, 255, 0.07)' }
                    }]
                },
                plugins: {
                    financial: true, // Enable candlestick plugin
                    datalabels: { // Configure labels for signals
                        display: (context) => context.dataset.label.includes('Signals'),
                        align: (context) => context.dataset.label.includes('Buy') ? 'bottom' : 'top',
                        color: 'white',
                        font: { weight: 'bold' },
                        formatter: (value, context) => {
                            const signal = visibleSignals.find(s => s.time === value.x);
                            if (!signal) return '';
                            // Return multi-line text
                            return `${signal.type}\nTP: ${signal.tp}\nSL: ${signal.sl}`;
                        }
                    }
                }
            }
        };

        const response = await axios.post('https://quickchart.io/chart', {
            chart: chartConfig, width: 600, height: 400, backgroundColor: '#131722', format: 'png'
        }, { responseType: 'arraybuffer' });

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

        const klineUrl = `https://api.pro.coins.ph/openapi/v1/klines?symbol=${normalizedSymbol}&interval=1h&limit=300`;
        const klineResp = await axios.get(klineUrl);
        const klines = klineResp.data;

        if (!klines || klines.length < 20) {
            console.warn(`Insufficient kline data for ${normalizedSymbol}.`);
            return null;
        }

        const tickerUrl = `https://api.pro.coins.ph/openapi/v1/ticker/24hr?symbol=${normalizedSymbol}`;
        const tickerResp = await axios.get(tickerUrl);
        const usdtTickerUrl = `https://api.pro.coins.ph/openapi/v1/ticker/24hr?symbol=${usdtSymbol}`;
        const usdtTickerResp = await axios.get(usdtTickerUrl);

        const gainzAlgoValues = calculateGainzAlgo(klines);
        const signals = generateSignals(klines, gainzAlgoValues);
        const latestSignal = signals.length > 0 ? signals[signals.length - 1] : null;
        
        // Alert only if a new signal appeared on the most recent completed candle
        const lastKlineTime = klines[klines.length - 2][0]; // Check the last *closed* candle
        const newSignalOccurred = latestSignal && latestSignal.time === lastKlineTime;
        
        let sign = "⚪ [HOLD] ⚪";
        let recommendation = "No new signal. Monitoring market conditions.";
        
        if (newSignalOccurred) {
            if (latestSignal.type === 'BUY') {
                sign = "🟢🟢 [NEW BUY SIGNAL] 🟢🟢";
                recommendation = `Entry at ~${latestSignal.price}. TP: ${latestSignal.tp}, SL: ${latestSignal.sl}.`;
            } else {
                sign = "🔴🔴 [NEW SELL SIGNAL] 🔴🔴";
                recommendation = `Entry at ~${latestSignal.price}. TP: ${latestSignal.tp}, SL: ${latestSignal.sl}.`;
            }
        }

        const chartBuffer = await getChartBuffer(klines, signals, normalizedSymbol);
        
        const currentPricePHP = parseFloat(tickerResp.data.lastPrice);
        const change24h = tickerResp.data.priceChangePercent;
        const currentPriceUSDT = parseFloat(usdtTickerResp.data.lastPrice);

        return {
            symbol: baseAsset,
            sign,
            recommendation,
            chartBuffer,
            gainzAlgo: gainzAlgoValues[gainzAlgoValues.length-1].toFixed(3),
            pricePHP: Number(currentPricePHP).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            priceUSDT: Number(currentPriceUSDT).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            change: change24h,
            alert: newSignalOccurred, // Alert is now true only on a new signal
        };
    } catch (error) {
        if (error.response && error.response.status === 400) {
            console.warn(`Could not fetch market data for ${symbol}. It may not be a valid pair.`);
        } else {
            console.error(`Indicator Error (${symbol}):`, error.message);
        }
        return null;
    }
}

module.exports = { getMarketAnalysis };