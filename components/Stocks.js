'use client';

// The list of stocks an event is likely to move: one line each, with "See why" to open the
// reasoning. Used at the top of every answer and on the Top stocks page.
import { useEffect, useState } from 'react';
import { Chain, SkeletonRows } from '@/components/bits';
import { Sparkline } from '@/components/charts';
import { biggestFall, biggestRise, money } from '@/lib/moves';

export const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

export function Move({ value, period }) {
  return (
    <span className={value >= 0 ? 'up' : 'down'}>
      {value >= 0 ? 'Up' : 'Down'} {Math.abs(value).toFixed(1)}% {period}
    </span>
  );
}

export function Price({ price }) {
  if (!price || price.status === 'no-key') return 'Price check not connected yet.';
  if (price.status !== 'ok') return 'Could not check the price just now.';
  const up = price.monthPct >= 0;
  return (
    <div className="price-row">
      {price.series?.length > 1 && <Sparkline series={price.series} positive={up} width={110} height={34} />}
      <div>
        <Move value={price.weekPct} period="this week" />, <Move value={price.monthPct} period="this month" />.{' '}
        <span className="muted">Last close ${price.price.toFixed(2)}.</span>
      </div>
    </div>
  );
}

// Whether the price has started to move the way the signal points.
export function priceRead(direction, price) {
  if (price?.status !== 'ok' || Math.abs(price.weekPct) < 1) return '';
  const movedWithSignal = (direction === 'tailwind') === (price.weekPct > 0);
  return movedWithSignal ? 'Some of this may already be in the price.' : 'The price has not reacted to this yet.';
}

// What Wall Street analysts say about the whole company. Published opinion, not ours.
export function Analysts({ view, price }) {
  const total = view.buy + view.hold + view.sell;
  const share = (n) => `${(n / total) * 100}%`;
  const last = price?.status === 'ok' ? price.price : null;
  return (
    <div className="analysts">
      <span className="split-bar" aria-hidden="true">
        <i className="buy" style={{ width: share(view.buy) }} />
        <i className="hold" style={{ width: share(view.hold) }} />
        <i className="sell" style={{ width: share(view.sell) }} />
      </span>
      <span>
        {view.buy} say buy, {view.hold} hold, {view.sell} sell.
        {view.target ? ` Average price target $${view.target.toFixed(2)}${last ? `, against a last close of $${last.toFixed(2)}` : ''}.` : ''}
      </span>
    </div>
  );
}

// "Strong +48" in blue for up, "Strong -77" in orange for down.
export function SignalTag({ direction, score }) {
  const text = score ? `${score.band} ${signed(score.value)}` : direction === 'tailwind' ? 'Up' : 'Down';
  return <span className={`tag ${direction}`}>{text}</span>;
}

