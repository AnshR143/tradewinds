// The ripple engine: turns an observation into who is helped, who is hurt, and why.
//
// The AI does not choose companies freely. It is handed the impact map (data/impact-graph.js)
// and picks the links that fit the event, then explains them. Only when nothing in the map
// fits may it suggest its own idea, and those are labeled as unchecked guesses on the page.
//
// Uses Groq when GROQ_API_KEY is set, then NVIDIA, then DeepSeek. Without a key it returns
// a fixed sample.
import { LINKS, SCENARIOS, scenarioLabel } from '@/data/impact-graph';

const MAX_IDEAS = 5;

// The map as text for the AI. Free AI plans limit how much text we can send per minute, so:
// - when our rules already matched a scenario, only that scenario is sent, in full;
// - otherwise every scenario is sent in short form (the end of each chain, not every step).
function mapAsText(onlyScenario) {
  const scenarios = onlyScenario ? SCENARIOS.filter((s) => s.id === onlyScenario) : SCENARIOS;
  return scenarios.map((scenario) => {
    const links = scenario.links.map((link) => {
      const companies = link.companies.map((c) => `${c.ticker} ${c.name}`).join(', ');
      const chain = onlyScenario ? link.chain.join(' > ') : link.chain[link.chain.length - 1];
      return `  ${scenario.id}/${link.id} [${link.direction}] ${chain} | ${companies}`;
    });
    return `${scenario.id}: ${scenario.label}\n${links.join('\n')}`;
  }).join('\n\n');
}

const instructions = (mapText) => `You are the ripple engine inside TradeWinds, a research tool for people who know nothing about investing.
The user gives you something they noticed, or a live event. You work out which companies it touches.

Write for a 13-year-old. Short sentences. No jargon. Do not use abbreviations or finance terms such as ETF, yield, margin, hedge, reinsured, basis points, or central bank initials. Say "fund", not "ETF".
Never tell the user to buy or sell. These are ideas to research.

THE IMPACT MAP
Our team built this map by hand. Each line is one link: its id, whether it helps (tailwind) or hurts (headwind), what happens, and the companies it applies to.

${mapText}

Reply with JSON only, in exactly this shape:
{
  "needsClarification": boolean,
  "question": string,            // only when needsClarification is true
  "options": [string],           // 2 or 3 short answers the user can pick
  "reply": string,               // the bottom line in ONE short sentence, 25 words at most. If the observation is a question, this answers it
  "summary": string,             // one sentence: what is happening
  "noClearSignal": boolean,      // true when this is unlikely to move any company in a way you can explain
  "ideas": [
    {
      "link": string,            // a link id from the map, like "us-hurricane/home-repair". "" only for an idea outside the map
      "ticker": string,          // one ticker listed on that link
      "reason": string,          // one full plain sentence: what the company does and why THIS event touches it

      // Fill these in ONLY when link is "" (an idea outside the map):
      "name": string, "type": "stock" | "fund", "direction": "tailwind" | "headwind",
      "chain": [string, string, string], "horizon": "days" | "weeks" | "months", "wrongIf": string
    }
  ],
  "bonds": string,               // one sentence on what this means for loans to governments or companies, or ""
  "privateCompanies": string,    // one sentence on where startup money may move, or ""
  "otherHoldings": [             // only when the prompt lists holdings that are not on our map: one entry for each
    { "ticker": string, "effect": "up" | "down" | "mixed" | "none", "why": string }
  ],
  "nextSteps": [string],         // 3 or 4 things a careful person could do next about THIS event, each starting with a verb
  "oddsQuery": string,           // 1 to 3 words to search prediction markets, like "hurricane landfall"
  "newsQuery": string,           // 2 to 4 words to search the news for this event, like "Hurricane Simon Mexico ports"
  "usedNews": [number]           // numbers of the news items you relied on
}

Rules:
- Use the map first. If any scenario fits the event, every idea must be a link from the map with one of its listed tickers.
- Pick the links and companies that fit THIS event best. Use the location: a storm in Florida touches Florida's power company, not California's. Skip links whose "wrong if" already applies.
- Check the direction before you use a link. Every link starts from something specific: a price RISING, a conflict GROWING, a storm hitting. If the event is the opposite (a price falling, a ceasefire holding, a tax being removed), never use that link. Use the scenario for the opposite if the map has one (for example conflict-eases, oil-down, rates-down). If it has none, go outside the map.
- The first step of a link's chain must be true of THIS event. If it is not, the link does not apply.
- Give at most ${MAX_IDEAS} ideas. Fewer is fine. Include both tailwinds and headwinds when both honestly apply.
- Go outside the map only when no scenario fits. For those ideas set link to "" and name only a company you are sure is listed on a US exchange under that exact ticker. If unsure, give no idea.
- If the observation could mean different things that lead to different winners, set needsClarification to true, ask ONE question, and leave ideas empty. A price change noticed in one country, one city or one store is a common case: ask whether it is happening only there or everywhere, unless the news items already settle it. Never ask when the user has already answered a question.
- Take the observation as true. You do not need news to confirm it, and missing news is never a reason to give no ideas. If a scenario in the map fits, give ideas from it.
- "nextSteps" are checks and actions, never trades. Good: "Check how much of your savings sits in cruise lines", "Watch whether the ports reopen this week", "Compare the fall so far with how long the storm should last", "Read the company's next earnings report". Make each one specific to this event and these companies. Never say buy, sell, hold, short or "consider selling".
- "reply" is the bottom line in one short sentence: which companies this is likely good for and which it is likely bad for, and why, in everyday words. Name the companies, and the reader's own holdings when they are listed. Never use the words bullish, bearish, tailwind, headwind or signal. Example: "Likely good for Home Depot and bad for Carnival, because the storm damages homes and cancels sailings."
- Never write a sentence about what TradeWinds can or cannot do, or about what you are able to tell the reader. Just give the bottom line.
- Only when the event truly does not touch any company in a way you can explain, set noClearSignal to true, say why in summary, and leave ideas empty.
- The news items may be unrelated to the observation. Ignore any that are. Do not invent news.`;

