export function biggestFall(series) {
  let peak = series[0];
  let worst = 0;
  for (const price of series) {
    if (price > peak) peak = price;
    worst = Math.max(worst, ((peak - price) / peak) * 100);
  }
  return worst;
}

export function biggestRise(series) {
  let low = series[0];
  let best = 0;
  for (const price of series) {
    if (price < low) low = price;
    best = Math.max(best, ((price - low) / low) * 100);
  }
  return best;
}

export const money = (n) => `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 })}`;
