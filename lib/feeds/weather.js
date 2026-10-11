// US weather alerts from the National Weather Service. No key needed.
import { cached, getJson, MINUTE } from '@/lib/http';
import { scenarioForAlert } from '@/lib/rules';
import { US_STATES } from '@/data/places';

const URL = 'https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe';

// Alerts that are too local or too short-lived to move supply chains.
const IGNORE = new Set([
  'Special Marine Warning',
  'Severe Thunderstorm Warning',
  'Tornado Warning',
  'Marine Weather Statement',
  'Rip Current Statement',
  'Beach Hazards Statement',
]);

// Shown first when present, in this order.
const PRIORITY = [
  'Hurricane Warning',
  'Storm Surge Warning',
  'Hurricane Watch',
  'Tropical Storm Warning',
  'Tropical Storm Watch',
  'Blizzard Warning',
  'Ice Storm Warning',
  'Winter Storm Warning',
  'Flash Flood Warning',
  'Flood Warning',
  'High Wind Warning',
  'Red Flag Warning',
  'Freeze Warning',
];

const STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'Washington DC', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii',
  ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', PR: 'Puerto Rico', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

function statesOf(alert) {
  const codes = alert.properties.geocode?.UGC || [];
  return codes.map((code) => STATES[code.slice(0, 2)]).filter(Boolean);
}

// Many alerts of the same kind (20 separate flood warnings) become one line.
function groupByEvent(alerts) {
  const groups = new Map();
  for (const alert of alerts) {
    const p = alert.properties;
    const minorWatch = p.event.endsWith('Watch') && !PRIORITY.includes(p.event);
    if (IGNORE.has(p.event) || minorWatch) continue;
    const group = groups.get(p.event) || { event: p.event, count: 0, states: new Set(), started: p.effective };
    group.count += 1;
    statesOf(alert).forEach((s) => group.states.add(s));
    if (p.effective < group.started) group.started = p.effective;
    groups.set(p.event, group);
  }
  return [...groups.values()];
}

function rank(group) {
  const i = PRIORITY.indexOf(group.event);
  return i === -1 ? PRIORITY.length : i;
}

export async function getWeatherSignals() {
  return cached('weather', 5 * MINUTE, async () => {
    const data = await getJson(URL, { headers: { Accept: 'application/geo+json' } });
    const groups = groupByEvent(data.features || []);
    groups.sort((a, b) => rank(a) - rank(b) || b.count - a.count);

    return groups.slice(0, 4).map((g) => {
      const states = [...g.states].sort();
      const extra = states.length - 4;
      const where = extra > 0 ? `${states.slice(0, 4).join(', ')} and ${extra} more ${extra === 1 ? 'state' : 'states'}` : states.join(', ');
      return {
        id: `nws-${g.event}`,
        kind: 'weather',
        source: 'US National Weather Service',
        title: g.event,
        where: where || 'United States',
        time: g.started,
        detail: `${g.count} active ${g.count === 1 ? 'alert' : 'alerts'}`,
        count: g.count,
        near: [],
        // Shown on the globe at the middle of the first state it covers.
        lat: US_STATES[states[0]]?.[0] ?? 39.8,
        lon: US_STATES[states[0]]?.[1] ?? -98.6,
        region: 'North America',
        scenario: scenarioForAlert(g.event),
        prompt: `${g.event} in effect for ${where || 'parts of the United States'} (${g.count} active alerts from the US National Weather Service).`,
      };
    });
  });
}
