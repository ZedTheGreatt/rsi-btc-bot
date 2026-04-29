const QuickChart = require("quickchart-js");

async function generateChart(candles, signal) {
  const labels = candles.map((c, i) => i);

  const data = candles.map(c => ({
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close
  }));

  const chart = new QuickChart();

  chart.setConfig({
    type: "candlestick",
    data: {
      labels,
      datasets: [{
        label: "Price",
        data
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      }
    }
  });

  return chart.getUrl();
}

module.exports = { generateChart };