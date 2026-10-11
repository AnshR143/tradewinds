// What Wall Street analysts say about a company, from Financial Modeling Prep (needs
// FMP_API_KEY). This is other people's published opinion, shown with its source. It is
// separate from our own signal, which is about one event.
//
// The free plan covers only some companies and allows 250 requests a day, so every answer,
// including "not covered", is kept in Tiger Data for a day.
import { MINUTE } from '@/lib/http';
import { readFeed, saveFeed } from '@/lib/store';

const BASE = 'https://financialmodelingprep.com/stable';
const DAY = 24 * 60 * MINUTE;
const DAILY_LIMIT = 220;

const memory = new Map(); // ticker -> { at, view }
let calls = { day: '', count: 0 };

function underLimit() {
  const today = new Date().toISOString().slice(0, 10);
  if (calls.day !== today) calls = { day: today, count: 0 };
  return calls.count < DAILY_LIMIT;
}

// Returns the parsed reply, or null when this company is not on our plan.
async function ask(path) {
  calls.count += 1;
  const res = await fetch(`${BASE}/${path}`, {
    headers: { apikey: process.env.FMP_API_KEY },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (res.status === 402) return null;
  if (!res.ok) throw new Error(`FMP returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data[0] || null : null;
}

async function fetchView(ticker) {
  const grades = await ask(`grades-consensus?symbol=${encodeURIComponent(ticker)}`);
  if (!grades) return { covered: false };
  const target = await ask(`price-target-consensus?symbol=${encodeURIComponent(ticker)}`).catch(() => null);
  const buy = (grades.strongBuy || 0) + (grades.buy || 0);
  const sell = (grades.strongSell || 0) + (grades.sell || 0);
  const hold = grades.hold || 0;
  if (buy + hold + sell === 0) return { covered: false };
  return {
    covered: true,
    buy,
    hold,
    sell,
    consensus: grades.consensus || null,
    target: target?.targetConsensus || null,
  };
}

// Returns { covered: true, buy, hold, sell, consensus, target } or null when we have nothing.
export async function getAnalystView(ticker) {
  if (!process.env.FMP_API_KEY) return null;
  const fresh = (entry) => entry && Date.now() - new Date(entry.at) < DAY;

  let entry = memory.get(ticker);
  if (!fresh(entry)) {
    const saved = await readFeed(`analysts-${ticker}`);
    if (saved) entry = { at: saved.fetchedAt, view: saved.payload };
  }
  if (!fresh(entry) && underLimit()) {
    try {
      entry = { at: new Date().toISOString(), view: await fetchView(ticker) };
      saveFeed(`analysts-${ticker}`, entry.view);
    } catch (err) {
      console.error(`Analyst ratings failed for ${ticker}:`, err.message);
    }
  }
  if (entry) memory.set(ticker, entry);
  return entry?.view?.covered ? entry.view : null;
}

// Used by the background job: true when this ticker still needs a first look today.
export async function needsAnalystView(ticker) {
  if (!process.env.FMP_API_KEY) return false;
  if (memory.has(ticker)) return false;
  const saved = await readFeed(`analysts-${ticker}`);
  if (saved && Date.now() - new Date(saved.fetchedAt) < DAY) {
    memory.set(ticker, { at: saved.fetchedAt, view: saved.payload });
    return false;
  }
  return true;
}
