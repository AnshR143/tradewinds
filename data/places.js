// Rough map positions used to put events on the globe and sort them by region.
// Positions are the middle of each country or US state, so a dot marks the country, not
// the exact spot.

export const REGIONS = ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania'];

// Where to turn the globe to show each region.
export const REGION_CENTERS = {
  'North America': { lat: 38, lon: -98 },
  'South America': { lat: -15, lon: -60 },
  Europe: { lat: 50, lon: 12 },
  Africa: { lat: 4, lon: 20 },
  Asia: { lat: 30, lon: 100 },
  Oceania: { lat: -24, lon: 140 },
};

// Which region a point on the map belongs to. Storms at sea count toward the nearest region.
export function regionOf(lat, lon) {
  if (lon < -30) return lat >= 7.5 ? 'North America' : 'South America';
  if (lon < 60) {
    if (lon >= 34 && lat >= 12 && lat < 42) return 'Asia'; // the Middle East
    return lat >= 36 ? 'Europe' : 'Africa';
  }
  if (lat < -10 && lon >= 110) return 'Oceania';
  return 'Asia';
}

export const US_STATES = {
  Alabama: [32.8, -86.8], Alaska: [64.2, -152.5], Arizona: [34.2, -111.7], Arkansas: [34.9, -92.4],
  California: [37.2, -119.4], Colorado: [39.0, -105.5], Connecticut: [41.6, -72.7], Delaware: [39.0, -75.5],
  'Washington DC': [38.9, -77.0], Florida: [28.6, -82.4], Georgia: [32.7, -83.4], Hawaii: [20.8, -156.3],
  Idaho: [44.4, -114.6], Illinois: [40.0, -89.2], Indiana: [39.9, -86.3], Iowa: [42.1, -93.5],
  Kansas: [38.5, -98.4], Kentucky: [37.5, -85.3], Louisiana: [31.1, -92.0], Maine: [45.4, -69.2],
  Maryland: [39.0, -76.8], Massachusetts: [42.3, -71.8], Michigan: [44.3, -85.4], Minnesota: [46.3, -94.3],
  Mississippi: [32.7, -89.7], Missouri: [38.4, -92.5], Montana: [47.0, -109.6], Nebraska: [41.5, -99.8],
  Nevada: [39.3, -116.6], 'New Hampshire': [43.7, -71.6], 'New Jersey': [40.2, -74.7], 'New Mexico': [34.4, -106.1],
  'New York': [42.9, -75.5], 'North Carolina': [35.6, -79.4], 'North Dakota': [47.5, -100.5], Ohio: [40.3, -82.8],
  Oklahoma: [35.6, -97.5], Oregon: [43.9, -120.6], Pennsylvania: [40.9, -77.8], 'Puerto Rico': [18.2, -66.4],
  'Rhode Island': [41.7, -71.5], 'South Carolina': [33.9, -80.9], 'South Dakota': [44.4, -100.2], Tennessee: [35.9, -86.4],
  Texas: [31.5, -99.3], Utah: [39.3, -111.7], Vermont: [44.1, -72.7], Virginia: [37.5, -78.9],
  Washington: [47.4, -120.5], 'West Virginia': [38.6, -80.6], Wisconsin: [44.6, -89.9], Wyoming: [43.0, -107.5],
};

