// What is happening right now: sky feeds plus recent world events.
import { getWeatherSignals } from '@/lib/feeds/weather';
import { getEonetSignals } from '@/lib/feeds/eonet';
import { getCommoditySignals } from '@/lib/feeds/commodities';
import { getLatestNews } from '@/lib/news';
import { saveSignals } from '@/lib/store';
import { startPlaneWatch, startPriceWarmer } from '@/lib/warm';
import { findPlace } from '@/data/places';

// News about decisions (elections, laws, the economy) goes to the Politics page.
// Everything else (conflicts, disasters, health) goes to the Geopolitical page.
const POLITICS = new Set(['Politics and elections', 'Business and economy']);

export const dynamic = 'force-dynamic';

// One feed being down should not empty the whole page.
async function orEmpty(name, load) {
  try {
    return await load();
  } catch (err) {
    console.error(`${name} feed failed:`, err.message);
    return [];
  }
}

export async function GET() {
  startPriceWarmer();
  startPlaneWatch();
  const [nasa, weather, prices, events] = await Promise.all([
    getEonetSignals(),
    orEmpty('Weather', getWeatherSignals),
    orEmpty('Commodity prices', getCommoditySignals),
    orEmpty('World events', getLatestNews),
  ]);

  const sky = [...nasa.signals, ...weather, ...prices];
  saveSignals(sky);

  // When NASA's feed is down we show its last good report, and say so.
  let skyNote = '';
  if (!nasa.live) {
    skyNote = nasa.asOf
      ? `NASA's storm feed is not responding right now. Storms shown are from its last report at ${new Date(nasa.asOf).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} Eastern.`
      : "NASA's storm feed is not responding right now, so only US weather alerts are shown.";
  }

  const news = events.map((e) => {
    const place = findPlace(`${e.topic || ''} ${e.text}`);
    return {
      id: e.id,
      kind: 'news',
      group: POLITICS.has(e.category) ? 'politics' : 'geopolitical',
      category: e.category,
      title: e.topic || e.category,
      text: e.text,
      date: e.date,
      time: `${e.date}T12:00:00Z`,
      sources: e.sources,
      prompt: e.text,
      where: place?.name || null,
      lat: place?.lat ?? null,
      lon: place?.lon ?? null,
      region: place?.region || null,
    };
  });

  return Response.json({ sky, skyNote, news, fetchedAt: new Date().toISOString() });
}
