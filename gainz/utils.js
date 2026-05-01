function round(num, decimals = 2) {
  return Number(num).toFixed(decimals);
}

function formatNumber(num) {
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function percentChange(oldValue, newValue) {
  if (!oldValue || oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

function average(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function last(arr, index = 1) {
  if (!arr || !arr.length) return null;
  return arr[arr.length - index];
}

function candleStrength(candle) {
  const range = candle.h - candle.l;
  if (range <= 0) return 0;

  const body = Math.abs(candle.c - candle.o);
  return body / range;
}

function isBullishCandle(candle) {
  return candle.c > candle.o;
}

function isBearishCandle(candle) {
  return candle.c < candle.o;
}

function isDoji(candle) {
  const strength = candleStrength(candle);
  return strength < 0.1;
}

function upperWick(candle) {
  return candle.h - Math.max(candle.o, candle.c);
}

function lowerWick(candle) {
  return Math.min(candle.o, candle.c) - candle.l;
}

module.exports = {
  round,
  formatNumber,
  percentChange,
  average,
  last,
  candleStrength,
  isBullishCandle,
  isBearishCandle,
  isDoji,
  upperWick,
  lowerWick
};