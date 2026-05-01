/**
 * Arrow Overlay System for Chart - GainzAlgo V2 Alpha Style
 * 
 * CLEAN DESIGN:
 *   - Arrows ONLY on chart (no UI boxes)
 *   - BUY  🔺 green - Attached BELOW candle low
 *   - SELL 🔻 red   - Attached ABOVE candle high
 * 
 * Signal Analysis:
 *   - Trend (EMA cross)
 *   - RSI confirmation (30-70)
 *   - Candle pattern validation
 * 
 * TP/SL displayed in SEPARATE PANEL (not on chart)
 */

/**
 * Attach arrow signals to candles
 * Minimal data structure - arrows only, no UI boxes
 * @param {Array} candles - OHLC candles
 * @param {Array} signals - Trading signals
 * @returns {Array} - Candles with arrow data
 */
function addArrows(candles, signals) {
  if (!Array.isArray(signals) || signals.length === 0) {
    return candles.map(candle => ({
      ...candle,
      arrow: null
    }));
  }

  const signalMap = new Map();
  signals.forEach(signal => {
    if (signal.index !== undefined) {
      signalMap.set(signal.index, signal);
    }
  });

  return candles.map((candle, index) => {
    const signal = signalMap.get(index);

    if (!signal || (signal.signal !== 'BUY' && signal.signal !== 'SELL')) {
      return { ...candle, arrow: null };
    }

    const isBuy = signal.signal === 'BUY';

    return {
      ...candle,
      arrow: {
        type: isBuy ? 'BUY' : 'SELL',
        icon: isBuy ? '🔺' : '🔻',
        color: isBuy ? '#22c55e' : '#ef4444',
        position: isBuy ? 'below' : 'above',
        // Arrow position at candle extremes
        y: isBuy ? candle.l : candle.h,
        time: candle.t,
        // Signal confirmation factors
        rsi: signal.rsi,
        trend: signal.trend,
        strength: signal.strength || 0,
        // Data for panel display
        entry: signal.entry,
        tp1: signal.tp1 ?? (signal.tp ? signal.tp[0] : 0),
        tp2: signal.tp2 ?? (signal.tp ? signal.tp[1] : 0),
        sl: signal.sl
      }
    };
  });
}

/**
 * Format signal for arrow display
 * @param {Object} signal - Signal from analysis
 * @param {number} index - Candle index
 * @returns {Object|null} - Arrow signal
 */
function formatSignalForArrow(signal, index) {
  if (!signal || !signal.signal) return null;

  const isBuy = signal.signal === 'BUY';
  const isSell = signal.signal === 'SELL';

  if (!isBuy && !isSell) return null;

  return {
    index,
    signal: isBuy ? 'BUY' : 'SELL',
    rsi: signal.rsi,
    trend: signal.trend,
    strength: signal.strength,
    // Pricing for panel display
    entry: signal.entry,
    tp1: signal.tp1 ?? (signal.tp ? signal.tp[0] : 0),
    tp2: signal.tp2 ?? (signal.tp ? signal.tp[1] : 0),
    sl: signal.sl
  };
}

/**
 * Get arrow markers for Chart.js (scatter points)
 * Simple triangles pointing up/down - NO BOXES
 * @param {Array} signals - Signals with arrow data
 * @returns {Array} - Chart.js scatter datasets
 */
