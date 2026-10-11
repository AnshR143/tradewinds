import { answerAloud, hasAiKey } from '@/lib/ai';
import { clientKey, currentUser, sameOrigin, tooMany } from '@/lib/auth';
import { signalBoard } from '@/lib/board';
import { getEonetSignals } from '@/lib/feeds/eonet';
import { MINUTE } from '@/lib/http';
import { stocksFromNews } from '@/lib/newsStocks';
import { getPatterns } from '@/lib/patterns';
import { hasVoiceKey, hear, say } from '@/lib/voice';
import { getLatestNews } from '@/lib/news';
import { findPlace } from '@/data/places';

export const dynamic = 'force-dynamic';

function within(promise, ms, otherwise) {
  return Promise.race([promise.catch(() => otherwise), new Promise((done) => setTimeout(() => done(otherwise), ms))]);
}

const COMMON = new Set(['strait', 'canal', 'channel', 'passage', 'cape', 'gulf', 'hurricane', 'typhoon', 'tropical', 'storm', 'cyclone', 'super', 'wildfire', 'volcano', 'international', 'airport', 'north', 'south', 'east', 'west', 'warning', 'flood']);
function mentions(text, name) {
  if (text.includes(name.toLowerCase())) return 10;
  const words = (name.toLowerCase().match(/[a-z]{5,}/g) || []).filter((word) => !COMMON.has(word));
  return words.filter((word) => new RegExp(`\\b${word}\\b`).test(text)).length;
}

const signed = (n) => `${n > 0 ? 'plus' : 'minus'} ${Math.abs(n)}`;
const stock = (s) => `${s.name} (score ${signed(s.score.value)} out of 100)`;

async function gatherFacts(looking) {
  const [patterns, nasa, board, fromNews, latest] = await Promise.all([
    within(getPatterns(), 9000, null),
    within(getEonetSignals(), 6000, { signals: [] }),
    within(signalBoard(), 6000, null),
    within(stocksFromNews(), 6000, null),
    within(getLatestNews(), 6000, []),
  ]);
  const items = [];
  const numbered = (item, line) => `${items.push({ ...item, name: line.split(/[:,.]/)[0].trim() })}. ${line}`;
  const parts = [];

  const findings = (patterns?.findings || []).slice(0, 8);
  if (findings.length) {
    const type = { ships: 'ship', airport: 'airport', planes: 'event' };
    parts.push(`PATTERNS IN PLANES AND SHIPS, BIGGEST FIRST\n(These are about traffic only. No company is linked to them here, so do not say who they help or hurt.)\n${findings.map((f) => numbered({ type: type[f.kind], id: f.ref, lat: f.lat, lon: f.lon }, `${f.title}. ${f.text} Why: ${f.reason}`)).join('\n')}`);
  }
  const storms = nasa.signals.filter((s) => s.kind !== 'weather').slice(0, 6);
  if (storms.length) parts.push(`STORMS, FIRES AND VOLCANOES SEEN BY SATELLITE\n${storms.map((s) => numbered({ type: 'event', id: s.id, lat: s.lat, lon: s.lon }, `${s.title}, ${s.where}.${s.text ? ` ${s.text}` : ''}`)).join('\n')}`);
  const news = latest.slice(0, 8).map((e) => ({ ...e, place: findPlace(`${e.topic || ''} ${e.text}`) }));
  if (news.length) parts.push(`IN THE NEWS, NEWEST FIRST\n${news.map((e) => numbered({ type: 'event', id: e.id, lat: e.place?.lat, lon: e.place?.lon }, `${e.topic || e.category}. ${e.text}`)).join('\n')}`);
  const points = patterns?.ships.points || [];
  if (points.length) parts.push(`EVERY CHOKE POINT WE COUNT SHIPS AT (ships a day this week, then in a typical year)\n${points.map((p) => `${p.name} ${p.perDay}, ${p.typical}`).join('; ')}.`);
  if (patterns?.planes.total) parts.push(`PLANES\n${patterns.planes.total.toLocaleString('en-US')} planes are being tracked in the air.`);

  if (board && board.bullish.length + board.bearish.length) {
    const list = (rows) => rows.slice(0, 4).map((s) => `${stock(s)} because of ${s.events.slice(0, 2).join(' and ')}`).join('; ') || 'none right now';
    parts.push(`STOCKS TOUCHED BY THESE EVENTS\nLikely to go up: ${list(board.bullish)}.\nLikely to go down: ${list(board.bearish)}.`);
  }
  if (fromNews?.stocks.length) {
    const list = (direction) => fromNews.stocks.filter((s) => s.direction === direction).slice(0, 3).map((s) => `${stock(s)}, from the news: ${s.headlines[0]}`).join('; ') || 'none right now';
    parts.push(`STOCKS TOUCHED BY THE NEWS\nLikely to go up: ${list('tailwind')}.\nLikely to go down: ${list('headwind')}.`);
  }
  if (looking) parts.push(`ON THEIR SCREEN RIGHT NOW\nThey have opened: ${looking}`);
  const places = [
    ...latest.map((e) => ({ type: 'event', id: e.id, name: e.topic || '', place: findPlace(`${e.topic || ''} ${e.text}`) })).filter((e) => e.name && e.place).map((e) => ({ type: e.type, id: e.id, name: e.name, lat: e.place.lat, lon: e.place.lon })),
    ...(patterns?.ships.points || []).map((p) => ({ type: 'ship', id: p.id, name: p.name, lat: p.lat, lon: p.lon })),
    ...(patterns?.airports || []).filter((a) => a.lat !== null).map((a) => ({ type: 'airport', id: a.id, name: a.name, lat: a.lat, lon: a.lon })),
  ];
  return { text: parts.join('\n\n') || 'The live feeds are not answering right now.', items, places, findings };
}

