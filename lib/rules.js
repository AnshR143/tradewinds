// Fixed rules that turn a physical signal into a scenario from the impact map, and flag
// any supply-chain choke points close to it. No AI is involved in this step.
import { CHOKEPOINTS, NEAR_KM } from '@/data/chokepoints';

const EARTH_RADIUS_KM = 6371;

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// The closest choke points to a location, nearest first.
export function nearbyChokepoints(lat, lon, limit = 2) {
  return CHOKEPOINTS
    .map((point) => ({ name: point.name, why: point.why, lat: point.lat, lon: point.lon, km: Math.round(distanceKm(lat, lon, point.lat, point.lon) / 10) * 10 }))
    .filter((point) => point.km <= NEAR_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

export function describeNearby(near) {
  if (!near.length) return '';
  return ` It is about ${near.map((p) => `${p.km} km from the ${p.name} (${p.why})`).join(' and ')}.`;
}

export function scenarioForStorm(lat, lon) {
  if (lat < 5 || lat > 48) return null;
  if (lon >= -100 && lon <= -60) return 'us-hurricane';
  if (lon >= -125 && lon < -100 && lat <= 32) return 'mexico-pacific-hurricane';
  if (lon >= 100 && lon <= 150) return 'asia-typhoon';
  return null;
}

export function scenarioForWildfire(lat, lon) {
  const westernUS = lat >= 31 && lat <= 49 && lon >= -125 && lon <= -102;
  return westernUS ? 'western-wildfire' : null;
}

const ALERT_RULES = [
  [/hurricane|tropical storm|storm surge/i, 'us-hurricane'],
  [/winter storm|blizzard|ice storm/i, 'winter-storm'],
  [/flood/i, 'inland-flood'],
  [/red flag/i, 'western-wildfire'],
  [/freeze|heat/i, 'crop-weather'],
];

export function scenarioForAlert(eventName) {
  const rule = ALERT_RULES.find(([pattern]) => pattern.test(eventName));
  return rule ? rule[1] : null;
}
