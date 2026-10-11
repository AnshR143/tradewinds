// Natural events NASA tracks from satellites: storms, wildfires, volcanoes. No key needed.
import { getJson, MINUTE } from '@/lib/http';
import { readFeed, readStoredStorms, saveFeed } from '@/lib/store';
import { regionOf } from '@/data/places';
import { describeNearby, nearbyChokepoints, scenarioForStorm, scenarioForWildfire } from '@/lib/rules';

const URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=400';
const DAY = 24 * 60 * MINUTE;
const BIG_FIRE_ACRES = 50000;

function basin(lon, lat) {
  if (lat < 0) return lon > 20 && lon < 120 ? 'southern Indian Ocean' : 'South Pacific';
  if (lon >= -100 && lon <= -75 && lat < 31) return 'Gulf of Mexico and Caribbean';
  if (lon > -100 && lon < 0) return 'North Atlantic';
  if (lon <= -100) return 'eastern Pacific';
  if (lon >= 100) return 'western Pacific';
  return 'northern Indian Ocean';
}

function coords(lon, lat) {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}

// Wind arrives in knots. 64+ is hurricane strength, 96+ is a major hurricane.
function strength(knots) {
  const mph = Math.round(knots * 1.15);
  if (knots >= 96) return `major storm, ${mph} mph winds`;
  if (knots >= 64) return `hurricane strength, ${mph} mph winds`;
  if (knots >= 34) return `tropical storm strength, ${mph} mph winds`;
  return `weakened, ${mph} mph winds`;
}

function newest(event) {
  return event.geometry[event.geometry.length - 1];
}

function stormSignal({ id, title, time, lat, lon, power, windMph }) {
  const near = nearbyChokepoints(lat, lon);
  return {
    id,
    kind: 'storm',
    source: 'NASA satellite tracking',
    title,
    where: `${basin(lon, lat)} (${coords(lon, lat)})`,
    time,
    detail: power,
    windMph,
    near,
    lat,
    lon,
    region: regionOf(lat, lon),
    scenario: scenarioForStorm(lat, lon),
    prompt: `${title} is at ${coords(lon, lat)} in the ${basin(lon, lat)}: ${power} (NASA satellite tracking, last update ${String(time).slice(0, 10)}).${describeNearby(near)}`,
  };
}

// Rebuilds storms from our own saved records, for when NASA's feed is down and we have no
// full copy of its last answer. The saved place looks like "eastern Pacific (17.3°N, 104.8°W)".
async function stormsFromHistory() {
  const rows = await readStoredStorms();
  return rows
    .map((row) => {
      const place = row.place?.match(/\(([\d.]+)°([NS]), ([\d.]+)°([EW])\)/);
      if (!place) return null;
      const lat = Number(place[1]) * (place[2] === 'N' ? 1 : -1);
      const lon = Number(place[3]) * (place[4] === 'E' ? 1 : -1);
      const wind = row.detail?.match(/(\d+) mph/);
      return stormSignal({
        id: row.id,
        title: row.title,
        time: row.time.toISOString(),
        lat,
        lon,
        power: row.detail || 'strength not reported',
        windMph: wind ? Number(wind[1]) : null,
      });
    })
    .filter(Boolean)
    .sort((a, b) => (b.windMph || 0) - (a.windMph || 0));
}

function storms(events) {
  return events
    .filter((e) => e.categories[0].id === 'severeStorms')
    .filter((e) => Date.now() - new Date(newest(e).date) < 2 * DAY)
    .sort((a, b) => (newest(b).magnitudeValue || 0) - (newest(a).magnitudeValue || 0))
    .slice(0, 5)
    .map((e) => {
      const g = newest(e);
      const [lon, lat] = g.coordinates;
      const power = g.magnitudeValue ? strength(g.magnitudeValue) : 'strength not reported';
      const windMph = g.magnitudeValue ? Math.round(g.magnitudeValue * 1.15) : null;
      return stormSignal({ id: e.id, title: e.title, time: g.date, lat, lon, power, windMph });
    });
}

