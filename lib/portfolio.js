import { SCENARIOS } from '@/data/impact-graph';

const MAX_HOLDINGS = 50;
const NOT_TICKERS = new Set(['SHARES', 'SHARE', 'USD', 'QTY', 'TICKER', 'SYMBOL', 'ETF', 'STOCK', 'STOCKS', 'FUND', 'CASH', 'BOND', 'BONDS', 'TOTAL', 'NAME', 'PRICE', 'VALUE', 'INC', 'CORP', 'CO', 'LTD', 'THE', 'I', 'A', 'MY', 'AND', 'OF']);

export const MAP_COMPANIES = new Map(
  SCENARIOS.flatMap((s) => s.links.flatMap((l) => l.companies.map((c) => [c.ticker, c.name]))),
);

export function parsePortfolio(text) {
  const holdings = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const inBrackets = line.match(/\(([A-Za-z]{1,5}(?:\.[A-Za-z])?)\)/);
    const words = line.split(/[\s,;:|\t]+/).filter(Boolean);
    const candidate =
      (inBrackets && !NOT_TICKERS.has(inBrackets[1].toUpperCase()) ? inBrackets[1] : null) ||
      words.find((w) => /^[A-Z]{1,5}(\.[A-Z])?$/.test(w) && !NOT_TICKERS.has(w)) ||
      (words.filter((w) => !/^[$\d.,]+$/.test(w)).length === 1
        ? words.find((w) => /^[A-Za-z]{1,5}$/.test(w) && !NOT_TICKERS.has(w.toUpperCase()))
        : null);
    if (!candidate) continue;

    const ticker = candidate.toUpperCase();
    const number = words.map((w) => w.replace(/[$,]/g, '')).find((w) => /^\d+(\.\d+)?$/.test(w));
    if (!holdings.has(ticker)) holdings.set(ticker, { ticker, shares: number ? Number(number) : null });
    if (holdings.size >= MAX_HOLDINGS) break;
  }
  return [...holdings.values()];
}

export function exposureNow(signals, holdings) {
  const held = new Set(holdings.map((h) => h.ticker));
  const rows = [];
  const seen = new Set();
  for (const signal of signals?.sky || []) {
    const scenario = SCENARIOS.find((s) => s.id === signal.scenario);
    if (!scenario) continue;
    for (const link of scenario.links) {
      for (const company of link.companies) {
        const key = `${company.ticker}|${scenario.id}|${link.id}`;
        if (!held.has(company.ticker) || seen.has(key)) continue;
        seen.add(key);
        rows.push({
          ticker: company.ticker,
          name: company.name,
          event: signal.title,
          direction: link.direction,
          effect: link.chain[link.chain.length - 1],
          wrongIf: link.wrongIf,
        });
      }
    }
  }
  return rows;
}
