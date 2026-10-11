import { getEonetSignals } from '@/lib/feeds/eonet';
import { getWeatherSignals } from '@/lib/feeds/weather';
import { getPlanes, planesNear } from '@/lib/feeds/planes';
import { getShipTraffic } from '@/lib/feeds/ships';
import { getAirportDelays } from '@/lib/feeds/airports';
import { readPlaneHistory, savePlaneCounts } from '@/lib/store';
import { distanceKm, NAUTICAL_REACH_KM } from '@/lib/geo';
import { NEAR_KM } from '@/data/chokepoints';
import { cached, MINUTE } from '@/lib/http';
import { getLatestNews } from '@/lib/news';

const NEWS_WORDS = {
  'Strait of Hormuz': ['Hormuz', 'Iran', 'Persian Gulf'],
  'Bab el-Mandeb Strait': ['Bab el-Mandeb', 'Red Sea', 'Houthi', 'Yemen'],
  'Suez Canal': ['Suez', 'Red Sea', 'Houthi'],
  'Bosporus Strait': ['Bosporus', 'Black Sea', 'Russo-Ukrainian', 'Ukrain'],
  'Kerch Strait': ['Kerch', 'Crimea', 'Black Sea', 'Russo-Ukrainian', 'Ukrain'],
  'Panama Canal': ['Panama'],
  'Taiwan Strait': ['Taiwan Strait', 'Taiwan'],
  'Malacca Strait': ['Malacca'],
  'Gibraltar Strait': ['Gibraltar'],
  'Korea Strait': ['Korea Strait'],
};

function newsAbout(news, name) {
  const words = NEWS_WORDS[name];
  if (!words) return null;
  const pattern = new RegExp(`\\b(${words.join('|')})`, 'i');
  const item = news.find((n) => pattern.test(`${n.topic || ''} ${n.text}`));
  if (!item) return null;
  const headline = item.topic ? `${item.topic}: ${item.text}` : item.text;
  return headline.length > 150 ? `${headline.slice(0, 147).trimEnd()}...` : headline;
}

const SHIP_CHANGE_PCT = 20;
const SHIP_TYPICAL_PCT = 35;
const SHIP_MIN_PER_DAY = 5;
let lastSaved = '';

function nearestEvent(events, lat, lon, withinKm) {
  let best = null;
  for (const e of events) {
    const km = distanceKm(lat, lon, e.lat, e.lon);
    if (km <= withinKm && (!best || km < best.km)) best = { title: e.title, km: Math.round(km / 10) * 10 };
  }
  return best;
}