function fires(events) {
  return events
    .filter((e) => e.categories[0].id === 'wildfires' && (newest(e).magnitudeValue || 0) >= BIG_FIRE_ACRES)
    // Old fires stay listed as open for months, so only keep ones updated recently.
    .filter((e) => Date.now() - new Date(newest(e).date) < 14 * DAY)
    .sort((a, b) => newest(b).magnitudeValue - newest(a).magnitudeValue)
    .slice(0, 2)
    .map((e) => {
      const g = newest(e);
      const [lon, lat] = g.coordinates;
      const acres = Math.round(g.magnitudeValue).toLocaleString('en-US');
      const place = e.title.replace(/^(Wildfire|Incident Complex)\s+/i, '');
      const near = nearbyChokepoints(lat, lon, 1);
      return {
        id: e.id,
        kind: 'wildfire',
        source: 'NASA satellite tracking',
        title: `Wildfire: ${place}`,
        where: place,
        time: g.date,
        detail: `${acres} acres burned`,
        near,
        lat,
        lon,
        region: regionOf(lat, lon),
        scenario: scenarioForWildfire(lat, lon),
        prompt: `A large wildfire (${place}) has burned ${acres} acres (NASA satellite tracking, last update ${g.date.slice(0, 10)}).${describeNearby(near)}`,
      };
    });
}

function volcanoes(events) {
  return events
    .filter((e) => e.categories[0].id === 'volcanoes')
    .filter((e) => Date.now() - new Date(newest(e).date) < 14 * DAY)
    .slice(0, 2)
    .map((e) => {
      const g = newest(e);
      const [lon, lat] = g.coordinates;
      return {
        id: e.id,
        kind: 'volcano',
        source: 'NASA satellite tracking',
        title: e.title,
        where: e.title.replace(/ Volcano.*$/i, ''),
        time: g.date,
        detail: 'active eruption',
        near: [],
        lat,
        lon,
        region: regionOf(lat, lon),
        scenario: 'volcano-ash',
        prompt: `${e.title} is erupting (NASA satellite tracking, last update ${g.date.slice(0, 10)}).`,
      };
    });
}

// The newest answer we have: { signals, asOf, live }. `live` is false when NASA's feed
// failed and we are showing the last good copy.
let latest = null;
let checkedAt = 0;

async function fetchLive() {
  const data = await getJson(URL, { timeoutMs: 6000 });
  const events = (data.events || []).filter((e) => e.geometry?.length);
  return [...storms(events), ...volcanoes(events), ...fires(events)];
}

let refreshing = null;

async function refresh() {
  checkedAt = Date.now();
  try {
    const signals = await fetchLive();
    latest = { signals, asOf: new Date().toISOString(), live: true };
    saveFeed('eonet', signals);
  } catch (err) {
    console.error('NASA feed failed:', err.message);
    if (latest) {
      latest = { ...latest, live: false };
      return;
    }
    const saved = await readFeed('eonet');
    if (saved) {
      latest = { signals: saved.payload, asOf: saved.fetchedAt, live: false };
    } else {
      const rebuilt = await stormsFromHistory();
      const newestTime = rebuilt.map((s) => s.time).sort().pop() || null;
      latest = { signals: rebuilt, asOf: newestTime, live: false };
    }
  }
}

export async function getEonetSignals() {
  // Ask NASA again after 10 minutes, or after 1 minute if the last try failed.
  const wait = (latest?.live ? 10 : 1) * MINUTE;
  if (latest && Date.now() - checkedAt < wait) return latest;

  if (!refreshing) refreshing = refresh().finally(() => { refreshing = null; });
  // If we already have something to show, show it now and let the refresh finish in the
  // background. Only the very first request has to wait.
  if (!latest) await refreshing;
  return latest;
}
