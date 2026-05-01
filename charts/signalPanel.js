/**
 * Signal Panel Display - Shows TP/SL in separate panel
 * Not on the chart, displayed below or to the side
 */

/**
 * Format signal data for panel display
 * @param {Object} signal - Signal with all data
 * @returns {string} - HTML for panel
 */
function formatSignalPanel(signal) {
  if (!signal) {
    return '<div class="signal-panel empty"><p>No active signal</p></div>';
  }

  const isBuy = signal.type === 'BUY' || signal.signal === 'BUY';
  const icon = isBuy ? '🔺' : '🔻';
  const color = isBuy ? '#22c55e' : '#ef4444';
  const labelClass = isBuy ? 'buy-panel' : 'sell-panel';

  return `
    <div class="signal-panel ${labelClass}">
      <div class="panel-header" style="color: ${color};">
        ${icon} ${isBuy ? 'BUY SIGNAL' : 'SELL SIGNAL'}
      </div>
      
      <div class="panel-body">
        <div class="price-row">
          <span class="label">Entry:</span>
          <span class="value">$${(signal.entry || 0).toFixed(2)}</span>
        </div>
        
        <div class="price-row tp">
          <span class="label">TP1:</span>
          <span class="value" style="color: #22c55e;">$${(signal.tp1 || 0).toFixed(2)}</span>
        </div>
        
        <div class="price-row tp">
          <span class="label">TP2:</span>
          <span class="value" style="color: #10b981;">$${(signal.tp2 || 0).toFixed(2)}</span>
        </div>
        
        <div class="price-row sl">
          <span class="label">SL:</span>
          <span class="value" style="color: #ef4444;">$${(signal.sl || 0).toFixed(2)}</span>
        </div>
      </div>
      
      <div class="panel-footer">
        <div class="info-row">
          <span>RSI: ${(signal.rsi || 0).toFixed(1)}</span>
          <span>Trend: ${signal.trend || 'N/A'}</span>
          <span>Strength: ${((signal.strength || 0) * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create CSS styles for panel
 * @returns {string} - CSS markup
 */
function getPanelStyles() {
  return `
    <style>
      .signal-panel {
        width: 300px;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: 'Monaco', 'Courier New', monospace;
        background: #1a1a1a;
        border: 1px solid #333;
      }
      
      .signal-panel.empty {
        padding: 20px;
        text-align: center;
        color: #666;
      }
      
      .signal-panel.buy-panel {
        border-left: 4px solid #22c55e;
      }
      
      .signal-panel.sell-panel {
        border-left: 4px solid #ef4444;
      }
      
      .panel-header {
        padding: 12px 16px;
        font-weight: bold;
        font-size: 14px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid #333;
      }
      
      .panel-body {
        padding: 12px 16px;
      }
      
      .price-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 13px;
        color: #ccc;
      }
      
      .price-row.tp {
        color: #22c55e;
      }
      
      .price-row.sl {
        color: #ef4444;
      }
      
      .price-row .label {
        color: #999;
        min-width: 50px;
      }
      
      .price-row .value {
        font-weight: bold;
        text-align: right;
        flex-grow: 1;
      }
      
      .panel-footer {
        padding: 10px 16px;
        background: rgba(0, 0, 0, 0.3);
        border-top: 1px solid #333;
        font-size: 12px;
        color: #999;
      }
      
      .info-row {
        display: flex;
        justify-content: space-around;
      }
      
      .info-row span {
        flex: 1;
        text-align: center;
      }
      
      /* Tooltip */
      .arrow-tooltip {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 4px;
        padding: 8px 12px;
        font-size: 12px;
        color: #ccc;
        font-family: monospace;
      }
      
      .tooltip-header {
        font-weight: bold;
        margin-bottom: 6px;
      }
      
      .tooltip-body {
        margin-bottom: 6px;
        line-height: 1.4;
      }
      
      .tooltip-note {
        color: #666;
        font-size: 11px;
      }
    </style>
  `;
}

/**
 * Create complete panel HTML
 * @param {Object} signal - Signal data
 * @returns {string} - Complete HTML with styles
 */
function createSignalPanel(signal) {
  return `
    ${getPanelStyles()}
    ${formatSignalPanel(signal)}
  `;
}

/**
 * Update panel with new signal
 * @param {Object} signal - Signal data
 * @param {string} elementId - DOM element ID
 */
function updatePanelHTML(signal, elementId = 'signal-panel') {
  const element = typeof document !== 'undefined' ? document.getElementById(elementId) : null;
  if (element) {
    element.innerHTML = formatSignalPanel(signal);
  }
}

module.exports = {
  formatSignalPanel,
  getPanelStyles,
  createSignalPanel,
  updatePanelHTML
};
