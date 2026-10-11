import { traceRipple } from '@/lib/ai';
import { searchNews } from '@/lib/news';
import { getOdds } from '@/lib/markets';
import { getPriceMove } from '@/lib/prices';
import { saveAnalysis, saveProof } from '@/lib/store';
import { fingerprint, hasWallet, stamp } from '@/lib/solana';
import { SCENARIOS } from '@/data/impact-graph';
import { listEvents, signalBoard } from '@/lib/board';
import { getAnalystView } from '@/lib/analysts';
import { scoreSignal } from '@/lib/score';
import { currentUser } from '@/lib/auth';

const ASKS_FOR_IDEAS = /\b(what|which|where)\b[^.?!]*\b(invest|buy|bullish|put my money|go up|going up|top stocks?)\b/i;

export const dynamic = 'force-dynamic';

const MAX_LENGTH = 600;

function signed(pct) {
  return `${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)} percent`;
}

function sentence(text) {
  const trimmed = String(text || '').trim();
  return !trimmed || /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function forecast(result) {
  if (result.needsClarification) return result.question;
  const parts = [result.reply, result.summary].filter(Boolean);
  if (result.noClearSignal) {
    parts.push('No clear signal here. Nothing obvious follows for any company.');
    return parts.join(' ');
  }
  for (const idea of result.ideas) {
    const moved = idea.price?.status === 'ok' ? ` It is already ${signed(idea.price.weekPct)} this week.` : '';
    parts.push(`${idea.name} is likely to go ${idea.direction === 'tailwind' ? 'up' : 'down'}. ${idea.reason}${moved}`);
  }
  parts.push('These are ideas to research, not advice.');
  return parts.join(' ');
}

async function record(answer) {
  try {
    const hash = fingerprint(answer);
    const time = await saveAnalysis({ ...answer, hash });
    if (hasWallet()) await saveProof(time, await stamp(hash));
  } catch (err) {
    console.error('Could not stamp the answer on Solana:', err.message.slice(0, 160));
  }
}

const NOT_A_STOCK = new Set(['BOND', 'BONDS', 'USD', 'CASH']);

const MAP_TICKERS = new Set(SCENARIOS.flatMap((s) => s.links.flatMap((l) => l.companies.map((c) => c.ticker))));

async function checkHoldings(tickers, scenarioIds, ideas, live) {
  if (!tickers.length) return null;
  const held = new Set(tickers);
  const touched = new Map();
  for (const scenario of SCENARIOS.filter((s) => scenarioIds.has(s.id))) {
    for (const link of scenario.links) {
      for (const company of link.companies) {
        if (!held.has(company.ticker) || touched.has(company.ticker)) continue;
        touched.set(company.ticker, {
          ticker: company.ticker,
          name: company.name,
          direction: link.direction,
          confidence: link.confidence,
          chain: link.chain,
          wrongIf: link.wrongIf,
        });
      }
    }
  }
  const exposed = await Promise.all([...touched.values()].map(async (h) => {
    const price = await getPriceMove(h.ticker);
    const analysts = await getAnalystView(h.ticker).catch(() => null);
    const shown = ideas.find((i) => i.ticker === h.ticker && i.direction === h.direction);
    const onBoard = live && [...live.bullish, ...live.bearish].find((e) => e.ticker === h.ticker && e.direction === h.direction);
    const score = shown?.score || scoreSignal({ direction: h.direction, confidence: h.confidence, events: onBoard?.events.length || 0, strength: onBoard?.strength || 1, price, analysts });
    return { ...h, price, analysts, score };
  }));
  return {
    total: tickers.length,
    exposed,
    untouched: tickers.filter((t) => !touched.has(t) && MAP_TICKERS.has(t)),
    offMap: tickers.filter((t) => !MAP_TICKERS.has(t)),
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const observation = String(body.observation || '').trim().slice(0, MAX_LENGTH);
  const clarification = String(body.clarification || '').trim().slice(0, 200);
  const scenarioHint = String(body.scenario || '').slice(0, 60);
  const earlier = body.earlier?.observation
    ? { observation: String(body.earlier.observation).slice(0, MAX_LENGTH), summary: String(body.earlier.summary || '').slice(0, 300) }
    : null;
  const portfolio = (Array.isArray(body.portfolio) ? body.portfolio : [])
    .map((t) => String(t).toUpperCase().replace(/[^A-Z.]/g, '').slice(0, 7))
    .filter(Boolean)
    .slice(0, 50);
  if (!observation) return Response.json({ error: 'Tell us what you noticed first.' }, { status: 400 });

  const news = await searchNews(earlier ? `${observation} ${earlier.observation}` : observation);

  const live = await signalBoard().catch(() => null);
  const board = !clarification && ASKS_FOR_IDEAS.test(observation) ? live : null;

  let result;
  try {
    result = await traceRipple({ observation, clarification, scenarioHint, earlier, owned: portfolio.filter((t) => MAP_TICKERS.has(t)), others: portfolio.filter((t) => !MAP_TICKERS.has(t) && !NOT_A_STOCK.has(t)).slice(0, 8), bullishNow: board?.bullish, news: news.items });
  } catch (err) {
    console.error('Ripple engine failed:', err.message);
    return Response.json({ error: 'The AI could not answer just now. Try again in a moment.' }, { status: 502 });
  }

  if (board && !result.needsClarification && !result.sample) {
    result.ideas = board.bullish.slice(0, 4).map((b) => ({
      mapped: true,
      scenario: b.scenario,
      scenarioId: b.scenarioId,
      name: b.name,
      ticker: b.ticker,
      type: b.type,
      direction: b.direction,
      chain: b.chain,
      reason: `This comes from ${listEvents(b.events)}.`,
      confidence: b.confidence,
      horizon: b.horizon,
      wrongIf: b.wrongIf,
    }));
    result.noClearSignal = result.ideas.length === 0;
  }

  result.summary = sentence(result.summary);
  result.reply = sentence(result.reply);
  result.ideas = result.ideas.map((idea) => ({ ...idea, reason: sentence(idea.reason) }));

  const [prices, analysts, odds] = await Promise.all([
    Promise.all(result.ideas.map((idea) => getPriceMove(idea.ticker))),
    Promise.all(result.ideas.map((idea) => getAnalystView(idea.ticker).catch(() => null))),
    getOdds(result.oddsQuery),
  ]);

  result.ideas = result.ideas
    .map((idea, i) => ({ ...idea, price: prices[i], analysts: analysts[i] }))
    .filter((idea) => idea.price.status !== 'not-found')
    .map((idea) => {
      const onBoard = live && [...live.bullish, ...live.bearish].find((e) => e.ticker === idea.ticker && e.direction === idea.direction);
      const score = scoreSignal({
        direction: idea.direction,
        confidence: idea.confidence,
        events: onBoard?.events.length || 0,
        strength: onBoard?.strength || 1,
        price: idea.price,
        analysts: idea.analysts,
      });
      return { ...idea, score };
    })
    .sort((a, b) => Math.abs(b.score.value) - Math.abs(a.score.value));
  if (!result.needsClarification && result.ideas.length === 0) result.noClearSignal = true;

  const usedNews = result.sample
    ? []
    : result.usedNews.map((n) => news.items[n - 1]).filter(Boolean);

  const scenarioIds = new Set(result.ideas.map((idea) => idea.scenarioId).filter(Boolean));
  const holdings = result.needsClarification || result.sample ? null : await checkHoldings(portfolio, scenarioIds, result.ideas, live);
  if (holdings) {
    holdings.reads = result.otherHoldings || [];
    holdings.offMap = holdings.offMap.filter((t) => !holdings.reads.some((r) => r.ticker === t));
  }

  const brief = (e) => ({ ticker: e.ticker, name: e.name, direction: e.direction, chain: e.chain, wrongIf: e.wrongIf, reason: `From ${listEvents(e.events)}.`, mapped: true, price: e.price, analysts: e.analysts, score: e.score });
  const answer = {
    ...result,
    holdings,
    board: board && !result.needsClarification ? { bullish: board.bullish.map(brief), bearish: board.bearish.map(brief) } : null,
    odds: result.needsClarification ? [] : odds,
    news: usedNews,
    newsProvider: news.provider,
    forecast: '',
  };
  answer.forecast = forecast(answer);

  if (!answer.needsClarification && !answer.sample) {
    const user = await currentUser(request);
    record({ observation, summary: answer.summary, ideas: answer.ideas, userId: user?.id ?? null });
  }
  return Response.json(answer);
}
