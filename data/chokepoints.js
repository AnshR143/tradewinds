// Places where a disruption spreads far beyond the place itself: big ports, canals,
// fuel and chip hubs, air cargo hubs and farm regions. Coordinates are approximate.
// A storm, fire or quake within NEAR_KM of one of these gets flagged.

export const NEAR_KM = 700;

export const CHOKEPOINTS = [
  // United States
  { name: 'Port of Houston', why: 'the busiest US port for oil and chemicals', lat: 29.73, lon: -95.27 },
  { name: 'Texas and Louisiana refineries', why: 'where about half of US fuel is made', lat: 29.88, lon: -93.94 },
  { name: 'Port of New Orleans', why: 'the main exit for US grain down the Mississippi', lat: 29.95, lon: -90.06 },
  { name: 'Port of Mobile', why: 'a major Gulf port for coal, steel and cars', lat: 30.69, lon: -88.04 },
  { name: 'Port Tampa Bay', why: 'the entry point for much of Florida\'s fuel', lat: 27.94, lon: -82.45 },
  { name: 'Port of Savannah', why: 'one of the busiest container ports on the US East Coast', lat: 32.08, lon: -81.09 },
  { name: 'Port of New York and New Jersey', why: 'the busiest port on the US East Coast', lat: 40.67, lon: -74.04 },
  { name: 'Ports of Los Angeles and Long Beach', why: 'where most US imports from Asia arrive', lat: 33.74, lon: -118.26 },
  { name: 'Memphis air cargo hub', why: 'the main sorting hub for overnight packages in the US', lat: 35.04, lon: -89.98 },
  { name: 'Louisville air cargo hub', why: 'a main sorting hub for US package delivery', lat: 38.17, lon: -85.74 },
  { name: 'US corn belt', why: 'where most US corn and soybeans are grown', lat: 41.6, lon: -93.6 },
  { name: 'California Central Valley', why: 'where much of US fruit, nuts and vegetables are grown', lat: 36.7, lon: -119.8 },
  { name: 'Permian Basin', why: 'the largest US oil field', lat: 31.9, lon: -102.1 },

  // Americas
  { name: 'Port of Manzanillo', why: 'Mexico\'s largest container port', lat: 19.05, lon: -104.32 },
  { name: 'Port of Lázaro Cárdenas', why: 'a major Mexican port with rail links to the US', lat: 17.96, lon: -102.19 },
  { name: 'Panama Canal', why: 'the shortcut between the Atlantic and Pacific for ships', lat: 9.08, lon: -79.68 },
  { name: 'Brazil coffee region', why: 'where the largest share of the world\'s coffee is grown', lat: -19.9, lon: -44.0 },
  { name: 'Chile copper region', why: 'where the largest share of the world\'s copper is mined', lat: -23.65, lon: -70.4 },

  // Asia
  { name: 'Port of Shanghai', why: 'the busiest container port in the world', lat: 30.63, lon: 122.06 },
  { name: 'Shenzhen and Hong Kong ports', why: 'the export gateway for southern China\'s factories', lat: 22.5, lon: 114.1 },
  { name: 'Taiwan chip factories', why: 'where most of the world\'s advanced computer chips are made', lat: 24.8, lon: 120.97 },
  { name: 'Port of Kaohsiung', why: 'Taiwan\'s largest port', lat: 22.61, lon: 120.28 },
  { name: 'Tokyo Bay ports', why: 'Japan\'s main gateway for trade', lat: 35.45, lon: 139.65 },
  { name: 'Port of Busan', why: 'South Korea\'s largest port', lat: 35.1, lon: 129.04 },
  { name: 'Port of Singapore', why: 'one of the busiest shipping hubs in the world', lat: 1.26, lon: 103.84 },
  { name: 'Strait of Malacca', why: 'the main sea route between Asia and Europe', lat: 2.5, lon: 101.5 },
  { name: 'Sumatra palm oil region', why: 'a leading source of the world\'s palm oil', lat: 0.5, lon: 101.4 },

  // Middle East and Europe
  { name: 'Suez Canal', why: 'the shortcut between Asia and Europe for ships', lat: 30.6, lon: 32.3 },
  { name: 'Strait of Hormuz', why: 'the route for about a fifth of the world\'s oil', lat: 26.57, lon: 56.25 },
  { name: 'Bab el-Mandeb Strait', why: 'the southern gate to the Red Sea and Suez Canal', lat: 12.6, lon: 43.3 },
  { name: 'Port of Rotterdam', why: 'the busiest port in Europe', lat: 51.95, lon: 4.14 },
];
