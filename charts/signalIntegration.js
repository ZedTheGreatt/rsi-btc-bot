const { addArrows, getArrowDatasets } = require('./arrows');
const { formatSignalPanel } = require('./signalPanel');

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getSignalType(engineOutput) {
  const signalText = String(engineOutput?.signal || '').toUpperCase();
  if (signalText.includes('BUY')) return 'BUY';
  if (signalText.includes('SELL')) return 'SELL';
  return null;
}

function formatEngineSignal(engineOutput, candleIndex, candles = [], fallback = {}) {
  const signalType = getSignalType(engineOutput);
  if (!signalType) return null;

  const candle = candles[candleIndex] || candles[candles.length - 1] || {};

  return {
    index: Number.isInteger(candleIndex) ? candleIndex : Math.max(candles.length - 1, 0),
    signal: signalType,
    rsi: toNumber(engineOutput?.debug?.marketRSI ?? engineOutput?.rsi ?? fallback.rsi, 50),
    trend: engineOutput?.trend || fallback.trend || 'N/A',
    strength: Math.max(0, Math.min(1, toNumber(engineOutput?.score, 0) / 100)),
    entry: toNumber(engineOutput?.entry ?? candle.c, 0),
    tp1: toNumber(engineOutput?.tp1, 0),
    tp2: toNumber(engineOutput?.tp2, 0),
    sl: toNumber(engineOutput?.sl, 0)
  };
}

function buildSignalArtifacts(engineOutput, candleIndex, candles = [], fallback = {}) {
  const signal = formatEngineSignal(engineOutput, candleIndex, candles, fallback);
  if (!signal) return null;

  const candlesWithArrows = addArrows(candles, [signal]);

  return {
    signal,
    candlesWithArrows,
    arrowDatasets: getArrowDatasets([signal], candles),
    panelHTML: formatSignalPanel(signal),
    telegramMessage: formatTelegramSignalMessage(signal, engineOutput, fallback)
  };
}

async function handleNewSignal(engineOutput, candleIndex, candles, fallback = {}) {
  return buildSignalArtifacts(engineOutput, candleIndex, candles, fallback);
}

function formatTelegramSignalMessage(signal, engineOutput = {}, options = {}) {
  const isBuy = signal.signal === 'BUY';
  const icon = isBuy ? 'UP' : 'DOWN';
  const sideLabel = isBuy ? 'BUY SIGNAL' : 'SELL SIGNAL';
  const currency = options.currency || 'PHP';
  const score = engineOutput.score ?? options.score ?? 'N/A';

  const formatPrice = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 'N/A';
    return `${currency} ${n.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return [
    `*${sideLabel}*`,
    '',
    `${icon} Position Entry: *${formatPrice(signal.entry)}*`,
    '',
    '*Take Profits:*',
    `TP1: ${formatPrice(signal.tp1)}`,
    `TP2: ${formatPrice(signal.tp2)}`,
    '',
    `*Stop Loss:* ${formatPrice(signal.sl)}`,
    '',
    '*Analysis:*',
    `Trend: ${signal.trend || 'N/A'}`,
    `RSI: ${Number.isFinite(Number(signal.rsi)) ? Number(signal.rsi).toFixed(1) : 'N/A'}`,
    `Strength: ${Number.isFinite(Number(signal.strength)) ? (Number(signal.strength) * 100).toFixed(0) : 'N/A'}%`,
    `Score: ${score}`,
    '',
    isBuy ? 'Bullish momentum confirmed' : 'Bearish momentum confirmed'
  ].join('\n');
}

function setupChartWithArrows(candles, signals) {
  const candlesWithArrows = addArrows(candles, signals);
  const candleDataset = {
    type: 'candlestick',
    label: 'Price',
    data: candles.map(c => ({
      x: c.t,
      o: c.o,
      h: c.h,
      l: c.l,
      c: c.c
    }))
  };

  return {
    type: 'candlestick',
    data: {
      datasets: [candleDataset, ...getArrowDatasets(signals, candles)]
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#ffffff',
            font: { family: 'monospace' }
          }
        }
      },
      scales: {
        y: {
          position: 'left',
          ticks: { color: '#999' },
          title: {
            display: true,
            text: 'Price',
            color: '#999'
          }
        },
        x: {
          ticks: { color: '#999' }
        }
      }
    },
    candlesWithArrows
  };
}

class SignalMonitor {
  constructor(candles, chartElement, panelElement) {
    this.candles = candles;
    this.signals = [];
    this.chartElement = chartElement;
    this.panelElement = panelElement;
  }

  onNewSignal(engineOutput, candleIndex, fallback = {}) {
    const signal = formatEngineSignal(engineOutput, candleIndex, this.candles, fallback);
    if (!signal) return null;

    this.signals.push(signal);
    this.updateChart();
    this.updatePanel();
    return signal;
  }

  updateChart() {
    if (!this.chartElement) return;
    const arrowDatasets = getArrowDatasets(this.signals, this.candles);

    if (this.chartElement.data?.datasets) {
      this.chartElement.data.datasets = this.chartElement.data.datasets
        .filter(dataset => dataset.label !== 'BUY' && dataset.label !== 'SELL')
        .concat(arrowDatasets);
    }

    if (typeof this.chartElement.update === 'function') {
      this.chartElement.update();
    }
  }

  updatePanel() {
    if (!this.panelElement || this.signals.length === 0) return;
    const latestSignal = this.signals[this.signals.length - 1];
    this.panelElement.innerHTML = formatSignalPanel(latestSignal);
  }

  clear() {
    this.signals = [];
    this.updatePanel();
  }
}

module.exports = {
  buildSignalArtifacts,
  formatEngineSignal,
  formatTelegramSignalMessage,
  handleNewSignal,
  setupChartWithArrows,
  SignalMonitor
};