function buildPrompt({ observation, clarification, scenarioHint, earlier, owned, others, bullishNow, news }) {
  const lines = [`Today is ${new Date().toISOString().slice(0, 10)}.`, ''];
  if (earlier) {
    lines.push(
      `Earlier in this chat the user said: ${earlier.observation}`,
      `Your answer then: ${earlier.summary}`,
      'The new observation may be a follow-up to that. If it is a new topic, ignore the earlier one.',
      '',
    );
  }
  lines.push(`Observation: ${observation}`);
  if (owned?.length) {
    lines.push(
      `The reader owns shares in: ${owned.join(', ')}.`,
      'When a link you choose lists one of these, pick that company for the idea, and make the next steps about the companies they own. Do not mention companies they own that this event does not touch. Still give ideas for the other links this event sets off, on both sides, even when the reader owns none of those companies.',
    );
  }
  if (others?.length) {
    lines.push(
      `The reader also holds these, which are not on our map: ${others.join(', ')}.`,
      'Fill in "otherHoldings" with one entry for each. In one plain sentence, say how THIS event is likely to touch it, from what that fund or company mostly holds or does. Use "mixed" when part of it is helped and part is hurt, and say which parts. Use "none" when there is no clear effect, or when it is not a US stock or fund you recognise. Each sentence must agree with your ideas: if an idea says oil producers are hurt, do not say a fund\'s oil holdings are helped.',
    );
  }
  if (scenarioHint) {
    lines.push(`Our fixed rules matched this signal to the scenario "${scenarioHint}", so only that part of the map is shown.`);
  }
  if (bullishNow) {
    lines.push(
      '',
      'The reader is asking which companies are likely to go up. From events happening right now, our impact map points at:',
      ...(bullishNow.length ? bullishNow.map((b) => `- ${b.name} (${b.ticker}), from ${b.events.slice(0, 2).join(' and ')}: ${b.chain[b.chain.length - 1]}. Cancelled if: ${b.wrongIf}`) : ['(none right now)']),
      'Write "reply" as one short sentence about these companies: name the strongest two or three and the event behind them. If there are none, say so. Write "summary" as one sentence on what is happening overall. Leave "ideas" empty; we fill it in from this list.',
    );
  }
  if (clarification) lines.push(`The user already answered your question. Their answer: ${clarification}`);
  lines.push('', 'Recent news items:');
  if (!news.length) lines.push('(none found)');
  news.forEach((item, i) => lines.push(`${i + 1}. [${item.date}] ${item.topic ? `${item.topic}: ` : ''}${item.text}`));
  return lines.join('\n');
}

