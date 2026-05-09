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
 * @param {{ t: number, o: number, h: number, l: number, c: number, v?: number }[]} ohlcBars - Hourly OHLC (open time ms).
 * @param {number[]} ema50Values - Array of EMA 50 values.
 * @param {number[]} ema200Values - Array of EMA 200 values.
 * @param {string} pair - The full trading pair symbol (e.g., 'BTCUSDT').
 * @returns {Promise<Buffer|null>} A buffer containing the chart image, or null on error.
 */
async function getChartBuffer(ohlcBars, ema50Values, ema200Values, pair) {
  try {
    const align = (values, length) =>
      values.length >= length
        ? values.slice(-length)
        : [...new Array(length - values.length).fill(null), ...values];

    const n = ohlcBars.length;
    const alignedEma50 = align(ema50Values, n);
    const alignedEma200 = align(ema200Values, n);
    const volumeValues = ohlcBars.map((b) => b.v || 0);
    const alignedVolume = align(volumeValues, n);

    const visiblePoints = 73; // Show ~3 days of hourly data
    const chartBars = ohlcBars.slice(-visiblePoints);
    const chartEma50 = alignedEma50.slice(-visiblePoints);
    const chartEma200 = alignedEma200.slice(-visiblePoints);
    const chartVolume = alignedVolume.slice(-visiblePoints);

    const lineSeries = (ys) =>
      chartBars.map((b, i) => {
        const y = ys[i];
        return {
          x: i,
          y: y != null && typeof y === 'number' && !Number.isNaN(y) ? y : null,
        };
      });

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

    const maxVolume = chartVolume.length > 0 ? Math.max(...chartVolume.filter((v) => v != null)) : 100;

    const labels = chartBars.map((b) => {
  const d = new Date(b.t);
  const ph = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));

  const h = ph.getHours();
  const day = ph.getDate();
  const month = ph.toLocaleString('en-US', { month: 'short' });

  if (h === 0) return `${month} ${day}`; // midnight
  if (h === 12) return `12:00`; // noon

  return null; // ❗ NOT empty string
});

  const chartConfig = {
    data: {
      datasets: [
        // 🕯️ CANDLES
        {
          type: 'candlestick',
          label: 'OHLC (1h)',
          yAxisID: 'yPrice',
          data: chartBars.map((b, i) => ({
            x: i,
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

        // EMA 50
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

        // EMA 200
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

        // 📊 VOLUME (10–20% visual weight handled via axis scaling)
        {
          type: 'bar',
          label: 'Volume (1h)',
          yAxisID: 'yVolume',
          data: chartBars.map((b, i) => ({
            x: i,
            y: chartVolume[i] ?? 0,
          })),
          backgroundColor: chartBars.map((b) =>
            b.c >= b.o
              ? 'rgba(38, 166, 154, 0.55)'
              : 'rgba(239, 83, 80, 0.55)'
          ),
          borderWidth: 0,
        },
      ],
    },

    options: {
      scales: {
        // 📌 X AXIS (custom labels with PH time formatting)
        x: {
  type: 'category',

  labels,

  offset: true, // 🔥 aligns candles to grid center

  ticks: {
    color: '#64748B',

    autoSkip: false,

    callback: (value, index) => {
      const label = labels[index];
      return label ? label : ''; // only show real ticks
    },

    padding: 10,
  },

  grid: {
    color: (ctx) => {
      const label = labels[ctx.index];
      return label ? '#64748B' : '#64748B';
    },

    drawTicks: true, // 👈 IMPORTANT (needed for alignment feel)
  },
},

        // 💰 PRICE AXIS (80% focus)
        yPrice: {
          position: 'right',
          min: minPrice - priceRange * 0.2,
          max: maxPrice + priceRange * 0.01,
          ticks: { color: '#64748B' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
        },

        // 📊 VOLUME AXIS (compressed visual weight ~10–20%)
        yVolume: {
          position: 'left',
          type: 'linear',
          min: 0,
          max: maxVolume * 10, // compress height so it stays small
          ticks: { display: false },
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
          labels: {
            color: '#94A3B8',
            boxWidth: 15,
          },
        },

        annotation: {
          annotations: {},
        },
      },
    },
  };

    const response = await axios.post('https://quickchart.io/chart', { chart: chartConfig, version: '4', width: 600, height: 600, backgroundColor: '#131722', format: 'png' }, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    const errorMessage = error.response?.data?.toString() || error.message;
    console.error('Failed to generate chart image:', errorMessage);
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

    const ohlcBars = klineResp.data.map((d) => ({ t: Number(d[0]), o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]), v: parseFloat(d[5]) || 0 }));
    const closes = ohlcBars.map((b) => b.c);
    const currentPricePHP = parseFloat(tickerResp.data.lastPrice);
    const change24h = tickerResp.data.priceChangePercent;

    // 3. Technical Indicators
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const ema50Values = EMA.calculate({ values: closes, period: 50 });
    const ema200Values = EMA.calculate({ values: closes, period: 200 });

    const currentRSI = rsiValues[rsiValues.length - 1];
    const prevRSI = rsiValues[rsiValues.length - 2] || null;
    const currentEMA50 = ema50Values[ema50Values.length - 1];
    const currentEMA200 = ema200Values[ema200Values.length - 1];
    const prevEMA50 = ema50Values[ema50Values.length - 2] || null;

    // 4. USDT Price
    const currentPriceUSDT = parseFloat(usdtTickerResp.data.lastPrice).toFixed(2);

    // 5. Volume & candle metrics
    const volumes = ohlcBars.map((b) => b.v || 0);
    const lastVolumes = volumes.slice(-20);
    const volumeSMA20 = lastVolumes.length ? lastVolumes.reduce((a, b) => a + b, 0) / lastVolumes.length : 0;

    const lastBar = ohlcBars[ohlcBars.length - 1] || { o: 0, h: 0, l: 0, c: 0 };
    const candlePct = lastBar.o ? ((lastBar.c - lastBar.o) / lastBar.o) * 100 : 0;
    const bodySize = Math.abs(lastBar.c - lastBar.o);
    const range = Math.max(0.0000001, lastBar.h - lastBar.l);
    const bodyRatio = bodySize / range;

    // 6. NEW 5-TIER STRATEGY LOGIC (kept for compatibility)
    let sign = '⚪ HOLD ⚪';
    let recommendation = 'No strong direction, wait for confirmation.';
    let alert = false;

    const isBullTrend = currentEMA50 > currentEMA200;
    const isBearTrend = currentEMA50 < currentEMA200;
    const isEma50Rising = currentEMA50 >= prevEMA50;

    if (currentRSI < 30 && currentPricePHP >= currentEMA50 && isBullTrend) {
      sign = '🟢🟢 STRONG BUY 🟢🟢';
      recommendation = 'Oversold in a confirmed uptrend. Prime reversal opportunity.';
      alert = true;
    } else if (currentRSI > 70 && currentPricePHP < currentEMA50 && isBearTrend) {
      sign = '🔴🔴 STRONG SELL 🔴🔴';
      recommendation = 'Overbought in a confirmed downtrend. Prime exit opportunity.';
      alert = true;
    } else if (currentRSI >= 30 && currentRSI < 45 && currentPricePHP > currentEMA50 * 0.99 && (isEma50Rising || isBullTrend)) {
      sign = '🟢 BUY ZONE 🟢';
      recommendation = 'Early entry zone as upward momentum may be forming.';
      alert = true;
    } else if (currentRSI > 55 && currentRSI <= 70 && currentPricePHP < currentEMA50 * 1.01 && !isEma50Rising) {
      sign = '🔴 SELL ZONE 🔴';
      recommendation = 'Weakness showing; a possible down move may be forming.';
      alert = true;
    }

    let trend = 'SIDEWAYS';
    if (isBullTrend) trend = 'UPTREND';
    else if (isBearTrend) trend = 'DOWNTREND';

    // 7. Request chart image creation
    const chartBuffer = await getChartBuffer(ohlcBars, ema50Values, ema200Values, normalizedSymbol);

    const formatNumber = (num) => Number(num).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    return {
      symbol: baseAsset,
      pair: normalizedSymbol,
      sign,
      recommendation,
      chartBuffer,
      rsi: currentRSI?.toFixed?.(2) ?? null,
      rsi_raw: currentRSI,
      rsi_prev: prevRSI,
      ema50: formatNumber(currentEMA50),
      ema50_raw: currentEMA50,
      ema200: formatNumber(currentEMA200),
      ema200_raw: currentEMA200,
      pricePHP: Number(currentPricePHP).toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      price_raw: currentPricePHP,
      priceUSDT: Number(currentPriceUSDT).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: change24h,
      alert,
      trend,
      volume_raw: volumes[volumes.length - 1] || 0,
      volume_sma20: volumeSMA20,
      candle_pct: candlePct,
      candle_body_ratio: bodyRatio,
      _ema50_prev: prevEMA50,
    };
  } catch (error) {
    console.error(`Indicator Error (${symbol}):`, error.message);
    return null;
  }
}

module.exports = { getMarketAnalysis };
