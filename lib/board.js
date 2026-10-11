// The signal board: every company on the impact map that an event happening right now
// touches, and which way. It is built from the fixed rules and the map, with no AI.
import { SCENARIOS } from '@/data/impact-graph';
import { getEonetSignals } from '@/lib/feeds/eonet';
import { getWeatherSignals } from '@/lib/feeds/weather';
import { getCommoditySignals } from '@/lib/feeds/commodities';
import { getPriceMove } from '@/lib/prices';
import { cached, MINUTE } from '@/lib/http';
import { eventStrength, scoreSignal } from '@/lib/score';
import { getAnalystView } from '@/lib/analysts';

const STRENGTH = { strong: 3, likely: 2, guess: 1 };

async function build() {
  const [nasa, weather, prices] = await Promise.all([
    getEonetSignals().catch(() => ({ signals: [] })),
    getWeatherSignals().catch(() => []),
    getCommoditySignals().catch(() => []),
  ]);
  const live = [...nasa.signals, ...weather, ...prices].filter((s) => s.scenario);

  const byTicker = new Map();
  const mixed = new Set();
  for (const event of live) {
    const scenario = SCENARIOS.find((s) => s.id === event.scenario);
    for (const link of scenario?.links || []) {
      for (const company of link.companies) {
        const seen = byTicker.get(company.ticker);
        if (!seen) {
          byTicker.set(company.ticker, {
            ticker: company.ticker,
            name: company.name,
            type: company.type || 'stock',
            direction: link.direction,
            confidence: link.confidence,
            horizon: link.horizon,
            chain: link.chain,
            wrongIf: link.wrongIf,
            scenario: scenario.label,
            scenarioId: scenario.id,
            events: [event.title],
            strength: eventStrength(event),
          });
        } else if (seen.direction !== link.direction) {
          // One event helps this company and another hurts it. We do not call that either way.
          mixed.add(company.ticker);
        } else {
          if (!seen.events.includes(event.title)) seen.events.push(event.title);
          seen.strength = Math.max(seen.strength, eventStrength(event));
          if (STRENGTH[link.confidence] > STRENGTH[seen.confidence]) seen.confidence = link.confidence;
        }
      }
    }
  }

  const entries = [...byTicker.values()].filter((e) => !mixed.has(e.ticker));
  const priced = await Promise.all(entries.map(async (e) => {
    const price = await getPriceMove(e.ticker);
    const analysts = await getAnalystView(e.ticker).catch(() => null);
    const score = scoreSignal({ direction: e.direction, confidence: e.confidence, events: e.events.length, strength: e.strength, price, analysts });
    return { ...e, price, analysts, score };
  }));
  // Strongest score first.
  priced.sort((a, b) => Math.abs(b.score.value) - Math.abs(a.score.value) || a.name.localeCompare(b.name));

  return {
    bullish: priced.filter((e) => e.direction === 'tailwind'),
    bearish: priced.filter((e) => e.direction === 'headwind'),
  };
}

// "Hurricane Isaias, Flood Warning and 2 more"
export function listEvents(events) {
  if (events.length <= 2) return events.join(' and ');
  return `${events.slice(0, 2).join(', ')} and ${events.length - 2} more`;
}

export function signalBoard() {
  return cached('signal-board', 5 * MINUTE, build);
}
