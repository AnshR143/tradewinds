import { cached, getJson, MINUTE } from '@/lib/http';

function percent(price) {
  const pct = Number(price) * 100;
  if (pct < 1) return 'under 1%';
  if (pct > 99) return 'over 99%';
  return `${Math.round(pct)}%`;
}

function yesPrice(market) {
  try {
    const outcomes = JSON.parse(market.outcomes);
    const prices = JSON.parse(market.outcomePrices);
    const i = outcomes.indexOf('Yes');
    return i === -1 ? null : Number(prices[i]);
  } catch {
    return null;
  }
}

function summarize(event) {
  const open = (event.markets || [])
    .filter((m) => !m.closed)
    .map((m) => ({ label: m.groupItemTitle || 'Yes', price: yesPrice(m) }))
    .filter((m) => m.price !== null);
  if (!open.length) return null;

  open.sort((a, b) => b.price - a.price);
  return {
    question: event.title,
    url: `https://polymarket.com/event/${event.slug}`,
    outcomes: open.slice(0, 3).map((m) => ({ label: m.label, chance: percent(m.price) })),
  };
}

export async function getOdds(query) {
  if (!query) return [];
  return cached(`odds-${query.toLowerCase()}`, 5 * MINUTE, async () => {
    try {
      const url = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(query)}&limit_per_type=6`;
      const data = await getJson(url);
      return (data.events || [])
        .filter((e) => e.active && !e.closed)
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .map(summarize)
        .filter(Boolean)
        .slice(0, 2);
    } catch (err) {
      console.error('Prediction market lookup failed:', err.message);
      return [];
    }
  });
}

const TOPICS = [
  { tag: 'geopolitics', id: 'world', label: 'World affairs' },
  { tag: 'politics', id: 'elections', label: 'Elections and government' },
  { tag: 'economy', id: 'economy', label: 'Economy' },
];

const NOISE = /tweet|mention|say |post |gta|album|movie/i;

export async function getPoliticalMarkets() {
  return cached('political-markets', 5 * MINUTE, async () => {
    const seen = new Set();
    const groups = await Promise.all(TOPICS.map(async (topic) => {
      try {
        const url = `https://gamma-api.polymarket.com/events?closed=false&active=true&tag_slug=${topic.tag}&order=volume24hr&ascending=false&limit=12`;
        return { topic, events: await getJson(url) };
      } catch (err) {
        console.error(`Prediction markets (${topic.tag}) failed:`, err.message);
        return { topic, events: [] };
      }
    }));

    return groups.map(({ topic, events }) => ({
      id: topic.id,
      label: topic.label,
      markets: (Array.isArray(events) ? events : [])
        .filter((e) => !NOISE.test(e.title) && !seen.has(e.id) && seen.add(e.id))
        .map((e) => {
          const summary = summarize(e);
          return summary && { ...summary, closes: e.endDate ? String(e.endDate).slice(0, 10) : null };
        })
        .filter(Boolean)
        .slice(0, 8),
    })).filter((group) => group.markets.length > 0);
  });
}
