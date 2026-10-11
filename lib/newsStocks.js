import { LINKS } from '@/data/impact-graph';
import { hasAiKey, matchNews } from '@/lib/ai';
import { getLatestNews } from '@/lib/news';
import { getPriceMove } from '@/lib/prices';
import { getAnalystView } from '@/lib/analysts';
import { scoreSignal } from '@/lib/score';
import { readFeed, saveFeed } from '@/lib/store';
import { cached, MINUTE } from '@/lib/http';
import { findPlace, US_STATES } from '@/data/places';

const US_ONLY = new Set(['us-hurricane', 'winter-storm', 'inland-flood', 'western-wildfire']);

function inTheUS(item) {
  const place = findPlace(`${item.topic || ''} ${item.text}`);
  return Boolean(place) && (place.name === 'United States' || Object.hasOwn(US_STATES, place.name) || Object.values(US_STATES).some((s) => s?.name === place.name));
}

const STRENGTH = { strong: 3, likely: 2, guess: 1 };
const EMPTY = { stocks: [], markets: [] };

function headline(item) {
  const text = item.topic ? `${item.topic}: ${item.text}` : item.text;
  return text.length > 140 ? `${text.slice(0, 137).trimEnd()}...` : text;
}

async function matchesFor(news) {
  const key = `rules-4|${news.map((n) => n.id).join('|')}`;
  const saved = await readFeed('news-links');
  if (saved?.payload?.key === key) return saved.payload.matches;
  const matches = (await matchNews(news.map((n) => (n.topic ? `${n.topic}: ${n.text}` : n.text))))
    .map((m) => ({ newsId: news[m.news].id, links: m.links }));
  saveFeed('news-links', { key, matches });
  return matches;
}

async function build() {
  const news = await getLatestNews();
  if (!news.length || !hasAiKey()) return EMPTY;
  const matches = await matchesFor(news);

  const byTicker = new Map();
  const mixed = new Set();
  const markets = new Map();
  for (const match of matches) {
    const item = news.find((n) => n.id === match.newsId);
    if (!item) continue;
    const american = inTheUS(item);
    for (const link of match.links.map((id) => LINKS.get(id)).filter(Boolean)) {
      const { scenario } = link;
      if (US_ONLY.has(scenario.id) && !american) continue;
      const market = markets.get(scenario.id) || { id: scenario.id, name: scenario.short, newsIds: [] };
      if (!market.newsIds.includes(item.id)) market.newsIds.push(item.id);
      markets.set(scenario.id, market);

      for (const company of link.companies) {
        const seen = byTicker.get(company.ticker);
        if (!seen) {
          byTicker.set(company.ticker, {
            ticker: company.ticker,
            name: company.name,
            type: company.type || 'stock',
            direction: link.direction,
            confidence: link.confidence,
            chain: link.chain,
            wrongIf: link.wrongIf,
            mapped: true,
            market: scenario.short,
            newsIds: [item.id],
            headlines: [headline(item)],
          });
        } else if (seen.direction !== link.direction) {
          mixed.add(company.ticker);
        } else if (!seen.newsIds.includes(item.id)) {
          seen.newsIds.push(item.id);
          seen.headlines.push(headline(item));
          if (STRENGTH[link.confidence] > STRENGTH[seen.confidence]) seen.confidence = link.confidence;
        }
      }
    }
  }

  const stocks = await Promise.all([...byTicker.values()].filter((e) => !mixed.has(e.ticker)).map(async (e) => {
    const price = await getPriceMove(e.ticker);
    const analysts = await getAnalystView(e.ticker).catch(() => null);
    const score = scoreSignal({ direction: e.direction, confidence: e.confidence, events: e.newsIds.length, price, analysts });
    return { ...e, reason: `From the news: ${e.headlines[0]}`, price, analysts, score };
  }));
  stocks.sort((a, b) => Math.abs(b.score.value) - Math.abs(a.score.value) || a.name.localeCompare(b.name));

  return { stocks, markets: [...markets.values()] };
}

export function stocksFromNews() {
  return cached('news-stocks', 20 * MINUTE, build);
}
