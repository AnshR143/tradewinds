// Ships passing through the world's choke points each day, from the IMF's PortWatch. No key.
// PortWatch counts ships from their tracking signals and publishes about a week behind, so
// this shows disruptions that last, not what happened this morning.
import { cached, getJson, MINUTE } from '@/lib/http';
import { readFeed, saveFeed } from '@/lib/store';

const BASE = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services';
const DAY = 24 * 60 * MINUTE;
const RECENT_DAYS = 7;
const USUAL_DAYS = 56;

async function query(service, params) {
  const search = new URLSearchParams({ f: 'json', returnGeometry: 'false', ...params });
  const data = await getJson(`${BASE}/${service}/FeatureServer/0/query?${search}`, { timeoutMs: 30000 });
  if (data.error) throw new Error(data.error.message || 'PortWatch refused the request');
  return data;
}

const dayOf = (value) => (typeof value === 'number' ? new Date(value).toISOString().slice(0, 10) : String(value).slice(0, 10));
const average = (list) => (list.length ? list.reduce((sum, n) => sum + n, 0) / list.length : 0);

async function load() {
  const places = (await query('PortWatch_chokepoints_database', { where: '1=1', outFields: 'portid,portname,lat,lon,vessel_count_total' })).features.map((f) => f.attributes);

  const since = new Date(Date.now() - (RECENT_DAYS + USUAL_DAYS + 14) * DAY).toISOString().slice(0, 10);
  const rows = [];
  // The service hands back 1,000 rows at a time.
  for (let page = 0; page < 8; page++) {
    const data = await query('Daily_Chokepoints_Data', {
      where: `date >= TIMESTAMP '${since} 00:00:00'`,
      outFields: 'date,portid,n_total,n_tanker,n_container',
      orderByFields: 'date ASC',
      resultOffset: String(rows.length),
      resultRecordCount: '1000',
    });
    rows.push(...data.features.map((f) => f.attributes));
    if (!data.exceededTransferLimit || !data.features.length) break;
  }
  if (!rows.length) throw new Error('PortWatch returned no ship counts');

  const latest = rows.map((r) => dayOf(r.date)).sort().pop();
  const points = places.map((place) => {
    const days = rows.filter((r) => r.portid === place.portid).sort((a, b) => (dayOf(a.date) < dayOf(b.date) ? -1 : 1));
    const recent = days.slice(-RECENT_DAYS);
    const before = days.slice(-(RECENT_DAYS + USUAL_DAYS), -RECENT_DAYS);
    const perDay = average(recent.map((d) => d.n_total));
    const usual = average(before.map((d) => d.n_total));
    return {
      id: place.portid,
      name: place.portname,
      lat: place.lat,
      lon: place.lon,
      perDay: Math.round(perDay * 10) / 10,
      usual: Math.round(usual * 10) / 10,
      // How far the past week is from the two months before it, as a percentage.
      changePct: usual > 0 ? Math.round(((perDay - usual) / usual) * 100) : 0,
      // PortWatch also publishes a yearly count for each choke point. Spread over 365 days
      // it shows what a typical year looks like, which catches disruptions that have gone
      // on for longer than two months.
      typical: Math.round(((place.vessel_count_total || 0) / 365) * 10) / 10,
      tankers: Math.round(average(recent.map((d) => d.n_tanker)) * 10) / 10,
      containers: Math.round(average(recent.map((d) => d.n_container)) * 10) / 10,
      series: days.slice(-(RECENT_DAYS + USUAL_DAYS)).map((d) => d.n_total),
    };
  }).filter((p) => p.series.length >= RECENT_DAYS * 2).map((p) => ({
    ...p,
    typicalPct: p.typical > 0 ? Math.round(((p.perDay - p.typical) / p.typical) * 100) : 0,
  }));

  const result = { asOf: latest, points };
  saveFeed('ship-traffic', result);
  return result;
}

// Returns { asOf: 'YYYY-MM-DD', points: [...] }. Falls back to the last copy saved in Tiger
// Data when PortWatch is down, and to nothing when there is no copy.
export async function getShipTraffic() {
  try {
    return await cached('ship-traffic', 6 * 60 * MINUTE, load);
  } catch (err) {
    console.error('Ship traffic feed failed:', err.message);
    const saved = await readFeed('ship-traffic');
    return saved?.payload || { asOf: null, points: [] };
  }
}
