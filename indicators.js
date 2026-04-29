const axios = require('axios');
const { SMA, ATR } = require('technicalindicators');

const puppeteer = require('puppeteer');

// =========================
// SYMBOL NORMALIZER
// =========================
function normalizeSymbol(sym) {
  sym = String(sym || '').toUpperCase().trim();

  if (!sym) return null;
  if (sym.endsWith('USDT')) return sym;
  if (sym.endsWith('USD')) return `${sym}T`;
  if (sym.endsWith('PHP')) return sym;

  return `${sym}PHP`;
}

// =========================
// GAINZALGO V2 CORE
// =========================
function gainzAlgo(klines) {
  const closes = klines.map(k => +k[4]);
  const volumes = klines.map(k => +k[5]);

  const smaVol = SMA.calculate({ period: 20, values: volumes });
  const aligned = [...Array(closes.length - smaVol.length).fill(null), ...smaVol];

  return klines.map((k, i) => {
    const high = +k[2];
    const low = +k[3];
    const close = +k[4];
    const vol = +k[5];

    const volAvg = aligned[i];
    if (!volAvg) return 0;

    const range = high - low || 1;

    const momentum = ((close - low) - (high - close)) / range;
    const strength = vol / volAvg;

    return momentum * strength * 100;
  });
}

// =========================
// SIGNAL ENGINE (V2 IMPROVED)
// =========================
function signals(klines, ga) {
  const result = [];

  const atr = ATR.calculate({
    high: klines.map(k => +k[2]),
    low: klines.map(k => +k[3]),
    close: klines.map(k => +k[4]),
    period: 14
  });

  const atrA = [...Array(klines.length - atr.length).fill(0), ...atr];

  const sma50 = SMA.calculate({
    period: 50,
    values: klines.map(k => +k[4])
  });

  const smaA = [...Array(klines.length - sma50.length).fill(null), ...sma50];

  const buyT = 1.5;
  const sellT = -1.5;

  for (let i = 1; i < klines.length; i++) {
    const prev = ga[i - 1];
    const cur = ga[i];

    const close = +klines[i][4];
    const time = +klines[i][0];

    const trendUp = smaA[i] && close > smaA[i];
    const trendDown = smaA[i] && close < smaA[i];

    const a = atrA[i] || 0;

    let sig = null;

    if (prev < buyT && cur >= buyT && trendUp) {
      sig = {
        type: 'BUY',
        time,
        price: close,
        tp: close + a * 2,
        sl: close - a * 1.5
      };
    }

    if (prev > sellT && cur <= sellT && trendDown) {
      sig = {
        type: 'SELL',
        time,
        price: close,
        tp: close - a * 2,
        sl: close + a * 1.5
      };
    }

    if (sig) result.push(sig);
  }

  return result;
}

// =========================
// CANDLE CHART (PUPPETEER)
// =========================
async function renderChart(klines, sigs, pair) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  const candles = klines.slice(-80).map(k => ({
    x: +k[0],
    o: +k[1],
    h: +k[2],
    l: +k[3],
    c: +k[4]
  }));

  const buys = sigs.filter(s => s.type === 'BUY');
  const sells = sigs.filter(s => s.type === 'SELL');

  await page.setContent(`
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-chart-financial"></script>
</head>
<body style="background:#0b0f14">
<canvas id="c"></canvas>
<script>
const ctx = document.getElementById('c');

new Chart(ctx, {
  type: 'candlestick',
  data: {
    datasets: [{
      label: '${pair}',
      data: ${JSON.stringify(candles)}
    },{
      type:'scatter',
      label:'BUY',
      data:${JSON.stringify(buys.map(b => ({x:b.time,y:b.price})))},
      backgroundColor:'lime',
      pointRadius:6
    },{
      type:'scatter',
      label:'SELL',
      data:${JSON.stringify(sells.map(s => ({x:s.time,y:s.price})))},
      backgroundColor:'red',
      pointRadius:6
    }]
  },
  options:{
    plugins:{legend:{display:false}},
    scales:{
      x:{type:'time'},
      y:{position:'right'}
    }
  }
});
</script>
</body>
</html>`);

  const buffer = await page.screenshot({ fullPage: true });

  await browser.close();
  return buffer;
}

// =========================
// MAIN ANALYSIS
// =========================
async function getMarketAnalysis(symbol) {
  try {
    const s = normalizeSymbol(symbol);

    const kl = await axios.get(
      `https://api.pro.coins.ph/openapi/v1/klines?symbol=${s}&interval=1h&limit=200`
    );

    const klines = kl.data;
    const ga = gainzAlgo(klines);
    const sig = signals(klines, ga);

    const last = sig[sig.length - 1];
    const close = +klines.at(-1)[4];

    const alert = last && klines.at(-2)[0] === last.time;

    const chart = await renderChart(klines, sig, s);

    return {
      symbol: s,
      sign: alert ? `🚨 ${last.type} SIGNAL` : '⚪ HOLD',
      recommendation: last
        ? `${last.type} @ ${last.price}`
        : 'No signal',
      gainzAlgo: ga.at(-1).toFixed(2),
      pricePHP: close.toFixed(2),
      priceUSDT: close.toFixed(2),
      change: 0,
      chartBuffer: chart,
      alert
    };

  } catch (e) {
    console.error(e.message);
    return null;
  }
}

module.exports = { getMarketAnalysis };