async function build() {
  const [nasa, weather, snapshot, ships, faa, history, news] = await Promise.all([
    getEonetSignals().catch(() => ({ signals: [] })),
    getWeatherSignals().catch(() => []),
    getPlanes(),
    getShipTraffic(),
    getAirportDelays(),
    readPlaneHistory(),
    getLatestNews().catch(() => []),
  ]);
  const events = [...nasa.signals, ...weather].filter((s) => typeof s.lat === 'number' && typeof s.lon === 'number');
  const storms = events.filter((s) => s.kind === 'storm' || s.kind === 'volcano');
  const findings = [];

  const redSea = ships.points.filter((p) => ['Bab el-Mandeb Strait', 'Suez Canal'].includes(p.name)).sort((a, b) => a.typicalPct - b.typicalPct)[0];
  for (const point of ships.points) {
    const recent = point.usual >= SHIP_MIN_PER_DAY && Math.abs(point.changePct) >= SHIP_CHANGE_PCT;
    const lasting = point.typical >= SHIP_MIN_PER_DAY && Math.abs(point.typicalPct) >= SHIP_TYPICAL_PCT;
    if (!recent && !lasting) continue;
    const useTypical = lasting && (!recent || Math.abs(point.typicalPct) > Math.abs(point.changePct));
    const pct = useTypical ? point.typicalPct : point.changePct;
    const down = pct < 0;

    const near = nearestEvent(events, point.lat, point.lon, NEAR_KM);
    const story = newsAbout(news, point.name);
    let reason = useTypical
      ? 'No storm or news story we track explains it. A gap this old started before the news we read.'
      : 'No storm, alert or news story we track explains it. The cause may be seasonal.';
    if (near) reason = `${near.title} is ${near.km} km away.`;
    else if (point.name === 'Cape of Good Hope' && !down && redSea && redSea.typicalPct <= -SHIP_CHANGE_PCT) {
      reason = `Traffic through the ${redSea.name} is down ${Math.abs(redSea.typicalPct)}%. Ships that avoid the Red Sea go around Africa instead, past this cape.`;
    } else if (story) reason = `In the news: ${story}`;

    findings.push({
      id: `ships-${point.id}`,
      kind: 'ships',
      ref: point.id,
      lat: point.lat,
      lon: point.lon,
      size: Math.abs(pct),
      title: `${point.name}: ship traffic ${down ? 'down' : 'up'} ${Math.abs(pct)}% ${useTypical ? 'from a typical year' : 'in a week'}`,
      text: `${point.perDay} ships a day over the past week. The two months before: ${point.usual} a day. A typical year: ${point.typical} a day.`,
      reason,
      prompt: down ? `Ship traffic through the ${point.name} is down ${Math.abs(pct)}% ${useTypical ? 'from a typical year' : 'compared with the past two months'}` : null,
      scenario: down ? 'shipping-blocked' : null,
    });
  }

  const counts = [];
  if (snapshot.planes.length) {
    for (const storm of storms) {
      const { inside, ring } = planesNear(snapshot.planes, storm.lat, storm.lon);
      counts.push({ id: storm.id, title: storm.title, lat: storm.lat, lon: storm.lon, inside, ring });
      const even = ring / 3;
      const past = history.get(storm.id);
      const thin = ring >= 15 && inside < even * 0.5;
      const fewerThanEarlier = past && past.looks >= 3 && past.average >= 6 && inside < past.average * 0.6;
      if (!thin && !fewerThanEarlier) continue;
      findings.push({
        id: `planes-${storm.id}`,
        kind: 'planes',
        ref: storm.id,
        lat: storm.lat,
        lon: storm.lon,
        size: even > 0 ? Math.round((1 - inside / even) * 100) : 0,
        title: `${storm.title}: few planes nearby`,
        text: `${inside} ${inside === 1 ? 'plane' : 'planes'} within ${NAUTICAL_REACH_KM} km right now. The ring of sky around that holds ${ring}, which would be about ${Math.round(even)} here if they were spread evenly.`
          + (past && past.looks >= 3 ? ` Earlier today it averaged ${Math.round(past.average)}.` : ''),
        reason: 'Planes fly around strong storms. Open ocean also has fewer flights, so part of this gap is normal.',
        prompt: null,
        scenario: null,
      });
    }
    if (snapshot.live && snapshot.asOf !== lastSaved) {
      lastSaved = snapshot.asOf;
      savePlaneCounts(snapshot.asOf, counts);
    }
  }

  for (const airport of faa.airports) {
    findings.push({
      id: `airport-${airport.id}`,
      kind: 'airport',
      ref: airport.id,
      lat: airport.lat,
      lon: airport.lon,
      size: airport.kind === 'Ground stop' ? 90 : airport.kind === 'Ground delay' ? 60 : 30,
      title: `${airport.name} (${airport.code}): ${airport.kind.toLowerCase()}`,
      text: `${airport.kind}, ${airport.detail}.`,
      reason: `${airport.reason}.`,
      prompt: `${airport.name} airport has a ${airport.kind.toLowerCase()} (${airport.detail}). The FAA's reason: ${airport.reason}`,
      scenario: null,
    });
  }

  findings.sort((a, b) => b.size - a.size);
  return {
    findings,
    ships: { asOf: ships.asOf, points: ships.points },
    airports: faa.airports,
    planes: { asOf: snapshot.asOf, live: snapshot.live, total: snapshot.planes.length, nearStorms: counts },
  };
}

export function getPatterns() {
  return cached('patterns', 5 * MINUTE, build);
}