// An idea the AI picked from the map. Everything except the reason comes from the map.
function fromMap(idea) {
  const link = LINKS.get(String(idea.link || ''));
  if (!link) return null;
  const ticker = String(idea.ticker || '').toUpperCase();
  const company = link.companies.find((c) => c.ticker === ticker) || link.companies[0];
  return {
    mapped: true,
    scenario: link.scenario.label,
    scenarioId: link.scenario.id,
    name: company.name,
    ticker: company.ticker,
    type: company.type || 'stock',
    direction: link.direction,
    chain: link.chain,
    reason: String(idea.reason || ''),
    confidence: link.confidence,
    horizon: link.horizon,
    wrongIf: link.wrongIf,
  };
}

// An idea the AI came up with itself. It is never rated above "guess".
function outsideMap(idea) {
  if (!idea.name || !idea.ticker || !['tailwind', 'headwind'].includes(idea.direction)) return null;
  return {
    mapped: false,
    scenario: null,
    name: String(idea.name),
    ticker: String(idea.ticker).toUpperCase().replace(/[^A-Z.]/g, ''),
    type: idea.type === 'fund' ? 'fund' : 'stock',
    direction: idea.direction,
    chain: (Array.isArray(idea.chain) ? idea.chain : []).map(String).slice(0, 4),
    reason: String(idea.reason || ''),
    confidence: 'guess',
    horizon: ['days', 'weeks', 'months'].includes(idea.horizon) ? idea.horizon : 'weeks',
    wrongIf: String(idea.wrongIf || ''),
  };
}

// A next step that tells the reader to trade is dropped. TradeWinds explains; it does not give advice.
const TRADE_WORDS = /\b(buy|buying|sell|selling|short|shorting|hold onto|dump)\b/i;

