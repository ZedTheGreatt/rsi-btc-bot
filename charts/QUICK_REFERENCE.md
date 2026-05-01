# 🎯 Arrow System - Quick Reference Card

## Arrow Placement

### BUY Signal
```
Position: BELOW candle low
Icon: 🔺
Color: GREEN (#22c55e)
Placement: arrow.y = candle.l
```

### SELL Signal
```
Position: ABOVE candle high
Icon: 🔻
Color: RED (#ef4444)
Placement: arrow.y = candle.h
```

---

## Core Functions

### Format Signal
```javascript
const signal = {
  index: 150,
  signal: "BUY" | "SELL",
  entry: 42500,
  tp1: 43000,
  tp2: 43500,
  sl: 42000,
  rsi: 45.2,
  trend: "BULLISH",
  strength: 0.75
};
```

### Add Arrows
```javascript
const { addArrows } = require('./charts/arrows');
const candlesWithArrows = addArrows(candles, signals);
```

### Get Chart Datasets
```javascript
const { getArrowDatasets } = require('./charts/arrows');
const datasets = getArrowDatasets(signals);
// Use with Chart.js
```

### Display Panel
```javascript
const { formatSignalPanel } = require('./charts/signalPanel');
const html = formatSignalPanel(signal);
document.getElementById('signal-panel').innerHTML = html;
```

---

## File Quick Links

| File | Purpose | Key Export |
|------|---------|-----------|
| arrows.js | Format signals | `addArrows()`, `getArrowDatasets()` |
| chartRenderer.js | Render arrows | `renderArrowsOverlay()` |
| signalPanel.js | Show TP/SL | `formatSignalPanel()` |

---

## Arrow Data Structure

```javascript
arrow: {
  type: "BUY" | "SELL",        // Signal type
  icon: "🔺" | "🔻",            // Icon emoji
  color: "#22c55e" | "#ef4444", // Color
  position: "below" | "above",  // Chart position
  y: candle.l | candle.h,       // Price level
  entry: 42500,                 // Entry price
  tp1: 43000,                   // Take Profit 1
  tp2: 43500,                   // Take Profit 2
  sl: 42000,                    // Stop Loss
  rsi: 45.2,                    // RSI value
  trend: "BULLISH",             // Market trend
  strength: 0.75                // Signal strength (0-1)
}
```

---

## Integration Steps

### 1️⃣ Format
Convert engine output to signal format

### 2️⃣ Attach
Use `addArrows()` to attach to candles

### 3️⃣ Render
Use `getArrowDatasets()` to create chart markers

### 4️⃣ Display
Use `formatSignalPanel()` to show TP/SL

### 5️⃣ Update
Repeat steps 1-4 when new signal arrives

---

## Chart.js Integration

```javascript
// Add arrows as scatter plot
chart.data.datasets.push({
  type: 'scatter',
  label: '🔺 BUY / 🔻 SELL',
  data: [...arrowDatasets],
  pointStyle: 'triangle',
  pointRadius: 6,
  pointBackgroundColor: '#22c55e' // or #ef4444
});
chart.update();
```

---

## Panel Display

```html
<!-- Add to your HTML -->
<div id="signal-panel"></div>

<!-- Style (included in signalPanel.js) -->
<link rel="stylesheet" href="charts/signalPanel.css">
```

---

## Telegram Message Template

```
🟢 BUY SIGNAL 🟢
🔺 Position Entry: $42,500.00

📊 Take Profits:
   TP1: $43,000.00
   TP2: $43,500.00

🛑 Stop Loss: $42,000.00

📈 Analysis:
   Trend: BULLISH
   RSI: 45.2
   Strength: 75%
   Score: 78
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Arrows not showing | Check signal format |
| Wrong position | Verify candle.l/h values |
| Panel not updating | Check elementId |
| Arrows overlapping | Adjust pointRadius |
| Colors wrong | Verify color hex codes |

---

## Performance Tips

✅ Only render visible signals  
✅ Batch updates when possible  
✅ Use debouncing for real-time  
✅ Limit history displayed  
✅ Cache formatted signals  

---

## Color Reference

| Element | Color | Hex |
|---------|-------|-----|
| BUY Arrow | Green | #22c55e |
| SELL Arrow | Red | #ef4444 |
| TP Lines | Green | #22c55e, #10b981 |
| SL Line | Red | #ef4444 |

---

## Documentation Files

📖 **ARROW_DESIGN.md** - Full specification  
💻 **INTEGRATION_EXAMPLE.js** - Code examples  
⚙️ **arrows.js** - Main functions  
🎨 **chartRenderer.js** - Rendering  
📊 **signalPanel.js** - Panel display  

---

**Status:** ✅ Ready  
**Version:** 2.0  
**Last Updated:** May 2026