// Shows how a score was worked out, factor by factor.
function ScoreMath({ score }) {
  return (
    <details className="math">
      <summary>Score {signed(score.value)} out of 100. Show the math</summary>
      <table>
        <tbody>
          {score.factors.map((f, i) => (
            <tr key={f.name}>
              <td>{i === 0 ? '' : '×'} <b>{f.value}</b></td>
              <td>{f.name}</td>
              <td className="muted">{f.why}</td>
            </tr>
          ))}
          <tr>
            <td>= <b>{Math.abs(score.value)}</b></td>
            <td>Score</td>
            <td className="muted">
              Capped at 100. {score.value < 0 ? 'Shown as a minus because the event hurts this company.' : 'Shown as a plus because the event helps this company.'}
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

// What the reader's own shares are worth, and what a move like the stock's biggest one this
// month would add or take off. Arithmetic on their numbers; it does not say what to do.
function yourNumbers(stock, shares) {
  if (stock.price?.status !== 'ok') return null;
  if (!shares) return { text: 'Your file gave no share count for this one, so there are no dollar figures.' };
  const worth = shares * stock.price.price;
  const series = stock.price.series || [];
  const up = stock.direction === 'tailwind';
  const measured = series.length >= 5 ? (up ? biggestRise(series) : biggestFall(series)) : 0;
  const pct = measured >= 1 ? measured : 10;
  const size = measured >= 1 ? `its biggest this month (${pct.toFixed(1)}%)` : '10%';
  const change = worth * (pct / 100);
  return {
    worth,
    text: `${shares} shares × $${stock.price.price.toFixed(2)} = ${money(worth)}. A ${up ? 'rise' : 'fall'} like ${size} would ${up ? 'add' : 'take off'} about ${money(change)}.`,
  };
}

function Stock({ stock, owned, shares }) {
  const why = stock.chain?.[stock.chain.length - 1] || stock.reason;
  const yours = shares !== undefined ? yourNumbers(stock, shares) : null;
  return (
    <details className="stock">
      <summary>
        <span className="stock-name">
          {stock.name} <span className="ticker">{stock.ticker}</span>
          {owned && <span className="tag own">You own this</span>}
          {yours?.worth > 0 && <span className="tag own">You hold {money(yours.worth)}</span>}
        </span>
        <span className="stock-why">{why}</span>
        <span className="stock-side">
          <SignalTag direction={stock.direction} score={stock.score} />
          <span className="see"><span className="see-closed">See why</span><span className="see-open">Hide</span></span>
        </span>
      </summary>
      <div className="stock-body">
        {stock.chain?.length > 0 && <Chain steps={stock.chain} direction={stock.direction} />}
        {stock.reason && <p>{stock.reason}</p>}
        <dl className="facts">
          {yours && (
            <div>
              <dt>Your shares</dt>
              <dd>{yours.text}</dd>
            </div>
          )}
          <div>
            <dt>Price so far</dt>
            <dd><Price price={stock.price} /> {priceRead(stock.direction, stock.price)}</dd>
          </div>
          {stock.analysts && (
            <div>
              <dt>Analysts</dt>
              <dd><Analysts view={stock.analysts} price={stock.price} /></dd>
            </div>
          )}
          {stock.wrongIf && (
            <div>
              <dt>Wrong if</dt>
              <dd>{stock.wrongIf}</dd>
            </div>
          )}
          {stock.mapped === false && (
            <div>
              <dt>Not checked</dt>
              <dd>The AI&rsquo;s own idea, outside our map.</dd>
            </div>
          )}
        </dl>
        {stock.score && <ScoreMath score={stock.score} />}
      </div>
    </details>
  );
}

// One side of the list. Shows the first `first` stocks, with a button for the rest.
// `empty` is shown when there is nothing on this side; without it the side is left out.
// `shares` is a Map of ticker to the reader's share count, on the portfolio tab only.
export function StockList({ direction, stocks, owned, shares, empty, first = 5 }) {
  const [all, setAll] = useState(false);
  if (!stocks.length && !empty) return null;
  const shown = all ? stocks : stocks.slice(0, first);
  return (
    <div className={`stock-group ${direction}`}>
      <div className="group-head">{direction === 'tailwind' ? 'Likely to go up' : 'Likely to go down'}</div>
      {!stocks.length && <p className="muted stock-none">{empty}</p>}
      {shown.map((stock) => <Stock key={stock.ticker} stock={stock} owned={owned?.has(stock.ticker)} shares={shares ? shares.get(stock.ticker) ?? null : undefined} />)}
      {stocks.length > first && !all && (
        <button className="btn small" style={{ marginTop: 10 }} onClick={() => setAll(true)}>Show all {stocks.length}</button>
      )}
    </div>
  );
}

// Asked for once per visit, however many news sections are opened.
let newsStocks = null;
function loadNewsStocks() {
  if (!newsStocks) {
    newsStocks = fetch('/api/news-stocks').then((r) => r.json()).catch(() => ({ stocks: [], markets: [], failed: true }));
  }
  return newsStocks;
}

// The box under a list of news: which stocks that news is likely to move.
// `news` is the list shown above it, so the box only covers what the reader can see.
export function NewsStocks({ news }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    loadNewsStocks().then((d) => live && setData(d));
    return () => { live = false; };
  }, []);

  const ids = new Set(news.map((n) => n.id));
  const here = (entry) => entry.newsIds.some((id) => ids.has(id));
  const stocks = (data?.stocks || []).filter(here);
  const markets = (data?.markets || []).filter(here);
  const up = stocks.filter((s) => s.direction === 'tailwind');
  const down = stocks.filter((s) => s.direction === 'headwind');

  return (
    <section className="card callout" aria-live="polite">
      <h2>What this news means for stocks</h2>
      {!data && <p className="muted">Reading the news&hellip;</p>}
      {data && stocks.length === 0 && (
        <p className="muted">{data.failed ? 'Could not read the news just now. Try again in a minute.' : 'Nothing in this news clearly points at a stock right now.'}</p>
      )}
      {stocks.length > 0 && (
        <>
          <p className="callout-markets">
            <span className="muted">Markets touched:</span>
            {markets.map((m) => <span key={m.id} className="ticker">{m.name}</span>)}
          </p>
          <div className="stock-groups">
            <StockList direction="tailwind" stocks={up} first={3} />
            <StockList direction="headwind" stocks={down} first={3} />
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>The AI matches each headline to our impact map. The stocks and scores come from the map and fixed math.</p>
        </>
      )}
    </section>
  );
}

// The Top stocks page: every stock that events happening right now are likely to move.
export function StocksPage() {
  const [board, setBoard] = useState(null);

  useEffect(() => {
    fetch('/api/board').then((r) => r.json()).then(setBoard).catch(() => setBoard({ bullish: [], bearish: [] }));
  }, []);

  if (!board) return <SkeletonRows count={2} />;
  if (!board.bullish.length && !board.bearish.length) {
    return <div className="card"><p className="muted">Nothing happening right now points at a stock on our map.</p></div>;
  }
  return (
    <div className="stack">
      {board.bullish.length > 0 && <div className="card"><StockList direction="tailwind" stocks={board.bullish} /></div>}
      {board.bearish.length > 0 && <div className="card"><StockList direction="headwind" stocks={board.bearish} /></div>}
      <p className="muted small">Scores run from -100 to +100 and come from fixed math, not the AI.</p>
    </div>
  );
}
