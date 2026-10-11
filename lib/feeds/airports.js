// Delays at US airports right now, from the FAA's airport status feed. No key.
// The FAA gives its own reason for each delay, which is the "why" we show.
import { cached, MINUTE } from '@/lib/http';

const URL = 'https://nasstatus.faa.gov/api/airport-status-information';

// Where the busiest US airports are. Airports not listed still show in the list, without a dot.
const AIRPORTS = {
  ATL: ['Atlanta', 33.64, -84.43], LAX: ['Los Angeles', 33.94, -118.41], ORD: ['Chicago O’Hare', 41.98, -87.9], DFW: ['Dallas Fort Worth', 32.9, -97.04],
  DEN: ['Denver', 39.86, -104.67], JFK: ['New York JFK', 40.64, -73.78], SFO: ['San Francisco', 37.62, -122.38], SEA: ['Seattle', 47.45, -122.31],
  LAS: ['Las Vegas', 36.08, -115.15], MCO: ['Orlando', 28.43, -81.31], EWR: ['Newark', 40.69, -74.17], CLT: ['Charlotte', 35.21, -80.94],
  PHX: ['Phoenix', 33.43, -112.01], IAH: ['Houston', 29.98, -95.34], MIA: ['Miami', 25.79, -80.29], BOS: ['Boston', 42.36, -71.01],
  MSP: ['Minneapolis', 44.88, -93.22], FLL: ['Fort Lauderdale', 26.07, -80.15], DTW: ['Detroit', 42.21, -83.35], PHL: ['Philadelphia', 39.87, -75.24],
  LGA: ['New York LaGuardia', 40.78, -73.87], BWI: ['Baltimore', 39.18, -76.67], SLC: ['Salt Lake City', 40.79, -111.98], SAN: ['San Diego', 32.73, -117.19],
  IAD: ['Washington Dulles', 38.95, -77.46], DCA: ['Washington National', 38.85, -77.04], MDW: ['Chicago Midway', 41.79, -87.75], TPA: ['Tampa', 27.98, -82.53],
  PDX: ['Portland', 45.59, -122.6], HNL: ['Honolulu', 21.32, -157.92], STL: ['St. Louis', 38.75, -90.37], BNA: ['Nashville', 36.12, -86.68],
  AUS: ['Austin', 30.19, -97.67], HOU: ['Houston Hobby', 29.65, -95.28], OAK: ['Oakland', 37.72, -122.22], MSY: ['New Orleans', 29.99, -90.26],
  RDU: ['Raleigh-Durham', 35.88, -78.79], SJC: ['San Jose', 37.36, -121.93], SNA: ['Orange County', 33.68, -117.87], DAL: ['Dallas Love Field', 32.85, -96.85],
  SMF: ['Sacramento', 38.7, -121.59], SAT: ['San Antonio', 29.53, -98.47], RSW: ['Fort Myers', 26.54, -81.76], PIT: ['Pittsburgh', 40.49, -80.23],
  CLE: ['Cleveland', 41.41, -81.85], IND: ['Indianapolis', 39.72, -86.29], CMH: ['Columbus', 40.0, -82.89], CVG: ['Cincinnati', 39.05, -84.67],
  MCI: ['Kansas City', 39.3, -94.71], MEM: ['Memphis', 35.04, -89.98], JAX: ['Jacksonville', 30.49, -81.69], PBI: ['West Palm Beach', 26.68, -80.1],
  ANC: ['Anchorage', 61.17, -150.0], SJU: ['San Juan', 18.44, -66.0], TEB: ['Teterboro', 40.85, -74.06], BUR: ['Burbank', 34.2, -118.36],
};

// The FAA's short codes, in plain words.
function plainReason(raw) {
  const text = String(raw || '').trim();
  const [code, rest = ''] = text.split(':');
  const detail = rest.replace(/\s+/g, ' ').trim().toLowerCase();
  const KINDS = { WX: 'Weather', VOL: 'Too many flights at once', RWY: 'Runway work or a closed runway', EQ: 'Equipment trouble', STAFF: 'Not enough air traffic controllers', 'TM INITIATIVES': 'Traffic being spaced out' };
  const kind = KINDS[code.trim().toUpperCase()];
  if (kind) return detail ? `${kind} (${detail})` : kind;
  if (!text || /^other$/i.test(text)) return 'The FAA gave no reason';
  return text.slice(0, 120);
}

const field = (block, tag) => (block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`)) || [])[1]?.trim() || '';
const blocks = (xml, tag) => xml.match(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g')) || [];

async function load() {
  const res = await fetch(URL, { signal: AbortSignal.timeout(15000), cache: 'no-store', headers: { Accept: 'application/xml' } });
  if (!res.ok) throw new Error(`${res.status} from the FAA`);
  const xml = await res.text();
  const found = [];
  const add = (block, kind, detail) => {
    const code = field(block, 'ARPT');
    if (!code) return;
    const place = AIRPORTS[code];
    found.push({ id: `${code}-${kind}`, code, name: place?.[0] || code, lat: place?.[1] ?? null, lon: place?.[2] ?? null, kind, detail, reason: plainReason(field(block, 'Reason')) });
  };
  for (const b of blocks(xml, 'Program')) add(b, 'Ground stop', `flights held until ${field(b, 'End_Time') || 'further notice'}`);
  for (const b of blocks(xml, 'Ground_Delay')) add(b, 'Ground delay', `average wait ${field(b, 'Avg') || 'not given'}`);
  for (const b of blocks(xml, 'Delay')) {
    const way = (b.match(/Arrival_Departure Type="([^"]+)"/) || [])[1] || 'Flight';
    add(b, `${way} delays`, `${field(b, 'Min')} to ${field(b, 'Max')}${field(b, 'Trend') ? `, ${field(b, 'Trend').toLowerCase()}` : ''}`);
  }
  // "Airport closures" in this feed are mostly notices about private planes, not real
  // closures, so they are left out.
  return { asOf: new Date().toISOString(), airports: found };
}

export async function getAirportDelays() {
  try {
    return await cached('airport-delays', 5 * MINUTE, load);
  } catch (err) {
    console.error('Airport delay feed failed:', err.message);
    return { asOf: null, airports: [] };
  }
}
