'use client';

// The pages reached from the sidebar, other than the chat.
import { useMemo, useState } from 'react';
import { SCENARIOS, scenarioLabel } from '@/data/impact-graph';
import { CHOKEPOINTS } from '@/data/chokepoints';
import { REGION_CENTERS, REGIONS, regionOf } from '@/data/places';
import Globe from '@/components/Globe';
import BigMap from '@/components/BigMap';
import { MapBars, OddsBars } from '@/components/charts';
import { NewsStocks } from '@/components/Stocks';
import { ago, Chain, KIND, SkeletonRows } from '@/components/bits';
import { DEFAULT_PREFS, GEO_SECTIONS, groupGeo, hiddenCount, KINDS, POLITICS_SECTIONS } from '@/lib/sections';
import { exposureNow, MAP_COMPANIES, parsePortfolio } from '@/lib/portfolio';

const DISRUPTION_COLOR = [0.92, 0.45, 0.1];
const CHOKEPOINT_COLOR = [0.11, 0.69, 0.96];
const CONFIDENCE = { strong: 'Strong link', likely: 'Likely link', guess: 'A guess' };

function kindOf(item) {
  return item.kind === 'news' ? item.category : KIND[item.kind] || item.kind;
}

const HURRICANE_MPH = 74;
const MAX_BAR_MPH = 160;

// One line in a list. Clicking it opens the details underneath, which hold the only button.
function Line({ open, onToggle, title, text, meta, children }) {
  return (
    <li className={`line ${open ? 'open' : ''}`}>
      <button className="line-head" onClick={onToggle} aria-expanded={open}>
        <span className="line-main">
          <strong>{title}</strong>
          {text && <span className="line-text">{text}</span>}
        </span>
        <span className="line-meta">{meta}</span>
      </button>
      {open && <div className="line-body">{children}</div>}
    </li>
  );
}

function Sources({ sources }) {
  return (
    <p className="muted small">
      Sources: {sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>{s.name}</a>)}
    </p>
  );
}

function AskButton({ item, loading, onPick, label = 'Ask what follows' }) {
  return <button className="btn small primary" disabled={loading} onClick={() => onPick(item)}>{label}</button>;
}

