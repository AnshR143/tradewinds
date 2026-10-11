import { cached, getJson, MINUTE } from '@/lib/http';
import { distanceKm, NAUTICAL_REACH_KM } from '@/lib/geo';

const URL = 'https://opensky-network.org/api/states/all';
let lastGood = null;
let failedAt = 0;

async function load() {
  const data = await getJson(URL, { timeoutMs: 25000 });
  const planes = [];
  for (const s of data.states || []) {
    if (s[8] || s[5] === null || s[6] === null) continue;
    planes.push([Math.round(s[5] * 1000) / 1000, Math.round(s[6] * 1000) / 1000, Math.round(s[10] || 0), String(s[1] || '').trim()]);
  }
  lastGood = { asOf: new Date(data.time * 1000).toISOString(), planes, live: true };
  return lastGood;
}

export async function getPlanes() {
  if (Date.now() - failedAt > 2 * MINUTE) {
    try {
      return await cached('planes', 15 * MINUTE, load);
    } catch (err) {
      failedAt = Date.now();
      console.error('Plane feed failed:', err.message);
    }
  }
  return lastGood ? { ...lastGood, live: false } : { asOf: null, planes: [], live: false };
}

export function planesNear(planes, lat, lon) {
  let inside = 0;
  let ring = 0;
  for (const [pLon, pLat] of planes) {
    if (Math.abs(pLat - lat) > 9) continue;
    const km = distanceKm(lat, lon, pLat, pLon);
    if (km <= NAUTICAL_REACH_KM) inside += 1;
    else if (km <= NAUTICAL_REACH_KM * 2) ring += 1;
  }
  return { inside, ring };
}
