'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Chat from '@/components/Chat';
import Home from '@/components/Home';
import Login from '@/components/Login';
import { GeopoliticalTab, HistoryTab, MapTab, PoliticsTab, SettingsTab } from '@/components/tabs';
import { StocksPage } from '@/components/Stocks';
import { applyMarketPrefs, applyPrefs, DEFAULT_PREFS, GEO_SECTIONS, groupGeo, hiddenCount, POLITICS_SECTIONS } from '@/lib/sections';

const PAGES = {
  home: ['Home', ''],
  login: ['Log in', ''],
  ask: ['Ask', ''],
  stocks: ['Top stocks', 'What is likely to go up or down, from what is happening in the world right now.'],
  geo: ['Geopolitical', 'What is happening in the world right now.'],
  politics: ['Politics and odds', 'What people expect to happen, and political events to analyze.'],
  map: ['Impact map', 'Every disruption we caught, on a globe. Tick the regions you care about and click a dot.'],
  history: ['History', 'Earlier questions and the answers TradeWinds gave.'],
  settings: ['Settings', 'Your portfolio and what you want to see.'],
};

const FIRST_SUB = { geo: 'storms', politics: 'overview' };
const PREFS_KEY = 'tradewinds-settings';
const PORTFOLIO_KEY = 'tradewinds-portfolio';
const GUEST_KEY = 'tradewinds-guest';