// Drops any sentence where the model talks about itself instead of the event, such as
// "TradeWinds can't tell you to buy or sell".
function withoutDisclaimers(text) {
  return text
    .split(/(?<=[.!?;])\s+/)
    .filter((part) => !/(can(not|['’]t)| not able to| unable to) (tell|advise|recommend|say)|financial advi[cs]e|not a (licensed|financial)/i.test(part))
    .join(' ')
    .trim();
}

// The model's reply is untrusted text. Keep only the fields we expect, in the shapes we expect.
function tidy(raw, others = []) {
  const seen = new Set();
  const ideas = (Array.isArray(raw.ideas) ? raw.ideas : [])
    .map((idea) => (idea && (fromMap(idea) || outsideMap(idea))))
    .filter((idea) => idea && !seen.has(idea.ticker) && seen.add(idea.ticker))
    .slice(0, MAX_IDEAS);

  const needsClarification = Boolean(raw.needsClarification) && Boolean(raw.question);
  return {
    needsClarification,
    question: needsClarification ? String(raw.question) : '',
    options: needsClarification && Array.isArray(raw.options) ? raw.options.map(String).slice(0, 3) : [],
    reply: needsClarification ? '' : withoutDisclaimers(String(raw.reply || '')).slice(0, 500),
    summary: String(raw.summary || ''),
    noClearSignal: Boolean(raw.noClearSignal) || (!needsClarification && ideas.length === 0),
    ideas: needsClarification ? [] : ideas,
    bonds: String(raw.bonds || ''),
    privateCompanies: String(raw.privateCompanies || ''),
    nextSteps: needsClarification ? [] : (Array.isArray(raw.nextSteps) ? raw.nextSteps : [])
      .map(String)
      .filter((step) => step && !TRADE_WORDS.test(step))
      .slice(0, 4),
    // The AI's own read on holdings that are not on the map. Only tickers we asked about.
    otherHoldings: needsClarification ? [] : (Array.isArray(raw.otherHoldings) ? raw.otherHoldings : [])
      .map((h) => ({
        ticker: String(h?.ticker || '').toUpperCase(),
        effect: ['up', 'down', 'mixed'].includes(h?.effect) ? h.effect : 'none',
        why: withoutDisclaimers(String(h?.why || '')).slice(0, 260),
      }))
      .filter((h, i, all) => others.includes(h.ticker) && h.why && all.findIndex((x) => x.ticker === h.ticker) === i),
    oddsQuery: String(raw.oddsQuery || '').slice(0, 60),
    newsQuery: String(raw.newsQuery || raw.oddsQuery || '').slice(0, 80),
    usedNews: (Array.isArray(raw.usedNews) ? raw.usedNews : []).map(Number).filter(Number.isInteger),
  };
}

// Groq, NVIDIA and DeepSeek all speak the same chat format, so one function covers them.
// Listed in the order they are tried.
function providers() {
  return [
    {
      name: 'Groq',
      key: process.env.GROQ_API_KEY,
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      // Less hidden "thinking" text, which keeps answers fast and under the free limit.
      extra: { reasoning_effort: 'low' },
    },
    {
      name: 'NVIDIA',
      key: process.env.NVIDIA_API_KEY,
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      model: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-super-120b-a12b',
    },
    {
      name: 'DeepSeek',
      key: process.env.DEEPSEEK_API_KEY,
      url: 'https://api.deepseek.com/chat/completions',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    },
  ].filter((p) => p.key);
}

export function hasAiKey() {
  return providers().length > 0;
}

async function ask(provider, { system, prompt, temperature = 0.3 }) {
  const res = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature,
      ...provider.extra,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`${provider.name} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  // Some models wrap the JSON in extra text, so take everything from the first { to the last }.
  const text = data.choices?.[0]?.message?.content || '';
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

// Tries each provider in turn, so one being down or out of free requests does not stop the app.
async function askAi(request) {
  let lastError = new Error('No AI key is set.');
  for (const provider of providers()) {
    try {
      return await ask(provider, request);
    } catch (err) {
      console.error(`${provider.name} failed:`, err.message);
      lastError = err;
    }
  }
  throw lastError;
}

const SPOKEN = `You are the voice of the TradeWinds map. The person is looking at a full-screen world map of storms, news, planes and cargo ships, and asked you something out loud. They know nothing about investing.

Answer from the FACTS only. If the facts do not cover the question, say so in one sentence and name something you can talk about instead.
Only say a company is helped or hurt when the FACTS list that company by name, and give the event the FACTS give for it. Never say what "companies that rely on" something or "firms that" do something gain or lose: if no company is named, describe the event and stop.

Your answer is read aloud, so:
- 2 to 4 short sentences, under 70 words. Plain words. No lists, symbols, brackets or abbreviations.
- Say company names, never ticker letters. Write numbers simply, like "down 97 percent" or "about 3 ships a day".
- Lead with the most important thing.
- Asked for the updates or what is new: give the two or three biggest things, such as the largest pattern and the main event, and which companies each one likely helps or hurts.
- Never tell them to buy, sell or hold anything. Always put "likely" before helps or hurts, because nothing here is certain. Write it like this: "Hurricane Isaias likely helps Home Depot and likely hurts Union Pacific." Never write "is boosting", "is helping" or "is hurting". Asked what to buy, say which companies events are likely helping, and that it is a starting point for their own research.

Reply with JSON only: {"say": string, "open": number or null, "layers": object or null}
"open" is the number of the one numbered FACTS item the map should zoom to: the item they asked to see, or the item your answer leads with. Null only when your answer is not about any numbered item.
"layers" is only for when they ask to show or hide something on the map: "storms", "alerts", "news", "planes" or "ships", each true or false. Include only the ones they named and leave the rest out. Otherwise null.`;

const MAP_LAYERS = ['storms', 'alerts', 'news', 'planes', 'ships'];

// Answers a spoken question about what the full-screen map shows. `facts` is everything the
// answer may draw on. Returns what to say, which numbered fact to zoom to (or null), and
// which map layers to switch (or null).
export async function answerAloud({ question, facts, earlier = [] }) {
  const before = earlier.map((turn) => `They asked: ${turn.q}\nYou said: ${turn.a}`).join('\n');
  const raw = await askAi({ system: SPOKEN, temperature: 0.1, prompt: `FACTS\n${facts}\n\n${before ? `EARLIER IN THIS CONVERSATION\n${before}\n\n` : ''}THEY ASK NOW\n${question}` });
  // A layer is only switched off when the question asked for something to be hidden.
  const hiding = /\b(hide|off|remove|without|only|just|clear)\b/i.test(question);
  const layers = raw.layers && typeof raw.layers === 'object' ? Object.fromEntries(MAP_LAYERS.filter((id) => raw.layers[id] === true || (hiding && raw.layers[id] === false)).map((id) => [id, raw.layers[id]])) : {};
  return {
    say: withoutDisclaimers(String(raw.say || '')).slice(0, 700),
    open: Number.isInteger(raw.open) ? raw.open : null,
    layers: Object.keys(layers).length ? layers : null,
  };
}

// Reads a list of headlines and says which links on our map each one sets off, if any.
// Returns [{ news: index into `headlines`, links: [full link ids] }]. The companies are then
// read from the map, so the AI never names a stock here.
export async function matchNews(headlines) {
  const links = [...LINKS].map(([id, link]) => `${id}: ${link.chain[0]} > ${link.chain[link.chain.length - 1]}. Does not apply if: ${link.wrongIf}`);
  const result = await askAi({
    system: `You sort news for TradeWinds. You get a list of cause-and-effect links and a numbered list of news items.
For each news item, list the links it clearly sets off right now. Most news sets off none. Leave those items out.
Rules:
- Match only on what the item itself says. A court case, a speech, an election result or a protest is not a match unless the item says it changes trade, prices, travel or fighting.
- Use the place. A link about Taiwan, Texas or a canal applies only when the item is about that place.
- Skip a link when its "does not apply if" is true or probably true from what the item says. A storm that has weakened or passed sets off nothing. A disease outbreak reported in a single country sets off nothing; only one spreading across several countries counts.
- The event must be large enough to matter to big companies listed in the US. An attack on or near an oil-producing country or a major shipping route does count.
Reply with JSON only: {"matches": [{"news": number, "links": ["scenario/link"]}]}

LINKS
${links.join('\n')}`,
    prompt: headlines.map((text, i) => `${i + 1}. ${text.slice(0, 220)}`).join('\n'),
    // Sorting should give the same answer every time for the same headlines.
    temperature: 0,
  });
  return (Array.isArray(result.matches) ? result.matches : [])
    .map((m) => ({ news: Number(m.news) - 1, links: (Array.isArray(m.links) ? m.links : []).map(String).filter((id) => LINKS.has(id)) }))
    .filter((m) => Number.isInteger(m.news) && headlines[m.news] && m.links.length);
}

// Shown only when there is no AI key. It does not change with what the user types.
const SAMPLE = {
  summary: 'Sample: a hurricane makes landfall on the US Gulf Coast.',
  ideas: [
    { link: 'us-hurricane/home-repair', ticker: 'HD', reason: 'Home Depot sells plywood, tools and roofing, which people buy to fix storm damage.' },
    { link: 'us-hurricane/backup-power', ticker: 'GNRC', reason: 'Generac makes home generators, and orders tend to rise after large power outages.' },
    { link: 'us-hurricane/insurers', ticker: 'ALL', reason: 'Allstate insures homes and cars, so it pays for much of the damage.' },
  ],
  bonds: 'Towns that borrow money to rebuild can look like riskier borrowers for a while.',
  privateCompanies: 'More startup money may flow to companies working on storm prediction and backup power.',
  nextSteps: [
    'Check where the storm is forecast to land and how strong it will be.',
    'Look at how much each price has already moved this week.',
    'Find out how much of your savings sits in any one of these companies.',
  ],
  oddsQuery: 'hurricane landfall',
  newsQuery: 'hurricane Gulf Coast landfall',
};

// Returns the tidied analysis plus { sample: true } when no AI key is set.
export async function traceRipple({ observation, clarification, scenarioHint, earlier, owned, others, bullishNow, news }) {
  if (!hasAiKey()) return { ...tidy(SAMPLE), sample: true };
  const matched = scenarioLabel(scenarioHint) ? scenarioHint : null;
  const raw = await askAi({
    // When we already have the list of bullish signals, the map itself is not needed.
    system: instructions(bullishNow ? '(Not needed for this question.)' : mapAsText(matched)),
    prompt: buildPrompt({ observation, clarification, scenarioHint: matched, earlier, owned, others, bullishNow, news }),
  });
  return { ...tidy(raw, others), sample: false };
}