function getArrowDatasets(signals, candles = []) {
  const normalizeSignalPoint = (signal) => {
    const candle = candles[signal.index] || {};
    const isBuy = signal.signal === 'BUY';
    return {
      ...signal,
      t: signal.t ?? candle.t,
      y: signal.y ?? (isBuy ? candle.l : candle.h)
    };
  };

  const validSignals = signals
    .filter(s => s && (s.signal === 'BUY' || s.signal === 'SELL'))
    .map(normalizeSignalPoint)
    .filter(s => s.t != null && Number.isFinite(Number(s.y)));

  const buySignals = validSignals.filter(s => s.signal === 'BUY');
  const sellSignals = validSignals.filter(s => s.signal === 'SELL');

  const datasets = [];

  if (buySignals.length > 0) {
    datasets.push({
      type: 'scatter',
      label: '🔺 BUY',
      yAxisID: 'yPrice',
      data: buySignals.map(s => ({
        x: s.t,
        y: s.y
      })),
      pointStyle: 'triangle',
      pointRotation: 0,
      pointRadius: 6,
      pointBackgroundColor: '#22c55e',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1,
      showLine: false,
      fill: false
    });
  }

  if (sellSignals.length > 0) {
    datasets.push({
      type: 'scatter',
      label: '🔻 SELL',
      yAxisID: 'yPrice',
      data: sellSignals.map(s => ({
        x: s.t,
        y: s.y
      })),
      pointStyle: 'triangle',
      pointRotation: 180,
      pointRadius: 6,
      pointBackgroundColor: '#ef4444',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1,
      showLine: false,
      fill: false
    });
  }

  return datasets;
}

function normalizeArrowSignals(signals, candles = []) {
  return (Array.isArray(signals) ? signals : [])
    .filter(s => s && (s.signal === 'BUY' || s.signal === 'SELL'))
    .map((signal) => {
      const candle = candles[signal.index] || {};
      const isBuy = signal.signal === 'BUY';
      return {
        ...signal,
        t: signal.t ?? candle.t,
        y: signal.y ?? (isBuy ? candle.l : candle.h),
        candle
      };
    })
    .filter(s => s.t != null && Number.isFinite(Number(s.y)));
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'N/A';
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toPrecision(4);
}

/**
 * Get QuickChart/Chart.js annotation markers for arrows.
 * These are more reliable on rendered Telegram images than scatter markers.
 * @param {Array} signals - Signals with arrow data
 * @param {Array} candles - Visible candles
 * @param {number} priceRange - Visible chart price range
 * @returns {Object} - Chart.js annotation config entries
 */
function getArrowAnnotations(signals, candles = [], priceRange = 1) {
  const annotations = {};
  const arrowSignals = normalizeArrowSignals(signals, candles);
  const range = Math.max(Number(priceRange), 0.00000001);
  const bubbleOffset = Math.max(range * 0.25, 0.00000001);
  const boxOffset = Math.max(range * 0.33, 0.00000001);
  const compact = arrowSignals.length > 14;
  const fontSize = compact ? 8 : 10;

  arrowSignals.forEach((signal, i) => {
    const isBuy = signal.signal === 'BUY';
    const color = isBuy ? '#00f58a' : '#ff2f55';
    const borderColor = isBuy ? '#b8ffd8' : '#ffd0d8';
    const anchorY = Number(signal.y);
    const bubbleY = isBuy ? anchorY - bubbleOffset : anchorY + bubbleOffset;
    const boxY = isBuy ? anchorY - boxOffset : anchorY + boxOffset;
    const key = `${signal.signal.toLowerCase()}Arrow${i}`;
    const tpText = signal.tp1 ? `TP: ₱${formatPrice(signal.tp1)}` : 'TP: N/A';
    const slText = signal.sl ? `SL: ₱${formatPrice(signal.sl)}` : 'SL: N/A';

    annotations[`${key}Pointer`] = {
      type: 'line',
      xMin: signal.t,
      xMax: signal.t,
      yMin: bubbleY,
      yMax: anchorY,
      xScaleID: 'x',
      yScaleID: 'yPrice',
      borderColor: color,
      borderWidth: compact ? 1.5 : 2.25
    };

    annotations[`${key}Bubble`] = {
      type: 'label',
      xValue: signal.t,
      yValue: bubbleY,
      xScaleID: 'x',
      yScaleID: 'yPrice',
      yAdjust: isBuy ? 10 : -10,
      content: [signal.signal],
      color: '#061018',
      backgroundColor: color,
      borderColor,
      borderWidth: 1.4,
      borderRadius: 8,
      padding: compact ? 4 : 6,
      shadowBlur: compact ? 4 : 10,
      shadowColor: color,
      font: {
        size: fontSize,
        weight: 'bold',
        family: 'Arial'
      }
    };

    annotations[`${key}WickDot`] = {
      type: 'point',
      xValue: signal.t,
      yValue: anchorY,
      xScaleID: 'x',
      yScaleID: 'yPrice',
      radius: compact ? 2 : 2.75,
      pointStyle: 'circle',
      backgroundColor: color,
      borderColor,
      borderWidth: 1
    };

    if (!compact || i % 2 === 0) {
      annotations[`${key}RiskBox`] = {
        type: 'label',
        xValue: signal.t,
        yValue: boxY,
        xScaleID: 'x',
        yScaleID: 'yPrice',
        yAdjust: isBuy ? 12 : -12,
        content: [tpText, slText],
        color: '#e5e7eb',
        backgroundColor: 'rgba(42, 52, 68, 0.78)',
        borderColor: 'rgba(148, 163, 184, 0.55)',
        borderWidth: 1,
        borderRadius: 6,
        padding: 4,
        font: {
          size: compact ? 7 : 8,
          weight: 'bold',
          family: 'Arial'
        }
      };
    }
  });

  return annotations;
}

