'use client';

import { useState } from 'react';
import { Tabs } from '@/components/bits';
import { money } from '@/lib/moves';
import { OddsBars } from '@/components/charts';
import Sizer from '@/components/Sizer';
import { StockList } from '@/components/Stocks';

function NewsItems({ items }) {
  return (
    <ul className="rows">
      {items.map((item, i) => (
        <li key={i}>
          {item.date && <div className="kind">{item.date}</div>}
          {item.text}{' '}
          <span className="small">
            {item.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">({s.name}) </a>)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Evidence({ result }) {
  const [more, setMore] = useState(null);

  async function findMore() {
    setMore('searching');
    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: result.newsQuery || result.summary, already: result.news.map((n) => n.text) }),
      });
      setMore(await res.json());
    } catch {
      setMore({ items: [], searched: [] });
    }
  }

  return (
    <div className="stack">
      {result.odds.length > 0 && (
        <div className="card">
          <div className="card-title">How likely people think it is</div>
          <ul className="rows">
            {result.odds.map((market) => (
              <li key={market.url}>
                <a href={market.url} target="_blank" rel="noreferrer">{market.question}</a>
                <OddsBars outcomes={market.outcomes} />
              </li>
            ))}
          </ul>
          <p className="muted small" style={{ marginTop: 10 }}>Odds are from Polymarket.</p>
        </div>
      )}

      <div className="card">
        <div className="card-title">What is happening</div>
        <p style={{ marginBottom: 16 }}>{result.summary}</p>
        <div className="card-title">News this is based on</div>
        {result.news.length > 0 ? <NewsItems items={result.news} /> : <p className="muted">No matching news was found the first time.</p>}

        {more?.items?.length > 0 && (
          <>
            <div className="card-title" style={{ marginTop: 18 }}>More news</div>
            <NewsItems items={more.items} />
          </>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          {(more === null || more === 'searching') && (
            <button className="btn small" onClick={findMore} disabled={more === 'searching'}>
              {more === 'searching' ? 'Searching…' : 'Find more news'}
            </button>
          )}
          {more?.items && (
            <span className="muted small">
              {more.items.length === 0 ? 'No more news found right now.' : `Found ${more.items.length} more.`}
              {more.searched?.length > 0 && ` Searched ${more.searched.join(' and ')}.`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const READS = {
  up: { label: 'Likely up', tag: 'tailwind' },
  down: { label: 'Likely down', tag: 'headwind' },
  mixed: { label: 'Mixed', tag: 'plain' },
  none: { label: 'No clear effect', tag: 'plain' },
};

function Portfolio({ holdings, portfolio }) {
  const shares = new Map(portfolio.map((h) => [h.ticker, h.shares]));
  const up = holdings.exposed.filter((h) => h.direction === 'tailwind');
  const down = holdings.exposed.filter((h) => h.direction === 'headwind');
  const held = (list) => list.reduce((sum, h) => sum + (h.price?.status === 'ok' ? (shares.get(h.ticker) || 0) * h.price.price : 0), 0);

  return (
    <div className="stack">
      {holdings.exposed.length === 0 ? (
        <div className="card">
          <p>None of your holdings are on the part of our map that this event touches.</p>
        </div>
      ) : (
        <div className="card">
          <div className="money-split">
            <div className="tailwind"><b>{money(held(up))}</b><span>of yours is in stocks likely to go up</span></div>
            <div className="headwind"><b>{money(held(down))}</b><span>of yours is in stocks likely to go down</span></div>
          </div>
          <div className="stock-groups">
            <StockList direction="tailwind" stocks={up} shares={shares} empty="None of your stocks." />
            <StockList direction="headwind" stocks={down} shares={shares} empty="None of your stocks." />
          </div>
        </div>
      )}
      {holdings.reads?.length > 0 && (
        <div className="card">
          <div className="card-title">Your other holdings</div>
          <p className="muted small">These are not on our map, so this is the AI&rsquo;s own read. Not checked.</p>
          <ul className="rows" style={{ marginTop: 12 }}>
            {holdings.reads.map((r) => (
              <li key={r.ticker} className="read-row">
                <span className="ticker">{r.ticker}</span>
                <span>{r.why}</span>
                <span className={`tag ${READS[r.effect].tag}`}>{READS[r.effect].label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(holdings.untouched.length > 0 || holdings.offMap.length > 0) && (
        <div className="card">
          {holdings.untouched.length > 0 && <p><b>Not touched by this event:</b> {holdings.untouched.join(', ')}</p>}
          {holdings.offMap.length > 0 && <p style={{ marginTop: 6 }}><b>Not on our impact map, so we cannot say:</b> {holdings.offMap.join(', ')}</p>}
        </div>
      )}
    </div>
  );
}

function Steps({ result }) {
  return (
    <div className="card">
      <div className="card-title">What you can do next</div>
      <ol className="steps-list">
        {result.nextSteps.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </div>
  );
}

function Beyond({ result }) {
  return (
    <div className="card">
      <ul className="rows">
        <li>
          <div className="card-title" style={{ marginBottom: 2 }}>Bonds</div>
          <p className="muted small">Loans to governments or companies.</p>
          <p>{result.bonds || 'Nothing specific for this one.'}</p>
        </li>
        <li>
          <div className="card-title" style={{ marginBottom: 2 }}>Startups and private companies</div>
          <p className="muted small">A guess. These have no daily price to check against.</p>
          <p>{result.privateCompanies || 'Nothing specific for this one.'}</p>
        </li>
      </ul>
    </div>
  );
}

export default function Answer({ result, portfolio = [], onAnswer, onSpeak, speaking }) {
  const touched = result.holdings?.exposed.length || 0;
  const reads = (result.holdings?.reads || []).filter((r) => r.effect !== 'none').length;
  const [tab, setTab] = useState(touched || reads ? 'portfolio' : null);

  if (result.needsClarification) {
    return (
      <div className="card">
        <div className="kind">One question first</div>
        <p className="summary" style={{ marginTop: 4 }}>{result.question}</p>
        <div className="row" style={{ marginTop: 14 }}>
          {result.options.map((option) => (
            <button key={option} className="btn" onClick={() => onAnswer(option)}>{option}</button>
          ))}
        </div>
      </div>
    );
  }

  const up = result.ideas.filter((i) => i.direction === 'tailwind');
  const down = result.ideas.filter((i) => i.direction === 'headwind');
  const evidenceCount = result.odds.length + result.news.length;
  const owned = new Set((result.holdings?.exposed || []).map((h) => h.ticker));
  const live = result.board ? result.board.bullish.length + result.board.bearish.length : 0;

  return (
    <>
      {result.sample && (
        <p className="notice" style={{ marginBottom: 12 }}>
          Sample answer. No AI key is connected, so this does not reflect what you typed.
        </p>
      )}
      <div className="card">
        <p className="summary">{result.reply || result.summary}</p>
        {result.holdings && (
          <p className="summary-meta">
            {touched === 0 ? 'None' : touched} of your {result.holdings.total} holdings {touched === 1 ? 'is' : 'are'} on our map for this.{reads > 0 && ` The AI has a read on ${reads} more, below.`}
          </p>
        )}
        {result.ideas.length > 0 ? (
          <div className="stock-groups">
            <StockList direction="tailwind" stocks={up} owned={owned} empty="Nothing on our map goes up from this." />
            <StockList direction="headwind" stocks={down} owned={owned} empty="Nothing on our map goes down from this." />
          </div>
        ) : <p className="summary-meta">No clear signal. Nothing obvious follows for any company.</p>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={onSpeak}>{speaking ? 'Stop reading' : 'Read it to me'}</button>
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={(id) => setTab(tab === id ? null : id)}
        tabs={[
          ...(result.holdings ? [{ id: 'portfolio', label: `Your stocks (${touched + reads})` }] : []),
          ...(result.board ? [{ id: 'board', label: `All live signals (${live})` }] : []),
          ...(result.nextSteps.length ? [{ id: 'steps', label: 'Next steps' }] : []),
          { id: 'evidence', label: `Evidence (${evidenceCount})` },
          { id: 'beyond', label: 'Beyond stocks' },
        ]}
      />

      {tab === 'portfolio' && <Portfolio holdings={result.holdings} portfolio={portfolio} />}
      {tab === 'board' && (
        <div className="stack">
          {result.board.bullish.length > 0 && <div className="card"><StockList direction="tailwind" stocks={result.board.bullish} owned={owned} /></div>}
          {result.board.bearish.length > 0 && <div className="card"><StockList direction="headwind" stocks={result.board.bearish} owned={owned} /></div>}
        </div>
      )}
      {tab === 'steps' && (
        <div className="stack">
          <Steps result={result} />
          <Sizer ideas={result.ideas} />
        </div>
      )}
      {tab === 'evidence' && <Evidence result={result} />}
      {tab === 'beyond' && <Beyond result={result} />}
    </>
  );
}
