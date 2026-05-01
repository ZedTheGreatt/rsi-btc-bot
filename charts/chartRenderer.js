/**
 * Chart Renderer - Simple Arrow Overlay
 * Renders ONLY arrows on chart (no boxes or UI)
 * TP/SL displayed in separate panel
 */

/**
 * Create SVG arrow for chart overlay
 * @param {Object} arrow - Arrow data
 * @param {number} xPixels - X position in pixels
 * @param {number} yPixels - Y position in pixels
 * @returns {string} - SVG markup
 */
function createArrowSVG(arrow, xPixels, yPixels) {
  if (!arrow) return '';

  const isBelow = arrow.position === 'below';
  const arrowSize = 20;
  const offset = isBelow ? arrowSize + 5 : -(arrowSize + 5);

  // SVG for arrow
  return `
    <g class="arrow-marker" data-type="${arrow.type}">
      <!-- Arrow line -->
      <line x1="${xPixels}" y1="${yPixels}" 
            x2="${xPixels}" y2="${yPixels + offset}"
            stroke="${arrow.color}" stroke-width="2" 
            stroke-linecap="round"/>
      
      <!-- Arrow head (triangle) -->
      ${isBelow ? 
        `<polygon points="${xPixels},${yPixels + offset} ${xPixels - 6},${yPixels + offset - 10} ${xPixels + 6},${yPixels + offset - 10}"
                   fill="${arrow.color}"/>` :
        `<polygon points="${xPixels},${yPixels + offset} ${xPixels - 6},${yPixels + offset + 10} ${xPixels + 6},${yPixels + offset + 10}"
                   fill="${arrow.color}"/>`
      }
      
      <!-- Text label (optional, far away) -->
      <text x="${xPixels + 10}" y="${yPixels + offset}" 
            font-size="10" fill="${arrow.color}" font-weight="bold">
        ${arrow.type}
      </text>
    </g>
  `;
}

/**
 * Render all arrows as SVG overlay
 * @param {Array} candlesWithArrows - Candles with arrow data
 * @param {Object} chartDimensions - { width, height, minPrice, maxPrice, timeRange }
 * @returns {string} - Complete SVG group
 */
function renderArrowsOverlay(candlesWithArrows, chartDimensions) {
  if (!candlesWithArrows || candlesWithArrows.length === 0) {
    return '<g id="arrows"></g>';
  }

  let svg = '<g id="arrows" class="arrow-overlay-group">';

  candlesWithArrows.forEach((candle, idx) => {
    if (!candle.arrow) return;

    // Calculate pixel position
    const xPercent = idx / candlesWithArrows.length;
    const xPixels = chartDimensions.x0 + (xPercent * chartDimensions.width);

    // Calculate Y from price
    const priceRange = chartDimensions.maxPrice - chartDimensions.minPrice;
    const yPercent = (candle.arrow.y - chartDimensions.minPrice) / priceRange;
    const yPixels = chartDimensions.y0 + (1 - yPercent) * chartDimensions.height;

    svg += createArrowSVG(candle.arrow, xPixels, yPixels);
  });

  svg += '</g>';
  return svg;
}

/**
 * Get HTML tooltip for arrow hover
 * @param {Object} arrow - Arrow data
 * @returns {string} - HTML markup
 */
function getArrowTooltipHTML(arrow) {
  return `
    <div class="arrow-tooltip">
      <div class="tooltip-header">${arrow.icon} ${arrow.type} Signal</div>
      <div class="tooltip-body">
        <div>RSI: ${arrow.rsi?.toFixed(1) || 'N/A'}</div>
        <div>Trend: ${arrow.trend || 'N/A'}</div>
        <div>Strength: ${(arrow.strength * 100)?.toFixed(0) || 'N/A'}%</div>
      </div>
      <div class="tooltip-note">TP/SL in panel below</div>
    </div>
  `;
}

/**
 * Extract arrow data for panel display
 * @param {Array} candlesWithArrows - Candles with arrows
 * @returns {Array} - Array of arrow objects with all data
 */
function extractArrowsForPanel(candlesWithArrows) {
  const arrows = [];

  candlesWithArrows.forEach((candle, idx) => {
    if (candle.arrow) {
      arrows.push({
        index: idx,
        ...candle.arrow,
        timestamp: candle.t
      });
    }
  });

  return arrows;
}

module.exports = {
  createArrowSVG,
  renderArrowsOverlay,
  getArrowTooltipHTML,
  extractArrowsForPanel
};
