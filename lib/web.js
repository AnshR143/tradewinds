// The web drawn on the big map: each event happening now, and a line from it to every place
// it touches. Places are the head offices of the companies on our impact map, plus the ports
// and hubs within reach of the event. No AI is used here except to match news to the map,
// which /api/news-stocks has already done.
import { SCENARIOS } from '@/data/impact-graph';
import { COMPANY_PLACES } from '@/data/company-places';

function touchesOfScenario(id) {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) return [];
  return scenario.links.flatMap((link) =>
    link.companies.map((c) => ({ ticker: c.ticker, name: c.name, direction: link.direction, why: link.chain[link.chain.length - 1] })),
  );
}

// signals: what /api/signals returned.  newsStocks: what /api/news-stocks returned, or null.
// scores: a Map of ticker to its signal score, where we have one.
export function buildWeb(signals, newsStocks, scores = new Map()) {
  const events = [];

  for (const s of signals?.sky || []) {
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') continue;
    events.push({ id: s.id, title: s.title, detail: `${s.where}. ${s.detail}.`, lat: s.lat, lon: s.lon, item: s, near: s.near || [], touches: touchesOfScenario(s.scenario) });
  }
  // A storm that is in the news is already on the map from the satellite feed.
  const drawn = new Set(events.map((e) => e.title.toLowerCase()));
  for (const n of signals?.news || []) {
    if (typeof n.lat !== 'number' || drawn.has(String(n.title).toLowerCase())) continue;
    const touches = (newsStocks?.stocks || [])
      .filter((stock) => stock.newsIds.includes(n.id))
      .map((stock) => ({ ticker: stock.ticker, name: stock.name, direction: stock.direction, why: stock.chain[stock.chain.length - 1] }));
    // News is only drawn when it points at a company, or the map would be all dots.
    if (!touches.length) continue;
    events.push({ id: n.id, title: n.title !== n.category ? n.title : n.text.slice(0, 60), detail: n.text, lat: n.lat, lon: n.lon, item: n, near: [], touches });
  }

  const lines = [];
  const places = new Map();
  for (const event of events) {
    // One line per place and direction, however many companies sit there.
    const groups = new Map();
    const seen = new Set();
    for (const touch of event.touches) {
      const place = COMPANY_PLACES[touch.ticker];
      if (!place || seen.has(touch.ticker)) continue;
      seen.add(touch.ticker);
      const company = { ...touch, city: place.city, score: scores.get(touch.ticker) || null, event: event.title, eventId: event.id };

      const key = `${place.city}|${touch.direction}`;
      if (!groups.has(key)) groups.set(key, { id: `${event.id}|${key}`, eventId: event.id, place: place.city, from: [event.lat, event.lon], to: [place.lat, place.lon], direction: touch.direction, companies: [] });
      groups.get(key).companies.push(company);

      if (!places.has(place.city)) places.set(place.city, { id: place.city, city: place.city, lat: place.lat, lon: place.lon, companies: [] });
      places.get(place.city).companies.push(company);
    }
    lines.push(...groups.values());
    event.companies = [...groups.values()].flatMap((g) => g.companies);
    event.placeCount = new Set([...groups.values()].map((g) => g.place)).size;
    for (const hub of event.near) {
      lines.push({ id: `${event.id}|hub|${hub.name}`, eventId: event.id, hub: hub.name, from: [event.lat, event.lon], to: [hub.lat, hub.lon], direction: 'hub', km: hub.km, why: hub.why });
    }
  }

  // Events with the most lines first.
  events.sort((a, b) => b.placeCount - a.placeCount || a.title.localeCompare(b.title));
  return { events, lines, places: [...places.values()] };
}

// A gently bent path between two points, as a list of [lat, lon]. `bend` sets how far it
// bows out and which way, so lines that share both ends do not sit on top of each other.
export function bentPath([lat1, lon1], [lat2, lon2], bend = 0.18) {
  // Go the short way round the world.
  if (lon2 - lon1 > 180) lon2 -= 360;
  else if (lon1 - lon2 > 180) lon2 += 360;
  const midLat = (lat1 + lat2) / 2 + (lon2 - lon1) * bend;
  const midLon = (lon1 + lon2) / 2 - (lat2 - lat1) * bend;
  const points = [];
  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    points.push([Math.max(-82, Math.min(82, a * lat1 + b * midLat + c * lat2)), a * lon1 + b * midLon + c * lon2]);
  }
  return points;
}