// News events as compact lines: a title, one line of text, and the place and date.
function NewsLines({ items, loading, onPick, empty }) {
  const [openId, setOpenId] = useState(null);
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="lines">
      {items.map((n) => (
        <Line
          key={n.id}
          open={openId === n.id}
          onToggle={() => setOpenId(openId === n.id ? null : n.id)}
          // Events without a headline of their own show their text once, not twice.
          title={n.title !== n.category ? n.title : n.text}
          text={n.title !== n.category ? n.text : null}
          meta={<>{n.where && <span>{n.where}</span>}<span className="muted">{new Date(`${n.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></>}
        >
          <p>{n.text}</p>
          <Sources sources={n.sources} />
          <AskButton item={n} loading={loading} onPick={onPick} />
        </Line>
      ))}
    </ul>
  );
}

// ---- Geopolitical -------------------------------------------------------------------------

function NaturalLines({ items, loading, onPick }) {
  const [openId, setOpenId] = useState(null);
  if (!items.length) return <p className="muted">No storms, fires or eruptions are being tracked right now.</p>;
  return (
    <>
      <ul className="lines">
        {items.map((s) => (
          <Line
            key={s.id}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            title={s.title}
            text={s.near?.length ? `${s.near[0].km} km from the ${s.near[0].name}` : s.where.replace(/ \(.*\)$/, '')}
            meta={s.windMph ? (
              <span className="wind">
                <span className="hbar-track marked" style={{ '--mark': `${(HURRICANE_MPH / MAX_BAR_MPH) * 100}%` }}>
                  <span className={`hbar-fill ${s.windMph >= HURRICANE_MPH ? 'strong' : ''}`} style={{ width: `${Math.min(100, (s.windMph / MAX_BAR_MPH) * 100)}%` }} />
                </span>
                <b>{s.windMph} mph</b>
              </span>
            ) : <span>{s.detail}</span>}
          >
            <p>{s.where}. {s.detail}.</p>
            {s.near?.length > 0 && <p>{s.near.map((p) => `${p.km} km from the ${p.name}, ${p.why}`).join('. ')}.</p>}
            {s.story && <p><b>In the news:</b> {s.story.text}</p>}
            <p className="muted small">{s.source}, {ago(s.time)}.{scenarioLabel(s.scenario) ? ` Matched to: ${scenarioLabel(s.scenario)}.` : ''}</p>
            <AskButton item={s} loading={loading} onPick={onPick} />
          </Line>
        ))}
      </ul>
      <p className="muted small" style={{ marginTop: 10 }}>The line on each bar marks {HURRICANE_MPH} mph, where a storm counts as a hurricane.</p>
    </>
  );
}

function PriceLines({ items, loading, onPick }) {
  const [openId, setOpenId] = useState(null);
  if (!items.length) return <p className="muted">Commodity prices are not available right now.</p>;
  return (
    <ul className="lines">
      {items.map((p) => (
        <Line
          key={p.id}
          open={openId === p.id}
          onToggle={() => setOpenId(openId === p.id ? null : p.id)}
          title={p.title}
          text={p.detail}
          meta={<span className={p.monthPct >= 0 ? 'up' : 'down'}>{p.monthPct >= 0 ? 'Up' : 'Down'} {Math.abs(p.monthPct).toFixed(1)}%</span>}
        >
          <p>{p.detail}.</p>
          <p className="muted small">
            {p.source}, as of {new Date(p.time).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
            {scenarioLabel(p.scenario) ? ` Matched to: ${scenarioLabel(p.scenario)}.` : ' A rise of 5% or more in a month counts as a signal.'}
          </p>
          <AskButton item={p} loading={loading} onPick={onPick} />
        </Line>
      ))}
    </ul>
  );
}

function AlertLines({ items, loading, onPick }) {
  const [openId, setOpenId] = useState(null);
  if (!items.length) return <p className="muted">No severe weather alerts in the US right now.</p>;
  return (
    <ul className="lines">
      {items.map((a) => (
        <Line
          key={a.id}
          open={openId === a.id}
          onToggle={() => setOpenId(openId === a.id ? null : a.id)}
          title={a.title}
          text={a.where}
          meta={<span>{a.detail}</span>}
        >
          <p>{a.title} in effect for {a.where}.</p>
          <p className="muted small">{a.source}, first issued {ago(a.time)}.{scenarioLabel(a.scenario) ? ` Matched to: ${scenarioLabel(a.scenario)}.` : ''}</p>
          <AskButton item={a} loading={loading} onPick={onPick} />
        </Line>
      ))}
    </ul>
  );
}

// A row of section buttons, shown only on small screens where the sidebar dropdown is hidden.
function SmallScreenTabs({ sections, active, onChange, counts }) {
  return (
    <div className="tabs only-small" role="tablist">
      {sections.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} className={active === t.id ? 'active' : ''} onClick={() => onChange(t.id)}>
          {t.label}{counts?.[t.id] !== undefined ? <span className="muted"> {counts[t.id]}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function GeopoliticalTab({ signals, sub, onSub, loading, onPick, onPage }) {
  const groups = groupGeo(signals);
  const section = GEO_SECTIONS.find((g) => g.id === sub) || GEO_SECTIONS[0];
  const items = groups[section.id];
  const counts = Object.fromEntries(GEO_SECTIONS.map((g) => [g.id, groups[g.id].length]));

  return (
    <>
      <SmallScreenTabs sections={GEO_SECTIONS} active={section.id} onChange={onSub} counts={signals ? counts : undefined} />
      {signals?.skyNote && (section.id === 'storms') && <p className="notice" style={{ marginBottom: 14 }}>{signals.skyNote}</p>}

      <div className="section-head">
        <h2>{section.label} <span className="muted">{signals ? items.length : ''}</span></h2>
        <button className="chip" onClick={() => onPage('map')}>See on the globe</button>
      </div>

      <div className="card">
        {!signals && <SkeletonRows count={2} />}
        {signals && section.id === 'storms' && <NaturalLines items={items} loading={loading} onPick={onPick} />}
        {signals && section.id === 'alerts' && <AlertLines items={items} loading={loading} onPick={onPick} />}
        {signals && section.id === 'prices' && <PriceLines items={items} loading={loading} onPick={onPick} />}
        {signals && ['conflicts', 'disasters', 'other'].includes(section.id) && (
          <NewsLines items={items} loading={loading} onPick={onPick} empty="Nothing here in the last few days." />
        )}
      </div>

      {signals && ['conflicts', 'disasters', 'other'].includes(section.id) && items.length > 0 && <NewsStocks key={section.id} news={items} />}

      <p className="muted small" style={{ marginTop: 12 }}>
        Click any line for details.
        {!['storms', 'alerts', 'prices'].includes(section.id) && (
          <> News comes from Wikipedia&rsquo;s <a href="https://en.wikipedia.org/wiki/Portal:Current_events" target="_blank" rel="noreferrer">Current events</a> page.</>
        )}
      </p>
    </>
  );
}

// ---- Politics and odds --------------------------------------------------------------------

function MarketCard({ market, loading, onAsk }) {
  return (
    <div className="card market">
      <h3>{market.question}</h3>
      <OddsBars outcomes={market.outcomes} />
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <span className="muted small">
          {market.closes ? `Decided by ${new Date(`${market.closes}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
        </span>
        <button className="btn small" disabled={loading} onClick={() => onAsk(market)}>Who would this move?</button>
      </div>
    </div>
  );
}

// One market at a time, with arrows to step through the rest.
function MarketStepper({ markets, loading, onAsk }) {
  const [at, setAt] = useState(0);
  const index = Math.min(at, markets.length - 1);
  const step = (by) => setAt((index + by + markets.length) % markets.length);
  return (
    <div className="stepper">
      <MarketCard market={markets[index]} loading={loading} onAsk={onAsk} />
      {markets.length > 1 && (
        <div className="stepper-controls">
          <button className="arrow" onClick={() => step(-1)} aria-label="Previous">←</button>
          <span className="muted small">{index + 1} of {markets.length}</span>
          <button className="arrow" onClick={() => step(1)} aria-label="Next">→</button>
        </div>
      )}
    </div>
  );
}

export function PoliticsTab({ signals, markets, sub, onSub, loading, onPick, onSend }) {
  const events = (signals?.news || []).filter((n) => n.group === 'politics');
  const group = (markets || []).find((g) => g.id === sub);

  function askAbout(market) {
    const top = market.outcomes[0];
    const outcome = top.label === 'Yes' ? 'yes' : top.label;
    onSend(
      `Prediction markets are asking: "${market.question}" The most likely answer right now is ${outcome}, at ${top.chance}. If that happens, who is helped and who is hurt?`,
      { label: market.question, fresh: true },
    );
  }

  const source = <p className="muted small" style={{ marginTop: 18 }}>Odds are from Polymarket.</p>;
  const smallTabs = <SmallScreenTabs sections={[{ id: 'overview', label: 'Overview' }, ...POLITICS_SECTIONS]} active={sub} onChange={onSub} />;

  // Everything in one topic.
  if (group) {
    return (
      <>
        {smallTabs}
        <div className="section-head">
          <h2>{group.label} <span className="muted">{group.markets.length}</span></h2>
          <button className="chip" onClick={() => onSub('overview')}>Back to overview</button>
        </div>
        <div className="market-grid">
          {group.markets.map((market) => <MarketCard key={market.url} market={market} loading={loading} onAsk={askAbout} />)}
        </div>
        {source}
      </>
    );
  }

  // All the political news.
  if (sub === 'news') {
    return (
      <>
        {smallTabs}
        <div className="section-head">
          <h2>In the news <span className="muted">{signals ? events.length : ''}</span></h2>
          <button className="chip" onClick={() => onSub('overview')}>Back to overview</button>
        </div>
        <div className="card">
          {signals ? <NewsLines items={events} loading={loading} onPick={onPick} empty="No political events in the last few days." /> : <SkeletonRows count={2} />}
        </div>
        {events.length > 0 && <NewsStocks news={events} />}
      </>
    );
  }

  // Overview: one market from each topic, and the newest few events.
  return (
    <>
      {smallTabs}
      {!markets && <SkeletonRows count={3} />}
      {markets && markets.length === 0 && <p className="muted">No prediction markets to show right now.</p>}
      {(markets || []).map((topic) => (
        <section key={topic.id} className="topic">
          <div className="section-head">
            <h2>{topic.label}</h2>
            <button className="chip" onClick={() => onSub(topic.id)}>See all {topic.markets.length}</button>
          </div>
          <MarketStepper markets={topic.markets} loading={loading} onAsk={askAbout} />
        </section>
      ))}

      {signals && events.length > 0 && (
        <section className="topic">
          <div className="section-head">
            <h2>In the news</h2>
            <button className="chip" onClick={() => onSub('news')}>See all {events.length}</button>
          </div>
          <div className="card">
            <NewsLines items={events.slice(0, 3)} loading={loading} onPick={onPick} empty="" />
          </div>
          <NewsStocks news={events} />
        </section>
      )}
      {markets && markets.length > 0 && source}
    </>
  );
}

// ---- Impact map ---------------------------------------------------------------------------

function LinkCard({ link }) {
  return (
    <div className={`card ${link.direction}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className={`tag ${link.direction}`}>{link.direction === 'tailwind' ? 'Tailwind' : 'Headwind'}</span>
        <span className="muted small">{CONFIDENCE[link.confidence]}, over {link.horizon}</span>
      </div>
      <Chain steps={link.chain} direction={link.direction} />
      <div className="row">
        {link.companies.map((c) => <span key={c.ticker} className="ticker">{c.ticker} · {c.name}</span>)}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}><b>Wrong if:</b> {link.wrongIf}</p>
    </div>
  );
}

const CHOKEPOINT_ITEMS = CHOKEPOINTS.map((p, i) => ({
  id: `port-${i}`,
  kind: 'chokepoint',
  title: p.name,
  detail: p.why,
  lat: p.lat,
  lon: p.lon,
  region: regionOf(p.lat, p.lon),
}));

export function MapTab({ signals, loading, onPick }) {
  const [regions, setRegions] = useState(() => new Set(REGIONS));
  const [showPorts, setShowPorts] = useState(true);
  const [selected, setSelected] = useState(null);
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [expanded, setExpanded] = useState(false);

  // The big map takes the whole screen. The request has to be made inside the click.
  function expand() {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setExpanded(true);
  }

  // Everything we caught that can be placed on the map.
  const caught = useMemo(() => [
    ...(signals?.sky || []),
    ...(signals?.news || []).filter((n) => n.lat !== null),
  ], [signals]);

  const visible = caught.filter((d) => regions.has(d.region));
  const ports = showPorts ? CHOKEPOINT_ITEMS.filter((p) => regions.has(p.region)) : [];
  const countIn = (region) => caught.filter((d) => d.region === region).length;

  const regionKey = [...regions].sort().join('|');
  // Memoized so the globe is only rebuilt when the dots themselves change.
  const markers = useMemo(() => [
    ...ports.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, size: 0.02, color: CHOKEPOINT_COLOR, name: p.title, item: p })),
    ...visible.map((d, i) => ({
      id: `caught-${i}`,
      lat: d.lat,
      lon: d.lon,
      size: 0.05,
      color: DISRUPTION_COLOR,
      name: d.title !== d.category ? d.title : d.text.slice(0, 48),
      item: d,
    })),
  ], [signals, regionKey, showPorts]); // eslint-disable-line react-hooks/exhaustive-deps

  const arcs = useMemo(() => visible.flatMap((d, i) =>
    (d.near || []).map((p, j) => ({ id: `arc-${i}-${j}`, from: [d.lat, d.lon], to: [p.lat, p.lon] })),
  ), [signals, regionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(region) {
    const next = new Set(regions);
    if (next.has(region)) next.delete(region);
    else next.add(region);
    setRegions(next);
    setSelected(null);
  }

  // Turn to the selected dot, or to the region when only one is ticked.
  let focus = null;
  if (selected) focus = { lat: selected.lat, lon: selected.lon };
  else if (regions.size === 1) focus = REGION_CENTERS[[...regions][0]];

  const selectedMarker = selected && markers.find((m) => m.item === selected);
  const scenario = selected?.scenario ? SCENARIOS.find((s) => s.id === selected.scenario) : null;
  const browsing = SCENARIOS.find((s) => s.id === scenarioId);

  return (
    <>
      <div className="card filters">
        <span className="kind">Show regions</span>
        {REGIONS.map((region) => (
          <label key={region} className="check">
            <input type="checkbox" checked={regions.has(region)} onChange={() => toggle(region)} />
            {region} <span className="muted">{signals ? countIn(region) : ''}</span>
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={showPorts} onChange={() => setShowPorts(!showPorts)} />
          Choke points
        </label>
        <button className="chip" onClick={() => { setRegions(new Set(regions.size === REGIONS.length ? [] : REGIONS)); setSelected(null); }}>
          {regions.size === REGIONS.length ? 'Clear all' : 'Select all'}
        </button>
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <div>
          <div className="card globe-card">
            <button className="btn primary small globe-expand" onClick={expand}>Expand map</button>
            <Globe markers={markers} arcs={arcs} focus={focus} selectedId={selectedMarker?.id} onSelect={(m) => setSelected(m.item)} />
            <div className="legend">
              <span><i style={{ background: 'rgb(235,115,26)' }} />Disruption</span>
              <span><i style={{ background: 'rgb(28,176,246)' }} />Choke point</span>
              <span>Click a dot, or drag to turn</span>
            </div>
          </div>
        </div>

        <div>
          {selected ? (
            <div className="card detail">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="kind">{selected.kind === 'chokepoint' ? 'Choke point' : kindOf(selected)}{selected.region ? ` · ${selected.region}` : ''}</span>
                <button className="chip" onClick={() => setSelected(null)}>Back to the list</button>
              </div>
              <h3>{selected.title}</h3>
              <p>{selected.kind === 'news' ? selected.text : selected.kind === 'chokepoint' ? `This is ${selected.detail}.` : `${selected.where}. ${selected.detail}.`}</p>
              {selected.near?.length > 0 && (
                <p className="near">{selected.near.map((p) => `${p.km} km from the ${p.name}, ${p.why}`).join('. ')}.</p>
              )}
              {selected.kind !== 'chokepoint' && (
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn primary small" disabled={loading} onClick={() => onPick(selected)}>Ask what follows</button>
                  {scenario && <span className="muted small">Matched to: {scenario.label}</span>}
                </div>
              )}
              {scenario && (
                <div style={{ marginTop: 14 }}>
                  {scenario.links.map((link) => <LinkCard key={link.id} link={link} />)}
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="card-title">Disruptions caught <span className="muted">{signals ? visible.length : ''}</span></div>
              {!signals && <SkeletonRows count={3} />}
              {signals && visible.length === 0 && <p className="muted">Nothing caught in the regions you ticked.</p>}
              <ul className="caught">
                {visible.map((d) => (
                  <li key={d.id}>
                    <button onClick={() => setSelected(d)}>
                      <span className="kind">{kindOf(d)} · {d.region}</span>
                      <strong>{d.title !== d.category ? d.title : d.text.slice(0, 70)}</strong>
                      <span className="muted small">{d.kind === 'news' ? d.where : d.detail}{scenarioLabel(d.scenario) ? ' · on the impact map' : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {expanded && <BigMap signals={signals} loading={loading} onPick={onPick} onClose={() => setExpanded(false)} />}

      <div className="section-title" style={{ marginTop: 34 }}>
        <h2>The full impact map</h2>
        <span className="muted small">Every kind of disruption we mapped by hand, and the chain from each to real companies.</span>
      </div>
      <div className="map-split">
        <div className="card">
          <div className="card-title">Pick a disruption</div>
          <div className="scenario-list">
            {SCENARIOS.map((s) => (
              <button key={s.id} className={s.id === scenarioId ? 'active' : ''} onClick={() => setScenarioId(s.id)}>{s.short}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="muted" style={{ marginBottom: 10 }}>{browsing.label}</p>
          {browsing.links.map((link) => <LinkCard key={link.id} link={link} />)}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-title">The map at a glance</div>
        <p className="muted small" style={{ marginBottom: 12 }}>How many cause-and-effect chains we built for each kind of disruption.</p>
        <MapBars rows={SCENARIOS.map((s) => ({ label: s.short, value: s.links.length }))} />
      </div>
    </>
  );
}

// ---- History ------------------------------------------------------------------------------

function dayLabel(time) {
  const day = new Date(time);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// The same question asked several times shows once, with its newest answer.
function withoutRepeats(history) {
  const seen = new Map();
  for (const item of history) {
    const key = item.observation.trim().toLowerCase();
    if (seen.has(key)) seen.get(key).times += 1;
    else seen.set(key, { ...item, times: 1 });
  }
  return [...seen.values()];
}

function Tickers({ ideas, direction }) {
  const picked = ideas.filter((i) => i.direction === direction);
  if (!picked.length) return <span className="muted">None</span>;
  return picked.map((i) => <span key={i.ticker} className={`tag ${direction}`} title={i.name}>{i.ticker}</span>);
}

// Each answer's fingerprint is stamped on Solana when it is given. This lets a reader check
// that the answer shown here is the same one that was stamped.
function Proof({ item }) {
  const [check, setCheck] = useState(null);
  if (!item.proof) return null;

  async function verify() {
    setCheck({ status: 'checking' });
    try {
      const res = await fetch(`/api/verify?time=${encodeURIComponent(new Date(item.time).toISOString())}`);
      setCheck(await res.json());
    } catch {
      setCheck({ status: 'error' });
    }
  }

  const stampedAt = check?.stampedAt ? new Date(check.stampedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  const message = {
    checking: 'Checking…',
    matches: `Unchanged since it was stamped at ${stampedAt}.`,
    changed: 'This answer does not match its stamp. It was changed after it was given.',
    'not-found-on-chain': 'The stamp could not be found on Solana yet.',
    error: 'Could not reach Solana just now.',
  }[check?.status];

  return (
    <span className="proof muted small">
      <a href={item.proof} target="_blank" rel="noreferrer">Stamped on Solana</a>
      {message ? <span> · {message}</span> : <button className="link" onClick={verify}>Check it</button>}
    </span>
  );
}

export function HistoryTab({ history, loading, onAnalyze, saved }) {
  if (!history.length) {
    return <p className="muted">Nothing yet. Every question you ask is saved here with its time.</p>;
  }
  const items = withoutRepeats(history);
  const days = [...new Set(items.map((item) => dayLabel(item.time)))];

  return (
    <>
      <p className="muted small" style={{ marginBottom: 6 }}>
        {saved ? 'Saved in Tiger Data with the time of each answer. Each one is also stamped on Solana, so it can be shown later that the answer was not edited after the fact.' : 'Kept in memory until the app restarts.'}
      </p>
      {days.map((day) => (
        <div key={day}>
          <div className="section-title"><h2>{day}</h2></div>
          <div className="card history">
            <div className="history-row head">
              <span>Time</span><span>What happened</span><span>Helped</span><span>Hurt</span><span />
            </div>
            {items.filter((item) => dayLabel(item.time) === day).map((item, i) => (
              <div key={i} className="history-row">
                <span className="muted">{new Date(item.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                <span>
                  <b>{item.summary}</b>
                  <span className="muted small asked">
                    You asked: {item.observation.length > 110 ? `${item.observation.slice(0, 110)}…` : item.observation}
                    {item.times > 1 ? ` (asked ${item.times} times)` : ''}
                  </span>
                  <Proof item={item} />
                </span>
                <span className="row tight"><Tickers ideas={item.ideas} direction="tailwind" /></span>
                <span className="row tight"><Tickers ideas={item.ideas} direction="headwind" /></span>
                <span><button className="btn small" disabled={loading} onClick={() => onAnalyze(item.observation)}>Ask again</button></span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ---- Settings -----------------------------------------------------------------------------

function CheckList({ title, note, options, hidden, onToggle }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {note && <p className="muted small" style={{ marginBottom: 10 }}>{note}</p>}
      <div className="check-grid">
        {options.map((option) => (
          <label key={option.id} className="check">
            <input type="checkbox" checked={!hidden.includes(option.id)} onChange={() => onToggle(option.id)} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

const MAX_FILE_BYTES = 200000;

function PortfolioCard({ portfolio, onPortfolio, signals }) {
  const [problem, setProblem] = useState('');
  const onMap = portfolio.filter((h) => MAP_COMPANIES.has(h.ticker));
  const offMap = portfolio.filter((h) => !MAP_COMPANIES.has(h.ticker));
  const touching = exposureNow(signals, portfolio);

  async function read(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setProblem('That file is too large. Use a short text file with one holding per line.');
      return;
    }
    const holdings = parsePortfolio(await file.text());
    if (!holdings.length) {
      setProblem('We could not find any ticker symbols in that file. Put one per line, like "CCL 40".');
      return;
    }
    setProblem('');
    onPortfolio(holdings);
  }

  const chip = (h) => <span key={h.ticker} className="ticker">{h.ticker}{h.shares ? ` · ${h.shares} shares` : ''}</span>;

  return (
    <div className="card">
      <div className="card-title">Your portfolio</div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Upload a text file with one holding per line, like &ldquo;CCL 40&rdquo;. Every answer will then show which of your
        holdings an event touches. The file stays in this browser. When you ask a question, only the ticker symbols
        are sent along, never the share counts.
      </p>
      <div className="row">
        <label className="btn">
          {portfolio.length ? 'Upload a different file' : 'Upload a text file'}
          <input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={read} hidden />
        </label>
        {portfolio.length > 0 && <button className="btn" onClick={() => onPortfolio([])}>Remove portfolio</button>}
      </div>
      {problem && <p className="error small" style={{ marginTop: 10 }}>{problem}</p>}

      {portfolio.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {onMap.length > 0 && (
            <>
              <div className="kind" style={{ marginBottom: 6 }}>On our impact map ({onMap.length})</div>
              <div className="row tight">{onMap.map(chip)}</div>
            </>
          )}
          {offMap.length > 0 && (
            <>
              <div className="kind" style={{ margin: '12px 0 6px' }}>Not on our map, so we cannot analyze these yet ({offMap.length})</div>
              <div className="row tight">{offMap.map(chip)}</div>
            </>
          )}

          <div className="kind" style={{ margin: '18px 0 6px' }}>What touches it right now</div>
          {touching.length === 0 ? (
            <p className="muted small">Nothing happening right now touches your holdings on our map.</p>
          ) : (
            <table>
              <thead><tr><th>Holding</th><th>Event</th><th>Effect</th></tr></thead>
              <tbody>
                {touching.map((row, i) => (
                  <tr key={i}>
                    <td><b>{row.ticker}</b> <span className="muted">{row.name}</span></td>
                    <td>{row.event}</td>
                    <td><span className={`tag ${row.direction}`}>{row.direction === 'tailwind' ? 'Tailwind' : 'Headwind'}</span> {row.effect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export function SettingsTab({ prefs, onChange, portfolio, onPortfolio, signals }) {
  const flip = (key) => (id) => {
    const list = prefs[key];
    onChange({ ...prefs, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };
  const count = hiddenCount(prefs);

  return (
    <div className="settings">
      <PortfolioCard portfolio={portfolio} onPortfolio={onPortfolio} signals={signals} />

      <div className="section-title"><h2>What you see</h2></div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Untick anything you do not want to see. It disappears from every page, including the globe.
      </p>
      <CheckList title="Kinds of events" options={KINDS} hidden={prefs.hiddenKinds} onToggle={flip('hiddenKinds')} />
      <CheckList
        title="Regions"
        note="Events we could not place on the map are always shown."
        options={REGIONS.map((r) => ({ id: r, label: r }))}
        hidden={prefs.hiddenRegions}
        onToggle={flip('hiddenRegions')}
      />
      <CheckList
        title="Prediction market topics"
        options={POLITICS_SECTIONS.filter((t) => t.id !== 'news')}
        hidden={prefs.hiddenTopics}
        onToggle={flip('hiddenTopics')}
      />

      <div className="card">
        <label className="card-title" htmlFor="muted-words" style={{ display: 'block' }}>Hide anything that mentions</label>
        <p className="muted small" style={{ marginBottom: 10 }}>Words or names, separated by commas. For example: tennis, Musk.</p>
        <input
          id="muted-words"
          className="text-input"
          type="text"
          value={prefs.mutedWords}
          onChange={(e) => onChange({ ...prefs, mutedWords: e.target.value })}
          placeholder="Nothing hidden"
        />
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => onChange(DEFAULT_PREFS)} disabled={count === 0}>Show everything again</button>
        <span className="muted small">{count === 0 ? 'Nothing is hidden.' : `${count} ${count === 1 ? 'filter is' : 'filters are'} on.`}</span>
      </div>
    </div>
  );
}
