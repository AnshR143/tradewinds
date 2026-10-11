// How events are sorted into sections, and how the reader's settings filter them.
// Used by the sidebar, the pages and the Settings page, so they always agree.

// The kinds of events a reader can switch off in Settings.
export const KINDS = [
  { id: 'storms', label: 'Storms, fires and eruptions' },
  { id: 'alerts', label: 'US weather alerts' },
  { id: 'prices', label: 'Commodity prices' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'disasters', label: 'Disasters and accidents' },
  { id: 'health', label: 'Health and environment' },
  { id: 'diplomacy', label: 'Relations between countries' },
  { id: 'elections', label: 'Politics and elections' },
  { id: 'business', label: 'Business and the economy' },
];

const NEWS_KIND = {
  'Armed conflicts and attacks': 'conflicts',
  'Disasters and accidents': 'disasters',
  'Health and environment': 'health',
  'International relations': 'diplomacy',
  'Politics and elections': 'elections',
  'Business and economy': 'business',
};

export function kindId(item) {
  if (item.kind === 'news') return NEWS_KIND[item.category] || 'diplomacy';
  if (item.kind === 'commodity') return 'prices';
  return item.kind === 'weather' ? 'alerts' : 'storms';
}

export const GEO_SECTIONS = [
  { id: 'storms', label: 'Storms' },
  { id: 'alerts', label: 'Weather alerts' },
  { id: 'prices', label: 'Commodity prices' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'disasters', label: 'Disasters' },
  { id: 'other', label: 'Health and diplomacy' },
];

export const POLITICS_SECTIONS = [
  { id: 'world', label: 'World affairs' },
  { id: 'elections', label: 'Elections and government' },
  { id: 'economy', label: 'Economy' },
  { id: 'news', label: 'In the news' },
];

// Sorts everything on the Geopolitical page into its sections. A storm tracked from the
// sky and the news story about the same storm are one thing, so the story is attached to
// the storm instead of being listed again.
export function groupGeo(signals) {
  const sky = signals?.sky || [];
  const news = (signals?.news || []).filter((n) => n.group === 'geopolitical');
  const used = new Set();
  const storms = sky.filter((s) => s.kind !== 'weather' && s.kind !== 'commodity').map((s) => {
    const story = news.find((n) => n.title === s.title);
    if (story) used.add(story.id);
    return { ...s, story };
  });
  const rest = news.filter((n) => !used.has(n.id));
  return {
    storms,
    alerts: sky.filter((s) => s.kind === 'weather'),
    prices: sky.filter((s) => s.kind === 'commodity'),
    conflicts: rest.filter((n) => n.category === 'Armed conflicts and attacks'),
    disasters: rest.filter((n) => n.category === 'Disasters and accidents'),
    other: rest.filter((n) => n.category !== 'Armed conflicts and attacks' && n.category !== 'Disasters and accidents'),
  };
}

// ---- Settings ---------------------------------------------------------------------------

export const DEFAULT_PREFS = { hiddenKinds: [], hiddenRegions: [], hiddenTopics: [], mutedWords: '' };

function mutedList(prefs) {
  return prefs.mutedWords.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
}

function mentions(text, words) {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
}

// Removes the events the reader chose not to see.
export function applyPrefs(signals, prefs) {
  if (!signals) return signals;
  const words = mutedList(prefs);
  const keep = (item) =>
    !prefs.hiddenKinds.includes(kindId(item)) &&
    !(item.region && prefs.hiddenRegions.includes(item.region)) &&
    !mentions(`${item.title || ''} ${item.text || ''} ${item.where || ''}`, words);
  return { ...signals, sky: signals.sky.filter(keep), news: signals.news.filter(keep) };
}

export function applyMarketPrefs(groups, prefs) {
  if (!groups) return groups;
  const words = mutedList(prefs);
  return groups
    .filter((group) => !prefs.hiddenTopics.includes(group.id))
    .map((group) => ({ ...group, markets: group.markets.filter((m) => !mentions(m.question, words)) }))
    .filter((group) => group.markets.length > 0);
}

export function hiddenCount(prefs) {
  return prefs.hiddenKinds.length + prefs.hiddenRegions.length + prefs.hiddenTopics.length + mutedList(prefs).length;
}
