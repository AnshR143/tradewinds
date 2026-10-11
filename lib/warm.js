// Background job: keeps a month of daily prices in Tiger Data for every company in the
// impact map. It fetches one ticker every few seconds to stay under the price feed's free
// limit of 8 lookups a minute, and refreshes each ticker twice a day.
import { LINKS } from '@/data/impact-graph';
import { fetchDailyCloses } from '@/lib/prices';
import { hasDatabase, savePrices, tickersNeedingRefresh } from '@/lib/store';
import { getAnalystView, needsAnalystView } from '@/lib/analysts';
import { getPatterns } from '@/lib/patterns';

const SECONDS_BETWEEN_LOOKUPS = 10;
const REFRESH_EVERY_HOURS = 12;
const CHECK_EVERY_MINUTES = 30;

const MAP_TICKERS = [...new Set([...LINKS.values()].flatMap((link) => link.companies.map((c) => c.ticker)))];

const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

async function refreshStale() {
  const stale = await tickersNeedingRefresh(MAP_TICKERS, REFRESH_EVERY_HOURS);
  if (stale.length) console.log(`Price warmer: refreshing ${stale.length} tickers`);
  for (const ticker of stale) {
    try {
      const days = await fetchDailyCloses(ticker);
      if (days) await savePrices(ticker, days);
      else console.error(`Price warmer: ${ticker} is in the impact map but the price feed does not know it`);
    } catch (err) {
      console.error(`Price warmer: ${ticker} failed:`, err.message);
    }
    await wait(SECONDS_BETWEEN_LOOKUPS);
  }
}

// One company every few seconds, so the first answer about it does not have to wait.
async function fillAnalystViews() {
  for (const ticker of MAP_TICKERS) {
    if (!(await needsAnalystView(ticker))) continue;
    await getAnalystView(ticker);
    await wait(3);
  }
}

// Safe to call on every request. Only the first call starts the job.
export function startPriceWarmer() {
  if (globalThis.priceWarmerStarted || !hasDatabase() || !process.env.TWELVEDATA_API_KEY) return;
  globalThis.priceWarmerStarted = true;
  (async () => {
    for (;;) {
      await refreshStale().catch((err) => console.error('Price warmer:', err.message));
      await fillAnalystViews().catch((err) => console.error('Analyst views:', err.message));
      await wait(CHECK_EVERY_MINUTES * 60);
    }
  })();
}

// A second background job: every half hour, count the planes near each storm and save the
// counts in Tiger Data. That history is what lets the map say "fewer than earlier today".
// Half an hour keeps this within what the plane feed allows in a day.
const PLANE_WATCH_MINUTES = 30;

export function startPlaneWatch() {
  if (globalThis.planeWatchStarted || !hasDatabase()) return;
  globalThis.planeWatchStarted = true;
  (async () => {
    for (;;) {
      await getPatterns().catch((err) => console.error('Plane watch:', err.message));
      await wait(PLANE_WATCH_MINUTES * 60);
    }
  })();
}