/**
 * Get TP/SL line annotations for chart (dashed lines only)
 * These are OPTIONAL dashed guides, not boxes
 * @param {Object} latestSignal - Most recent signal
 * @returns {Object} - Chart.js plugin annotation config
 */
function getTPSLAnnotations(latestSignal) {
  if (!latestSignal || !latestSignal.tp1 || !latestSignal.sl) {
    return {};
  }

  return {
    tp1Line: {
      type: 'line',
      yMin: latestSignal.tp1,
      yMax: latestSignal.tp1,
      yScaleID: 'yPrice',
      borderColor: '#22c55e',
      borderWidth: 1,
      borderDash: [5, 5],
      label: {
        content: 'TP1',
        enabled: true,
        position: 'end',
        color: '#22c55e',
        font: { size: 9, weight: 'bold' }
      }
    },
    tp2Line: {
      type: 'line',
      yMin: latestSignal.tp2,
      yMax: latestSignal.tp2,
      yScaleID: 'yPrice',
      borderColor: '#10b981',
      borderWidth: 1,
      borderDash: [5, 5],
      label: {
        content: 'TP2',
        enabled: true,
        position: 'end',
        color: '#10b981',
        font: { size: 9, weight: 'bold' }
      }
    },
    slLine: {
      type: 'line',
      yMin: latestSignal.sl,
      yMax: latestSignal.sl,
      yScaleID: 'yPrice',
      borderColor: '#ef4444',
      borderWidth: 1,
      borderDash: [5, 5],
      label: {
        content: 'SL',
        enabled: true,
        position: 'end',
        color: '#ef4444',
        font: { size: 9, weight: 'bold' }
      }
    }
  };
}

/**
 * Format signal for side panel display (TP/SL details)
 * @param {Object} signal - Signal with all data
 * @returns {Object} - Formatted for panel
 */
function formatSignalForPanel(signal) {
  if (!signal) return null;

  return {
    type: signal.signal || signal.type,
    icon: (signal.signal || signal.type) === 'BUY' ? '🔺' : '🔻',
    color: (signal.signal || signal.type) === 'BUY' ? '#22c55e' : '#ef4444',
    entry: signal.entry,
    tp1: signal.tp1,
    tp2: signal.tp2,
    sl: signal.sl,
    rsi: signal.rsi,
    trend: signal.trend,
    strength: signal.strength
  };
}

module.exports = {
  addArrows,
  formatSignalForArrow,
  getArrowDatasets,
  getArrowAnnotations,
  getTPSLAnnotations,
  formatSignalForPanel
};
