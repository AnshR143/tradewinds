'use client';

// A calculator for "how much is at stake". The reader types their own limits and it does
// the arithmetic. It never picks a number for them.
import { useState } from 'react';
import { biggestFall, money } from '@/lib/moves';

export default function Sizer({ ideas }) {
  const priced = ideas.filter((i) => i.price?.status === 'ok');
  const [ticker, setTicker] = useState(priced[0]?.ticker || '');
  const [limit, setLimit] = useState('');
  const [amount, setAmount] = useState('');
  if (!priced.length) return null;

  const idea = priced.find((i) => i.ticker === ticker) || priced[0];
  const price = idea.price.price;
  const series = idea.price.series || [];
  // With no history to measure, a 10% fall is used and said so.
  const measured = series.length >= 5 ? biggestFall(series) : 0;
  const fall = measured >= 1 ? measured : 10;
  const fallNote = measured >= 1
    ? `${fall.toFixed(1)}%, the biggest fall ${idea.name} had in the past month`
    : '10%, a round number, because we have no fall to measure for this one';

  const maxLoss = Number(limit);
  const planned = Number(amount);

  return (
    <div className="card">
      <div className="card-title">Work out the numbers</div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Type your own limits and this does the arithmetic. It does not choose an amount for you.
      </p>

      <div className="sizer">
        <label>
          Company
          <select value={idea.ticker} onChange={(e) => setTicker(e.target.value)}>
            {priced.map((i) => <option key={i.ticker} value={i.ticker}>{i.name} ({i.ticker})</option>)}
          </select>
        </label>
        <label>
          The most I am willing to lose ($)
          <input type="number" min="0" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="50" />
        </label>
        <label>
          An amount I am thinking about ($)
          <input type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
        </label>
      </div>

      <dl className="facts">
        <div>
          <dt>Last close</dt>
          <dd>{money(price)} a share.</dd>
        </div>
        <div>
          <dt>Fall used</dt>
          <dd>{fallNote}.</dd>
        </div>
        {maxLoss > 0 && (
          <div>
            <dt>From your limit</dt>
            <dd>
              {money(maxLoss)} ÷ {fall.toFixed(1)}% = <b>{money(maxLoss / (fall / 100))}</b>. Any more than that, and a repeat of
              that fall would cost more than your limit. That is {Math.floor(maxLoss / (fall / 100) / price)} whole shares.
            </dd>
          </div>
        )}
        {planned > 0 && (
          <div>
            <dt>From your amount</dt>
            <dd>
              {money(planned)} ÷ {money(price)} = {(planned / price).toFixed(1)} shares. A repeat of that fall would cost{' '}
              <b>{money(planned * (fall / 100))}</b>. A 10% move either way is {money(planned * 0.1)}.
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
