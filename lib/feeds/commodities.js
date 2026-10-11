// Commodity prices: oil and natural gas from Alpha Vantage, gold from Financial Modeling
// Prep. A price that has risen
// sharply over the past month becomes a signal, matched to the impact map like a storm is.
//
// The free plan allows 25 requests a day, so the prices are fetched twice a day at most and
// kept in Tiger Data between restarts.
import { MINUTE } from '@/lib/http';
import { readFeed, saveFeed } from '@/lib/store';

const HOUR = 60 * MINUTE;
const REFRESH_AFTER_HOURS = 12;
const TRADING_DAYS_IN_MONTH = 21;
// A rise this large over a month counts as "rising" and triggers the matching scenario.
const RISING_PCT = 5;

// Gold comes from Financial Modeling Prep (needs FMP_API_KEY), which lists it newest first.
async function fetchGold() {
  const res = await fetch('https://financialmodelingprep.com/stable/historical-price-eod/light?symbol=GCUSD', {
    headers: { apikey: process.env.FMP_API_KEY },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new Error('unexpected reply for gold');
  return data.slice(0, 30).map((d) => ({ date: d.date, value: Number(d.price) }));
}

const SERIES = [
  { fn: 'WTI', id: 'oil', title: 'Crude oil', unit: 'a barrel', scenario: 'oil-up' },
  { fn: 'NATURAL_GAS', id: 'gas', title: 'Natural gas', unit: 'per unit', scenario: 'gas-up' },
  { fn: null, id: 'gold', title: 'Gold', unit: 'an ounce', scenario: 'gold-up', source: 'Financial Modeling Prep' },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSeries(fn) {
  const url = `https://www.alphavantage.co/query?function=${fn}&interval=daily&apikey=${process.env.ALPHAVANTAGE_API_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  const data = await res.json();
  if (!Array.isArray(data.data)) throw new Error(data.Information || data.Note || 'unexpected reply');
  // Newest first. Days with no price are marked "." and skipped.
  return data.data.filter((d) => d.value !== '.').slice(0, 30).map((d) => ({ date: d.date, value: Number(d.value) }));
}

// Fetches every series we have a key for. When one fails, its last known price is kept, so
// a busy source never erases good data.
async function fetchAll(previous = []) {
  const prices = [];
  for (const series of SERIES) {
    const keyed = series.id === 'gold' ? process.env.FMP_API_KEY : process.env.ALPHAVANTAGE_API_KEY;
    if (!keyed) continue;
    try {
      const days = series.id === 'gold' ? await fetchGold() : await fetchSeries(series.fn);
      const now = days[0];
      const then = days[Math.min(TRADING_DAYS_IN_MONTH, days.length - 1)];
      prices.push({ id: series.id, date: now.date, value: now.value, monthPct: ((now.value - then.value) / then.value) * 100 });
    } catch (err) {
      console.error(`${series.title} price failed:`, String(err.message).slice(0, 100));
      const kept = previous.find((p) => p.id === series.id);
      if (kept) prices.push(kept);
    }
    await wait(1500); // Alpha Vantage's free plan allows one request a second
  }
  return prices;
}

function toSignal(price) {
  const series = SERIES.find((s) => s.id === price.id);
  const moved = `${price.monthPct >= 0 ? 'up' : 'down'} ${Math.abs(price.monthPct).toFixed(1)}% over the past month`;
  const rising = price.monthPct >= RISING_PCT;
  return {
    id: `price-${price.id}`,
    kind: 'commodity',
    source: series.source || 'US energy data via Alpha Vantage',
    title: `${series.title} ${rising ? 'is rising' : 'price'}`,
    where: 'World price',
    time: `${price.date}T12:00:00Z`,
    detail: `$${price.value.toFixed(2)} ${series.unit}, ${moved}`,
    monthPct: price.monthPct,
    near: [],
    lat: null,
    lon: null,
    region: null,
    scenario: rising ? series.scenario : null,
    prompt: `The price of ${series.title.toLowerCase()} is $${price.value.toFixed(2)} ${series.unit}, ${moved} (as of ${price.date}).`,
  };
}

let latest = null; // { prices, at }
let refreshing = null;
let lastAttempt = 0;

function expected() {
  return SERIES.filter((s) => (s.id === 'gold' ? process.env.FMP_API_KEY : process.env.ALPHAVANTAGE_API_KEY)).length;
}

async function refresh() {
  lastAttempt = Date.now();
  const prices = await fetchAll(latest?.prices);
  if (prices.length) {
    latest = { prices, at: new Date().toISOString() };
    saveFeed('commodities', prices);
  }
}

export async function getCommoditySignals() {
  if (!process.env.ALPHAVANTAGE_API_KEY && !process.env.FMP_API_KEY) return [];

  if (!latest) {
    const saved = await readFeed('commodities');
    if (saved) latest = { prices: saved.payload, at: saved.fetchedAt };
  }
  const stale = !latest || Date.now() - new Date(latest.at) > REFRESH_AFTER_HOURS * HOUR;
  const incomplete = latest && latest.prices.length < expected();
  // A missing series is retried every 10 minutes, not on every page load.
  const due = stale || (incomplete && Date.now() - lastAttempt > 10 * MINUTE);

  if (due && !refreshing) {
    // One refresh at a time: two pages loading together must not double the requests.
    refreshing = refresh()
      .catch((err) => console.error('Commodity prices failed:', String(err.message).slice(0, 120)))
      .finally(() => { refreshing = null; });
  }
  if (!latest && refreshing) await refreshing;
  return (latest?.prices || []).map(toSignal);
}
