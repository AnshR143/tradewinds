// Every plane in the air right now, from the OpenSky Network. No key.
// OpenSky allows about 100 whole-world lookups a day without an account, so one snapshot is
// kept for 15 minutes and shared by everyone.
import { cached, getJson, MINUTE } from '@/lib/http';
import { distanceKm, NAUTICAL_REACH_KM } from '@/lib/geo';

const URL = 'https://opensky-network.org/api/states/all';
let lastGood = null;
let failedAt = 0;

async function load() {
  const data = await getJson(URL, { timeoutMs: 25000 });
  const planes = [];
  for (const s of data.states || []) {
    // s[8] is "on the ground". Positions are [5] longitude and [6] latitude; [10] is the heading.
    if (s[8] || s[5] === null || s[6] === null) continue;
    planes.push([Math.round(s[5] * 1000) / 1000, Math.round(s[6] * 1000) / 1000, Math.round(s[10] || 0), String(s[1] || '').trim()]);
  }
  lastGood = { asOf: new Date(data.time * 1000).toISOString(), planes, live: true };
  return lastGood;
}

// Returns { asOf, planes: [[lon, lat, heading, callsign]], live }. Never throws: when the
// feed is down it returns the last snapshot it has, marked as not live.
export async function getPlanes() {
  // After a failure, wait two minutes before asking again, so a broken feed is not hammered.
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

// How many planes are within 460 km of a point, and how many are in the ring from 460 to
// 920 km around it. The ring has three times the area, so an even sky would put three
// times as many planes in it.
export function planesNear(planes, lat, lon) {
  let inside = 0;
  let ring = 0;
  for (const [pLon, pLat] of planes) {
    // A quick check first: skip planes more than about 9 degrees of latitude away.
    if (Math.abs(pLat - lat) > 9) continue;
    const km = distanceKm(lat, lon, pLat, pLon);
    if (km <= NAUTICAL_REACH_KM) inside += 1;
    else if (km <= NAUTICAL_REACH_KM * 2) ring += 1;
  }
  return { inside, ring };
}