const greetings = new Map();
async function greeting(request) {
  const user = await currentUser(request).catch(() => null);
  const raw = (user?.email || '').split('@')[0].split(/[^a-zA-Z]/)[0] || process.env.VOICE_GREETING_NAME || '';
  const name = raw.slice(0, 1).toUpperCase() + raw.slice(1, 30).toLowerCase();
  const text = name ? `Hey ${name}, what information would you like?` : 'Hey, what information would you like?';
  if (!greetings.has(text) && hasVoiceKey()) {
    try {
      greetings.set(text, (await say(text)).toString('base64'));
    } catch (err) {
      console.error('Voice could not speak the greeting:', err.message);
    }
  }
  return { heard: '', say: text, open: null, layers: null, audio: greetings.get(text) || null };
}

export async function GET() {
  return Response.json({ voice: hasVoiceKey() });
}

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Not allowed from another site.' }, { status: 403 });
  if (tooMany(`voice-${clientKey(request)}`, 30, 10 * MINUTE)) return Response.json({ error: 'That is a lot of questions. Give it a few minutes.' }, { status: 429 });

  let question = '';
  let earlier = [];
  let looking = '';
  try {
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await request.formData();
      const audio = form.get('audio');
      earlier = JSON.parse(form.get('earlier') || '[]');
      looking = form.get('looking') || '';
      if (!audio || typeof audio === 'string') return Response.json({ error: 'No recording arrived.' }, { status: 400 });
      if (audio.size > 3 * 1024 * 1024) return Response.json({ error: 'That recording is too long.' }, { status: 413 });
      if (!hasVoiceKey()) return Response.json({ error: 'The voice is not set up. Type your question instead.' }, { status: 400 });
      question = await hear(audio);
    } else {
      const body = await request.json();
      if (body.greet) return Response.json(await greeting(request));
      question = String(body.question || '');
      earlier = body.earlier || [];
      looking = body.looking || '';
    }
  } catch (err) {
    console.error('Voice could not read the question:', err.message);
    return Response.json({ error: 'Could not make out the question. Try again.' }, { status: 400 });
  }

  question = question.trim().slice(0, 400);
  if (!question) return Response.json({ heard: '', say: '' });
  earlier = (Array.isArray(earlier) ? earlier : []).slice(-3).map((turn) => ({ q: String(turn?.q || '').slice(0, 300), a: String(turn?.a || '').slice(0, 500) }));

  const facts = await gatherFacts(String(looking).slice(0, 120));
  let answer;
  try {
    if (!hasAiKey()) throw new Error('No AI key is set.');
    answer = await answerAloud({ question, facts: facts.text, earlier });
  } catch (err) {
    console.error('Voice answer failed:', err.message);
    const top = facts.findings[0];
    answer = { say: top ? `I can't think that through right now. The biggest pattern on the map is this: ${top.title}. ${top.reason}` : "I can't reach the live feeds right now. Try again in a minute.", open: top ? 1 : null, layers: null };
  }
  if (!answer.say) answer.say = 'I do not have anything on that right now.';

  let audio = null;
  if (hasVoiceKey()) {
    try {
      audio = (await say(answer.say)).toString('base64');
    } catch (err) {
      console.error('Voice could not speak:', err.message);
    }
  }
  const asked = question.toLowerCase();
  const spoken = answer.say.toLowerCase();
  const everything = [...facts.items, ...facts.places];
  const namedIn = (text) => everything.map((item) => ({ item, score: mentions(text, item.name) })).filter((m) => m.score > 0).sort((a, b) => b.score - a.score)[0]?.item;
  let open = facts.items[answer.open - 1] || namedIn(asked) || namedIn(spoken) || null;
  if (!open || typeof open.lat !== 'number') {
    const place = findPlace(question) || (open ? findPlace(open.name) : null);
    if (place) open = { type: open?.type || 'place', id: open?.id || place.name, name: open?.name || place.name, lat: place.lat, lon: place.lon };
  }
  return Response.json({ heard: question, say: answer.say, open: open && { type: open.type, id: open.id, name: open.name, lat: open.lat ?? null, lon: open.lon ?? null }, layers: answer.layers, audio });
}
