'use client';

import { motion, useReducedMotion } from 'motion/react';
import { SCENARIOS } from '@/data/impact-graph';
import { CHOKEPOINTS } from '@/data/chokepoints';
import { KIND, Skeleton } from '@/components/bits';

const COMPANY_COUNT = new Set(SCENARIOS.flatMap((s) => s.links.flatMap((l) => l.companies.map((c) => c.ticker)))).size;

const SECTIONS = [
  ['ask', 'Ask', 'Say what you noticed in your own words and get a plain answer, with follow-ups.'],
  ['geo', 'Geopolitical', 'Storms, fires, conflicts and other events happening in the world right now.'],
  ['politics', 'Politics and odds', 'What prediction markets expect on elections, world affairs and the economy.'],
  ['map', 'Impact map', 'A globe of every disruption caught, and the chain from each one to real companies.'],
];

function rise(delay) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: 'easeOut' },
  };
}

export default function Home({ signals, user, onStart, onPage, onPick }) {
  const still = useReducedMotion();
  const topSignals = (signals?.sky || []).slice(0, 3);
  const float = still ? {} : { animate: { y: [0, -14, 0] }, transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } };
  const shadow = still ? {} : { animate: { scaleX: [1, 0.86, 1], opacity: [0.9, 0.55, 0.9] }, transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } };

  return (
    <div className="home">
      <header className="home-nav">
        <b className="home-brand">TradeWinds</b>
        <nav aria-label="Sections">
          {SECTIONS.map(([id, name]) => <button key={id} onClick={() => onPage(id)}>{name}</button>)}
        </nav>
        {!user && <button className="btn" onClick={() => onPage('login')}>Log in</button>}
        <button className="btn primary" onClick={onStart}>{user ? 'Open TradeWinds' : 'Get started'}</button>
      </header>

      <section className="hero">
        <div>
          <motion.p className="eyebrow" {...rise(0)}>Into the skies, into the markets</motion.p>
          <motion.h1 {...rise(0.08)}>See who a change helps, who it hurts, and why.</motion.h1>
          <motion.p className="hero-lead" {...rise(0.16)}>
            Tell TradeWinds something you noticed, like &ldquo;gold is getting expensive.&rdquo; It follows the change
            through the supply chain to the companies it touches, and explains each step in plain words.
          </motion.p>
          <motion.div className="row" {...rise(0.24)}>
            <button className="btn primary big" onClick={onStart}>Get started</button>
            <button className="btn big" onClick={() => onPage('geo')}>See what&rsquo;s happening now</button>
          </motion.div>
        </div>

        <motion.div className="mascot-stage" {...rise(0.2)}>
          <motion.button
            className="mascot"
            onClick={onStart}
            aria-label="Get started"
            whileHover={still ? undefined : { scale: 1.03 }}
            whileTap={still ? undefined : { scale: 0.98 }}
            {...float}
          >
            <img src="/mascot.png" alt="" width={507} height={492} />
            <span className="sign">
              <strong>Get started</strong>
              <span>Ask your first question</span>
            </span>
          </motion.button>
          <motion.div className="mascot-shadow" aria-hidden="true" {...shadow} />
        </motion.div>
      </section>

      <section className="home-band">
        <div className="home-numbers">
          <div><b>{SCENARIOS.length}</b><span>kinds of disruption mapped by hand</span></div>
          <div><b>{COMPANY_COUNT}</b><span>companies and funds, every ticker checked</span></div>
          <div><b>{CHOKEPOINTS.length}</b><span>ports, canals and hubs being watched</span></div>
        </div>
      </section>

      <section className="home-section">
        <h2>Happening right now</h2>
        <p className="muted">Pick one to see what follows from it.</p>
        <div className="grid-3" style={{ marginTop: 16 }}>
          {!signals && [0, 1, 2].map((i) => (
            <div className="tile" key={i} aria-hidden="true">
              <Skeleton width={70} height={10} />
              <Skeleton width="70%" height={16} style={{ margin: '10px 0' }} />
              <Skeleton width="90%" height={11} />
            </div>
          ))}
          {topSignals.map((s) => (
            <button key={s.id} className="pick" onClick={() => onPick(s)}>
              <span className="kind">{KIND[s.kind] || s.kind}</span>
              <strong>{s.title}</strong>
              <span>{s.detail}.</span>
              {s.near?.length > 0 && <span>Near the {s.near[0].name}.</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2>What&rsquo;s inside</h2>
        <div className="home-cards">
          {SECTIONS.map(([id, name, text]) => (
            <button key={id} className="pick" onClick={() => onPage(id)}>
              <strong>{name}</strong>
              <span>{text}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="home-foot">
        TradeWinds gives ideas to research, not financial advice. It does not predict prices and uses public, delayed data.
      </footer>
    </div>
  );
}