function Sidebar({ page, sub, onPage, status, signals, prefs, user, onLogout }) {
  const geo = groupGeo(signals);

  const item = (id, { count, expands } = {}) => (
    <button
      key={id}
      className={`${page === id ? 'active' : ''} ${expands ? 'expands' : ''} ${expands && page === id ? 'open' : ''}`}
      onClick={() => onPage(id)}
      aria-current={page === id ? 'page' : undefined}
      aria-expanded={expands ? page === id : undefined}
    >
      {PAGES[id][0]}
      {count > 0 && <span className="count">{count}</span>}
    </button>
  );

  const subItems = (id, sections, counts) => page === id && (
    <div className="subnav">
      {sections.map((s) => (
        <button key={s.id} className={sub === s.id ? 'active' : ''} onClick={() => onPage(id, s.id)}>
          {s.label}
          {counts && signals && <span className="count">{counts[s.id].length}</span>}
        </button>
      ))}
    </div>
  );

  const system = status && [
    ['AI', status.ai, 'connected', 'sample mode'],
    ['Prices', status.prices, 'connected', 'off'],
    ['History', status.database, 'Tiger Data', 'memory only'],
    ['Proof', status.solana, 'Solana devnet', 'off'],
  ];
  const filters = hiddenCount(prefs);

  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onPage('home')} aria-label="TradeWinds home">
        <b>TradeWinds</b>
        <span>Into the skies, into the markets</span>
      </button>
      <nav className="nav" aria-label="Sections">
        {item('ask')}
        {item('stocks')}
        <div className="nav-label">Happening now</div>
        {item('geo', { expands: true })}
        {subItems('geo', GEO_SECTIONS, geo)}
        {item('politics', { expands: true })}
        {subItems('politics', [{ id: 'overview', label: 'Overview' }, ...POLITICS_SECTIONS])}
        <div className="nav-label">Behind the answers</div>
        {item('map')}
        {item('history')}
        <div className="nav-label">You</div>
        {item('settings', { count: filters })}
      </nav>
      <div className="account">
        {user ? (
          <>
            <span className="account-who" title={user.email}>{user.email}</span>
            <button className="chip" onClick={onLogout}>Log out</button>
          </>
        ) : (
          <>
            <span className="account-who muted">Guest</span>
            <button className="chip" onClick={() => onPage('login')}>Log in</button>
          </>
        )}
      </div>
      {system && (
        <ul className="system">
          {system.map(([name, on, yes, no]) => (
            <li key={name}><b><span className={`dot ${on ? 'on' : ''}`} />{name}</b>{on ? yes : no}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}

let nextId = 1;

export default function App() {
  const [page, setPage] = useState('home');
  const [sub, setSub] = useState('');
  const [status, setStatus] = useState(null);
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [allSignals, setAllSignals] = useState(null);
  const [allMarkets, setAllMarkets] = useState(null);
  const [history, setHistory] = useState([]);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [portfolio, setPortfolio] = useState([]);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const last = useRef(null);

  const signals = useMemo(() => applyPrefs(allSignals, prefs), [allSignals, prefs]);
  const markets = useMemo(() => applyMarketPrefs(allMarkets, prefs), [allMarkets, prefs]);

  function loadHistory() {
    fetch('/api/history').then((r) => r.json()).then((d) => setHistory(d.items || [])).catch(() => {});
  }

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => {});
    fetch('/api/auth/me').then((r) => r.json()).then((d) => { setUser(d.user); setAccounts(d.available); }).catch(() => setAccounts(false));
    fetch('/api/signals').then((r) => r.json()).then(setAllSignals).catch(() => setAllSignals({ sky: [], news: [] }));
    fetch('/api/markets').then((r) => r.json()).then((d) => setAllMarkets(d.groups || [])).catch(() => setAllMarkets([]));
    loadHistory();

    try {
      const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY));
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...saved });
      const holdings = JSON.parse(window.localStorage.getItem(PORTFOLIO_KEY));
      if (Array.isArray(holdings)) setPortfolio(holdings);
    } catch {
    }

    const openFromAddress = () => {
      const [id, section] = window.location.hash.slice(1).split('/');
      const known = PAGES[id] ? id : 'home';
      setPage(known);
      setSub(section || FIRST_SUB[known] || '');
      if (known === 'history') loadHistory();
    };
    openFromAddress();
    window.addEventListener('hashchange', openFromAddress);
    return () => window.removeEventListener('hashchange', openFromAddress);
  }, []);

  function goTo(id, section) {
    const nextSub = section || FIRST_SUB[id] || '';
    setPage(id);
    setSub(nextSub);
    if (id === 'history') loadHistory();
    const address = id === 'home' ? window.location.pathname : `#${id}${nextSub && nextSub !== FIRST_SUB[id] ? `/${nextSub}` : ''}`;
    window.history.replaceState(null, '', address);
    window.scrollTo(0, 0);
  }

  function start() {
    let guest = false;
    try { guest = window.sessionStorage.getItem(GUEST_KEY) === '1'; } catch {  }
    goTo(user || guest ? 'ask' : 'login');
  }

  function enter(account) {
    setUser(account);
    if (!account) {
      try { window.sessionStorage.setItem(GUEST_KEY, '1'); } catch {  }
    }
    goTo('ask');
    setTimeout(loadHistory, 0);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    reset();
    loadHistory();
  }

  function changePrefs(next) {
    setPrefs(next);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
    }
  }

  function changePortfolio(next) {
    setPortfolio(next);
    try {
      if (next.length) window.localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(PORTFOLIO_KEY);
    } catch {
    }
  }

  function stopSpeaking() {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }

  function speak(message) {
    if (speakingId === message.id) return stopSpeaking();
    if (!window.speechSynthesis) return undefined;
    window.speechSynthesis.cancel();
    const words = new SpeechSynthesisUtterance(message.result.forecast);
    words.onend = () => setSpeakingId(null);
    words.onerror = () => setSpeakingId(null);
    setSpeakingId(message.id);
    window.speechSynthesis.speak(words);
    return undefined;
  }

  async function send(text, { scenario = '', label = '', fresh = false } = {}) {
    const message = text.trim();
    if (!message || busy) return;
    stopSpeaking();
    goTo('ask');

    const previous = fresh ? null : last.current;
    const request = { observation: message, scenario, portfolio: portfolio.map((h) => h.ticker) };
    if (previous?.result.needsClarification) {
      request.observation = previous.observation;
      request.scenario = previous.scenario;
      request.clarification = message;
    } else if (previous && !previous.result.sample) {
      request.earlier = { observation: previous.observation, summary: previous.result.summary };
    }

    const askId = nextId;
    const replyId = nextId + 1;
    nextId += 2;
    setMessages((all) => [
      ...all,
      { id: askId, role: 'user', text: message, label },
      { id: replyId, role: 'assistant', status: 'loading' },
    ]);
    setBusy(true);

    const finish = (update) => setMessages((all) => all.map((m) => (m.id === replyId ? { ...m, ...update } : m)));
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Something went wrong.');
      finish({ status: 'done', result });
      last.current = { observation: request.observation, scenario: request.scenario, result };
      loadHistory();
    } catch (err) {
      finish({ status: 'error', error: err.message });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    stopSpeaking();
    setMessages([]);
    last.current = null;
  }

  const pick = (item) => send(item.prompt, { scenario: item.scenario || '', label: item.title && item.title !== item.category ? item.title : item.text, fresh: true });
  const analyze = (text) => send(text, { fresh: true });

  if (page === 'home') {
    return <Home signals={signals} user={user} onStart={start} onPage={goTo} onPick={pick} />;
  }
  if (page === 'login') {
    return <Login available={accounts} onDone={enter} onGuest={() => enter(null)} onHome={() => goTo('home')} />;
  }

  return (
    <div className="app">
      <Sidebar page={page} sub={sub} onPage={goTo} status={status} signals={signals} prefs={prefs} user={user} onLogout={logout} />

      <div className="main">
        {page === 'ask' ? (
          <Chat
            messages={messages}
            busy={busy}
            signals={signals}
            portfolio={portfolio}
            onSend={send}
            onPick={pick}
            onReset={reset}
            speakingId={speakingId}
            onSpeak={speak}
          />
        ) : (
          <>
            <header className="page-head">
              <h1>{PAGES[page][0]}</h1>
              <p>{PAGES[page][1]}</p>
            </header>
            <main className="content">
              {page === 'stocks' && <StocksPage />}
              {page === 'geo' && <GeopoliticalTab signals={signals} sub={sub} onSub={(s) => goTo('geo', s)} loading={busy} onPick={pick} onPage={goTo} />}
              {page === 'politics' && <PoliticsTab signals={signals} markets={markets} sub={sub} onSub={(s) => goTo('politics', s)} loading={busy} onPick={pick} onSend={send} />}
              {page === 'map' && <MapTab signals={signals} loading={busy} onPick={pick} />}
              {page === 'history' && <HistoryTab history={history} loading={busy} onAnalyze={analyze} saved={status?.database} />}
              {page === 'settings' && <SettingsTab prefs={prefs} onChange={changePrefs} portfolio={portfolio} onPortfolio={changePortfolio} signals={signals} />}
            </main>
            <footer className="foot">
              TradeWinds gives ideas to research, not financial advice. It does not predict prices and uses public, delayed data.
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