// name, latitude, longitude, region. Names that are also common words or people's names
// (Chad, Jordan, Turkey, Georgia) are left out on purpose.
const COUNTRIES = [
  ['United States', 39.8, -98.6, 'North America'], ['Canada', 56.1, -106.3, 'North America'], ['Mexico', 23.6, -102.5, 'North America'],
  ['Cuba', 21.5, -79.0, 'North America'], ['Haiti', 19.0, -72.3, 'North America'], ['Guatemala', 15.8, -90.2, 'North America'],
  ['Honduras', 14.8, -86.6, 'North America'], ['Nicaragua', 12.9, -85.2, 'North America'], ['Panama', 8.5, -80.8, 'North America'],
  ['Costa Rica', 9.7, -84.0, 'North America'], ['El Salvador', 13.8, -88.9, 'North America'],
  ['Brazil', -10.3, -53.2, 'South America'], ['Argentina', -35.4, -65.2, 'South America'], ['Chile', -33.5, -70.7, 'South America'],
  ['Colombia', 4.1, -72.9, 'South America'], ['Venezuela', 7.1, -66.2, 'South America'], ['Peru', -9.2, -75.0, 'South America'],
  ['Ecuador', -1.4, -78.4, 'South America'], ['Bolivia', -16.7, -64.7, 'South America'],
  ['United Kingdom', 54.0, -2.5, 'Europe'], ['England', 52.6, -1.5, 'Europe'], ['Scotland', 56.8, -4.2, 'Europe'],
  ['Ireland', 53.2, -8.0, 'Europe'], ['France', 46.6, 2.4, 'Europe'], ['Germany', 51.1, 10.4, 'Europe'], ['Spain', 40.2, -3.6, 'Europe'],
  ['Portugal', 39.6, -8.0, 'Europe'], ['Italy', 42.8, 12.6, 'Europe'], ['Netherlands', 52.2, 5.5, 'Europe'], ['Belgium', 50.6, 4.6, 'Europe'],
  ['Switzerland', 46.8, 8.2, 'Europe'], ['Austria', 47.6, 14.1, 'Europe'], ['Poland', 52.1, 19.4, 'Europe'], ['Ukraine', 49.0, 31.4, 'Europe'],
  ['Russia', 56.0, 40.0, 'Europe'], ['Sweden', 62.0, 15.0, 'Europe'], ['Norway', 61.0, 9.0, 'Europe'], ['Finland', 64.0, 26.0, 'Europe'],
  ['Denmark', 56.0, 9.5, 'Europe'], ['Greece', 39.1, 22.9, 'Europe'], ['Hungary', 47.2, 19.4, 'Europe'], ['Romania', 45.9, 25.0, 'Europe'],
  ['Serbia', 44.2, 20.8, 'Europe'], ['Montenegro', 42.7, 19.3, 'Europe'], ['Czech Republic', 49.8, 15.5, 'Europe'], ['Belarus', 53.7, 27.9, 'Europe'],
  ['Egypt', 26.6, 30.2, 'Africa'], ['Libya', 27.0, 17.5, 'Africa'], ['Tunisia', 34.0, 9.6, 'Africa'], ['Algeria', 28.2, 2.6, 'Africa'],
  ['Morocco', 31.8, -6.3, 'Africa'], ['Sudan', 15.6, 30.2, 'Africa'], ['South Sudan', 7.3, 30.3, 'Africa'], ['Ethiopia', 9.1, 39.6, 'Africa'],
  ['Somalia', 5.2, 46.2, 'Africa'], ['Kenya', 0.5, 37.9, 'Africa'], ['Tanzania', -6.4, 34.9, 'Africa'], ['Uganda', 1.3, 32.4, 'Africa'],
  ['Nigeria', 9.1, 8.1, 'Africa'], ['Ghana', 7.9, -1.2, 'Africa'], ['Mali', 17.4, -4.0, 'Africa'], ['Senegal', 14.4, -14.5, 'Africa'],
  ['Democratic Republic of the Congo', -2.9, 23.7, 'Africa'], ['Congo', -2.9, 23.7, 'Africa'], ['Angola', -12.3, 17.5, 'Africa'],
  ['Mozambique', -18.2, 35.5, 'Africa'], ['Zimbabwe', -19.0, 29.9, 'Africa'], ['South Africa', -29.0, 25.1, 'Africa'], ['Madagascar', -19.4, 46.7, 'Africa'],
  ['Israel', 31.4, 35.0, 'Asia'], ['Palestine', 31.9, 35.2, 'Asia'], ['Gaza', 31.4, 34.4, 'Asia'], ['Lebanon', 33.9, 35.9, 'Asia'],
  ['Syria', 35.0, 38.5, 'Asia'], ['Iraq', 33.0, 43.7, 'Asia'], ['Iran', 32.6, 54.3, 'Asia'], ['Saudi Arabia', 24.0, 45.0, 'Asia'],
  ['Yemen', 15.9, 47.6, 'Asia'], ['Qatar', 25.3, 51.2, 'Asia'], ['United Arab Emirates', 24.0, 54.0, 'Asia'], ['Kuwait', 29.3, 47.6, 'Asia'],
  ['Afghanistan', 33.8, 66.0, 'Asia'], ['Pakistan', 30.0, 69.4, 'Asia'], ['India', 22.9, 79.6, 'Asia'], ['Bangladesh', 23.8, 90.3, 'Asia'],
  ['Sri Lanka', 7.6, 80.7, 'Asia'], ['Nepal', 28.3, 84.0, 'Asia'], ['Myanmar', 21.2, 96.5, 'Asia'], ['Thailand', 15.1, 101.0, 'Asia'],
  ['Vietnam', 16.6, 106.3, 'Asia'], ['Cambodia', 12.7, 104.9, 'Asia'], ['Malaysia', 3.8, 102.2, 'Asia'], ['Singapore', 1.35, 103.8, 'Asia'],
  ['Indonesia', -2.2, 117.3, 'Asia'], ['Philippines', 12.8, 122.9, 'Asia'], ['China', 35.0, 103.8, 'Asia'], ['Taiwan', 23.7, 121.0, 'Asia'],
  ['Hong Kong', 22.3, 114.2, 'Asia'], ['Japan', 36.5, 138.3, 'Asia'], ['South Korea', 36.4, 127.8, 'Asia'], ['North Korea', 40.1, 127.2, 'Asia'],
  ['Mongolia', 46.8, 103.1, 'Asia'], ['Kazakhstan', 48.2, 67.3, 'Asia'], ['Uzbekistan', 41.8, 63.1, 'Asia'],
  ['Australia', -25.7, 134.5, 'Oceania'], ['New Zealand', -41.8, 172.8, 'Oceania'], ['Papua New Guinea', -6.5, 145.3, 'Oceania'], ['Fiji', -17.8, 178.0, 'Oceania'],
];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every place we can recognize in a sentence, longest names first so "South Sudan" wins
// over "Sudan".
const PLACES = [
  ...COUNTRIES.map(([name, lat, lon, region]) => ({ name, lat, lon, region })),
  ...Object.entries(US_STATES).map(([name, [lat, lon]]) => ({ name, lat, lon, region: 'North America' })),
]
  .filter((place) => place.name !== 'Georgia' && place.name !== 'Washington')
  .sort((a, b) => b.name.length - a.name.length)
  .map((place) => ({ ...place, pattern: new RegExp(`\\b${escape(place.name)}\\b`) }));

// The first place named in a piece of text, or null.
export function findPlace(text) {
  let best = null;
  for (const place of PLACES) {
    const hit = text.search(place.pattern);
    if (hit !== -1 && (best === null || hit < best.at)) best = { at: hit, place };
  }
  return best ? { name: best.place.name, lat: best.place.lat, lon: best.place.lon, region: best.place.region } : null;
}
