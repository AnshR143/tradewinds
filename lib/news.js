import { cached, getJson, MINUTE } from '@/lib/http';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const USEFUL = new Set([
  'Armed conflicts and attacks',
  'Business and economy',
  'Disasters and accidents',
  'Health and environment',
  'International relations',
  'Politics and elections',
]);

const STOP_WORDS = new Set(('the and for are but not you all any can had her was one our out has have this that with from they will ' +
  'would there their what about which when make like time just know take into year your some could them than then now look only ' +
  'come its over think also back after use two how work first well way even new want because these give most getting going really ' +
  'more less very much many lot been being were does did price prices cost costs expensive cheap higher lower rising falling').split(' '));

const SOURCE_LINK = /\[(https?:\/\/[^\s\]]+)\s*\(([^\]]*)\)\]/g;

function cleanText(wikitext) {
  return wikitext
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[https?:\/\/[^\]]*\]/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDay(wikitext, date) {
  const events = [];
  let category = null;
  const headings = [];

  for (const line of wikitext.split('\n')) {
    const section = line.match(/^'''(.+?)'''\s*$/);
    if (section) {
      category = section[1];
      headings.length = 0;
      continue;
    }
    const bullet = line.match(/^(\*+)\s*(.*)$/);
    if (!bullet || !category) continue;

    const depth = bullet[1].length;
    const body = bullet[2];
    const sources = [...body.matchAll(SOURCE_LINK)].map((m) => ({ url: m[1], name: m[2].replace(/'{2,}/g, '').trim() }));
    const text = cleanText(body);

    if (!sources.length) {
      headings[depth - 1] = text;
      headings.length = depth;
      continue;
    }
    const topic = headings.slice(0, depth - 1).filter(Boolean).pop() || null;
    events.push({ date, category, topic, text, sources });
  }
  return events;
}

async function fetchDay(day) {
  const page = `Portal:Current_events/${day.getUTCFullYear()}_${MONTHS[day.getUTCMonth()]}_${day.getUTCDate()}`;
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2`;
  try {
    const data = await getJson(url);
    const wikitext = data.parse?.wikitext;
    return wikitext ? parseDay(wikitext, day.toISOString().slice(0, 10)) : [];
  } catch {
    return [];
  }
}

export async function getWorldEvents(days = 4) {
  return cached(`world-events-${days}`, 20 * MINUTE, async () => {
    const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() - i * 24 * 60 * MINUTE));
    const perDay = await Promise.all(dates.map(fetchDay));
    return perDay.flat().filter((e) => USEFUL.has(e.category));
  });
}

export async function getLatestNews(limit = 24) {
  const events = await getWorldEvents();
  const seen = new Set();
  return events
    .filter((e) => {
      if (!e.topic) return true;
      if (seen.has(e.topic)) return false;
      seen.add(e.topic);
      return true;
    })
    .slice(0, limit)
    .map((e) => ({ ...e, id: `${e.date}-${e.text.slice(0, 40)}` }));
}

function keywords(text) {
  const words = text.toLowerCase().match(/[a-z]{3,}/g) || [];
  return [...new Set(words.filter((w) => !STOP_WORDS.has(w)).map((w) => w.replace(/s$/, '')))];
}

function searchWorldEvents(events, query) {
  const words = keywords(query);
  if (!words.length) return [];
  const needed = words.length <= 2 ? 1 : 2;
  return events
    .map((event) => {
      const haystack = `${event.topic || ''} ${event.text}`.toLowerCase();
      return { event, score: words.filter((w) => haystack.includes(w)).length };
    })
    .filter((r) => r.score >= needed)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.event);
}

async function searchPerplexity(query) {
  const data = await getJson('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    timeoutMs: 25000,
    headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'You report current news in plain facts. Answer in at most 4 short bullet points with dates. No advice.' },
        { role: 'user', content: `What is the latest news about this, and is it actually happening: ${query}` },
      ],
    }),
  });
  const results = data.search_results || (data.citations || []).map((url) => ({ url, title: new URL(url).hostname }));
  return [{
    date: new Date().toISOString().slice(0, 10),
    category: 'Live web search',
    topic: null,
    text: data.choices?.[0]?.message?.content || '',
    sources: results.slice(0, 5).map((r) => ({ url: r.url, name: r.title || new URL(r.url).hostname })),
  }];
}

export async function searchNews(query) {
  if (process.env.PERPLEXITY_API_KEY) {
    try {
      return { provider: 'Perplexity live search', items: await searchPerplexity(query) };
    } catch (err) {
      console.error('Perplexity search failed, using world events instead:', err.message);
    }
  }
  try {
    return { provider: 'Wikipedia current events', items: searchWorldEvents(await getWorldEvents(), query) };
  } catch (err) {
    console.error('News search failed:', err.message);
    return { provider: 'none', items: [] };
  }
}

async function searchGdelt(query) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`${query} sourcelang:english`)}&mode=artlist&maxrecords=8&timespan=7d&sort=datedesc&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
  const text = await res.text();
  if (!text.trim().startsWith('{')) throw new Error('GDELT is busy');
  const seen = new Set();
  return (JSON.parse(text).articles || [])
    .filter((a) => a.title && a.url && !seen.has(a.title) && seen.add(a.title))
    .slice(0, 6)
    .map((a) => ({
      date: /^\d{8}/.test(a.seendate || '') ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}` : '',
      text: a.title,
      sources: [{ url: a.url, name: a.domain || new URL(a.url).hostname }],
    }));
}

async function searchWorldEventsWider(query) {
  const words = keywords(query);
  if (!words.length) return [];
  const events = await getWorldEvents(14);
  const patterns = words.map((w) => new RegExp(`\\b${w}`, 'i'));
  const needed = words.length >= 3 ? 2 : 1;
  return events
    .map((event) => {
      const haystack = `${event.topic || ''} ${event.text}`;
      return { event, score: patterns.filter((p) => p.test(haystack)).length };
    })
    .filter((r) => r.score >= needed)
    .sort((a, b) => b.score - a.score || (a.event.date < b.event.date ? 1 : -1))
    .slice(0, 8)
    .map((r) => ({ date: r.event.date, text: r.event.text, sources: r.event.sources }));
}

export async function findMoreNews(query, already = []) {
  const shown = new Set(already);
  const searched = [];
  const found = [];

  const sources = [
    process.env.PERPLEXITY_API_KEY && ['live web search', () => searchPerplexity(query)],
    ['news articles worldwide', () => searchGdelt(query)],
    ['two weeks of world events', () => searchWorldEventsWider(query)],
  ].filter(Boolean);

  for (const [name, search] of sources) {
    try {
      const items = (await search()).filter((item) => item.text && !shown.has(item.text));
      items.forEach((item) => shown.add(item.text));
      found.push(...items);
      searched.push(name);
    } catch (err) {
      console.error(`More news (${name}) failed:`, err.message);
    }
  }
  return { items: found.slice(0, 10), searched };
}
