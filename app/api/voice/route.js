// The map's voice agent. Takes a spoken (or typed) question, answers it from what the map is
// showing right now, and sends the answer back as text and as speech.
import { answerAloud, hasAiKey } from '@/lib/ai';
import { clientKey, sameOrigin, tooMany } from '@/lib/auth';
import { signalBoard } from '@/lib/board';
import { getEonetSignals } from '@/lib/feeds/eonet';
import { MINUTE } from '@/lib/http';
import { stocksFromNews } from '@/lib/newsStocks';
import { getPatterns } from '@/lib/patterns';
import { hasVoiceKey, hear, say } from '@/lib/voice';

export const dynamic = 'force-dynamic';

// A feed that is slow to answer is left out, so the voice never waits long on one.
function within(promise, ms, otherwise) {
  return Promise.race([promise.catch(() => otherwise), new Promise((done) => setTimeout(() => done(otherwise), ms))]);
}

const signed = (n) => `${n > 0 ? 'plus' : 'minus'} ${Math.abs(n)}`;
const stock = (s) => `${s.name} (score ${signed(s.score.value)} out of 100)`;

// Everything the answer may draw on, as text. Items the map can zoom to are numbered, and
// `items` says what each number opens.
async function gatherFacts(looking) {
  const [patterns, nasa, board, fromNews] = await Promise.all([
    within(getPatterns(), 9000, null),
    within(getEonetSignals(), 6000, { signals: [] }),
    within(signalBoard(), 6000, null),
    within(stocksFromNews(), 6000, null),
  ]);
  const items = [];
  // Each item keeps its name ("Strait of Hormuz"), to spot which one an answer talks about.
  const numbered = (item, line) => `${items.push({ ...item, name: line.split(/[:,.]/)[0].trim() })}. ${line}`;
  const parts = [];

  const findings = (patterns?.findings || []).slice(0, 8);
  if (findings.length) {
    const type = { ships: 'ship', airport: 'airport', planes: 'event' };
    parts.push(`PATTERNS IN PLANES AND SHIPS, BIGGEST FIRST\n(These are about traffic only. No company is linked to them here, so do not say who they help or hurt.)\n${findings.map((f) => numbered({ type: type[f.kind], id: f.ref }, `${f.title}. ${f.text} Why: ${f.reason}`)).join('\n')}`);
  }
  const storms = nasa.signals.filter((s) => s.kind !== 'weather').slice(0, 6);
  if (storms.length) parts.push(`STORMS, FIRES AND VOLCANOES SEEN BY SATELLITE\n${storms.map((s) => numbered({ type: 'event', id: s.id }, `${s.title}, ${s.where}.${s.text ? ` ${s.text}` : ''}`)).join('\n')}`);
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
  return { text: parts.join('\n\n') || 'The live feeds are not answering right now.', items, findings };
}

export async function GET() {
  return Response.json({ voice: hasVoiceKey() });
}

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Not allowed from another site.' }, { status: 403 });
  // Every question costs voice credits, so one visitor gets 30 in ten minutes.
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
    // Without the AI, read out the biggest pattern as it is written on the map.
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
  // What the map zooms to: the item the AI picked, or else the first one its answer names.
  const spoken = answer.say.toLowerCase();
  const named = facts.items.map((item) => ({ item, at: spoken.indexOf(item.name.toLowerCase()) })).filter((m) => m.at >= 0).sort((a, b) => a.at - b.at)[0]?.item;
  const open = facts.items[answer.open - 1] || named || null;
  return Response.json({ heard: question, say: answer.say, open: open && { type: open.type, id: open.id }, layers: answer.layers, audio });
}
