// Stock, fund and bond-fund prices.
//
// Prices come from Twelve Data (needs TWELVEDATA_API_KEY) and are kept in Tiger Data.
// A question reads them from Tiger with one query. Twelve Data is only called when we have
// nothing recent for that ticker, because its free plan allows 8 lookups a minute.
import { cached, MINUTE } from '@/lib/http';
import { hasDatabase, readPriceMove, savePrices } from '@/lib/store';

const HOUR = 60 * MINUTE;
const FRESH_FOR_HOURS = 12;
const TRADING_DAYS_IN_WEEK = 5;
const TRADING_DAYS_IN_MONTH = 21;

// One call to Twelve Data: about a month of daily closing prices, newest first.
// Returns null when the symbol does not exist.
export async function fetchDailyCloses(ticker) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&outputsize=${TRADING_DAYS_IN_MONTH + 1}`;
  const res = await fetch(url, {
    headers: { Authorization: `apikey ${process.env.TWELVEDATA_API_KEY}` },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  const data = await res.json();
  if (data.status === 'ok' && data.values?.length) {
    return data.values.map((v) => ({ date: v.datetime.slice(0, 10), close: Number(v.close) }));
  }
  // 400 and 404 mean the symbol does not exist. Anything else is a limit or an outage.
  if (data.code === 400 || data.code === 404) return null;
  throw new Error(data.message || `Twelve Data returned ${res.status}`);
}

function moveFromCloses(days) {
  const at = (n) => days[Math.min(n, days.length - 1)].close;
  return {
    price: days[0].close,
    weekPct: ((days[0].close - at(TRADING_DAYS_IN_WEEK)) / at(TRADING_DAYS_IN_WEEK)) * 100,
    monthPct: ((days[0].close - at(TRADING_DAYS_IN_MONTH)) / at(TRADING_DAYS_IN_MONTH)) * 100,
    asOf: days[0].date,
    // Oldest first, for the sparkline. Kept small on purpose.
    series: downsample(days.map((d) => d.close).reverse()),
  };
}

// Sparklines do not need every point. Keep the shape, drop the middle.
function downsample(values, max = 22) {
  if (values.length <= max) return values;
  const out = [];
  const step = (values.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(values[Math.round(i * step)]);
  return out;
}

function isFresh(stored) {
  return stored?.fetchedAt && Date.now() - new Date(stored.fetchedAt) < FRESH_FOR_HOURS * HOUR;
}

async function lookUp(ticker) {
  const stored = hasDatabase() ? await readPriceMove(ticker).catch(() => null) : null;
  if (isFresh(stored)) return { status: 'ok', ...stored };

  try {
    const days = await fetchDailyCloses(ticker);
    if (!days) return { status: 'not-found' };
    if (hasDatabase()) savePrices(ticker, days).catch((err) => console.error('Could not save prices:', err.message));
    return { status: 'ok', ...moveFromCloses(days) };
  } catch (err) {
    // The feed is busy. Older prices from Tiger are better than none.
    if (stored) return { status: 'ok', ...stored };
    throw err;
  }
}

// Returns { status: 'ok', price, weekPct, monthPct, asOf }
//      or { status: 'no-key' | 'not-found' | 'error' }
export async function getPriceMove(ticker) {
  if (!process.env.TWELVEDATA_API_KEY) return { status: 'no-key' };
  try {
    // Failures are not remembered, so a rate limit clears on the next try.
    return await cached(`price-${ticker}`, 10 * MINUTE, () => lookUp(ticker));
  } catch (err) {
    console.error(`Price lookup failed for ${ticker}:`, err.message);
    return { status: 'error' };
  }
}
