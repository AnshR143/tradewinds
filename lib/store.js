// Keeps a time-stamped record of every signal we saw and every answer we gave.
// With DATABASE_URL set (Tiger Data / Postgres) it is saved for good. Without it, it lives
// in memory and is lost when the server restarts.
// Storage problems are logged and never break a request.
import pg from 'pg';

const MEMORY_LIMIT = 200;
const memory = { signals: new Map(), analyses: [] };

let pool = null;
let ready = null;

function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
    ready = setUp(pool).catch((err) => console.error('Database setup failed:', err.message));
  }
  return pool;
}

async function setUp(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS signals (
      time    timestamptz NOT NULL,
      id      text NOT NULL,
      kind    text,
      source  text,
      title   text,
      place   text,
      detail  text,
      PRIMARY KEY (id, time)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analyses (
      time        timestamptz NOT NULL DEFAULT now(),
      observation text NOT NULL,
      summary     text,
      ideas       jsonb
    )`);
  // The answer's fingerprint and the address of its stamp on Solana.
  await pool.query('ALTER TABLE analyses ADD COLUMN IF NOT EXISTS hash text, ADD COLUMN IF NOT EXISTS proof text');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prices (
      time   timestamptz NOT NULL,
      ticker text NOT NULL,
      close  double precision NOT NULL,
      PRIMARY KEY (ticker, time)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS price_refresh (
      ticker     text PRIMARY KEY,
      fetched_at timestamptz NOT NULL
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feed_cache (
      name       text PRIMARY KEY,
      fetched_at timestamptz NOT NULL,
      payload    jsonb NOT NULL
    )`);
  // Accounts. Passwords are stored only as salted scrypt hashes, sessions only as SHA-256
  // hashes of the cookie value, so a copy of these tables cannot be used to log in.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            bigserial PRIMARY KEY,
      email         text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    )`);
  // Whose question it was. Empty for guests.
  await pool.query('ALTER TABLE analyses ADD COLUMN IF NOT EXISTS user_id bigint');
  // How many planes were near each storm, every time we looked. This is what lets us say
  // "fewer than earlier today" and not only "this many now".
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plane_counts (
      time     timestamptz NOT NULL,
      event_id text NOT NULL,
      title    text,
      inside   integer NOT NULL,
      ring     integer NOT NULL,
      PRIMARY KEY (event_id, time)
    )`);
  // Hypertables are Tiger Data's time-series tables. Plain Postgres does not have them, which is fine.
  for (const table of ['signals', 'analyses', 'prices', 'plane_counts']) {
    await pool.query(`SELECT create_hypertable('${table}', 'time', if_not_exists => TRUE, migrate_data => TRUE)`).catch(() => {});
  }
}

// For the account code, which needs the database directly. Throws when there is none.
export async function query(text, params) {
  const pool = db();
  if (!pool) throw new Error('No database is connected.');
  await ready;
  return pool.query(text, params);
}

export async function saveSignals(signals) {
  const pool = db();
  if (!pool) {
    for (const s of signals) memory.signals.set(`${s.id}|${s.time}`, s);
    return;
  }
  try {
    await ready;
    for (const s of signals) {
      await pool.query(
        'INSERT INTO signals (time, id, kind, source, title, place, detail) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING',
        [s.time, s.id, s.kind, s.source, s.title, s.where, s.detail],
      );
    }
  } catch (err) {
    console.error('Could not save signals:', err.message);
  }
}

// Saves one answer and returns the exact time it was saved under, which identifies it.
export async function saveAnalysis({ observation, summary, ideas, hash, userId = null }) {
  const time = new Date();
  const pool = db();
  if (!pool) {
    memory.analyses.unshift({ time: time.toISOString(), observation, summary, ideas, hash, proof: null, userId });
    memory.analyses.length = Math.min(memory.analyses.length, MEMORY_LIMIT);
    return time;
  }
  try {
    await ready;
    await pool.query(
      'INSERT INTO analyses (time, observation, summary, ideas, hash, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [time, observation, summary, JSON.stringify(ideas), hash, userId],
    );
  } catch (err) {
    console.error('Could not save analysis:', err.message);
  }
  return time;
}

// Records where on Solana an answer's fingerprint was stamped.
export async function saveProof(time, proof) {
  const pool = db();
  if (!pool) {
    const row = memory.analyses.find((a) => a.time === time.toISOString());
    if (row) row.proof = proof;
    return;
  }
  try {
    await ready;
    await pool.query('UPDATE analyses SET proof = $1 WHERE time = $2', [proof, time]);
  } catch (err) {
    console.error('Could not save proof:', err.message);
  }
}

export async function getAnalysis(time) {
  const pool = db();
  if (!pool) return memory.analyses.find((a) => a.time === new Date(time).toISOString()) || null;
  try {
    await ready;
    const { rows } = await pool.query('SELECT time, observation, summary, ideas, hash, proof FROM analyses WHERE time = $1', [new Date(time)]);
    return rows[0] || null;
  } catch (err) {
    console.error('Could not read analysis:', err.message);
    return null;
  }
}

// A signed-in reader sees their own questions. A guest sees the ones asked by guests.
export async function getRecentAnalyses(limit = 10, userId = null) {
  const pool = db();
  if (!pool) return memory.analyses.filter((a) => (a.userId ?? null) === userId).slice(0, limit);
  try {
    await ready;
    const { rows } = await pool.query('SELECT time, observation, summary, ideas, hash, proof FROM analyses WHERE user_id IS NOT DISTINCT FROM $2 ORDER BY time DESC LIMIT $1', [limit, userId]);
    return rows;
  } catch (err) {
    console.error('Could not read analyses:', err.message);
    return [];
  }
}

// ---- Prices -------------------------------------------------------------------------------
// Daily closing prices live in a Tiger Data hypertable. A background job tops it up
// (lib/warm.js), so the "already moved" check is one query here and never waits on the
// price feed.

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

// days is a list of { date: '2026-10-09', close: 290.74 }.
export async function savePrices(ticker, days) {
  const pool = db();
  if (!pool || !days.length) return;
  await ready;
  await pool.query(
    `INSERT INTO prices (time, ticker, close)
     SELECT day, $1, close FROM unnest($2::timestamptz[], $3::float8[]) AS rows(day, close)
     ON CONFLICT (ticker, time) DO UPDATE SET close = EXCLUDED.close`,
    [ticker, days.map((d) => `${d.date}T00:00:00Z`), days.map((d) => d.close)],
  );
  await pool.query(
    `INSERT INTO price_refresh (ticker, fetched_at) VALUES ($1, now())
     ON CONFLICT (ticker) DO UPDATE SET fetched_at = now()`,
    [ticker],
  );
}

// The latest close, and the closes 5 and 21 trading days before it.
// Returns null when we have no prices for this ticker.
export async function readPriceMove(ticker) {
  const pool = db();
  if (!pool) return null;
  await ready;
  const { rows } = await pool.query(
    `WITH recent AS (
       SELECT time, close, row_number() OVER (ORDER BY time DESC) AS n
       FROM prices WHERE ticker = $1 ORDER BY time DESC LIMIT 22
     )
     SELECT max(close) FILTER (WHERE n = 1)  AS last,
            max(close) FILTER (WHERE n = 6)  AS week_ago,
            max(close) FILTER (WHERE n = 22) AS month_ago,
            min(close) FILTER (WHERE n = (SELECT max(n) FROM recent)) AS oldest,
            max(time)  FILTER (WHERE n = 1)  AS as_of,
            (SELECT fetched_at FROM price_refresh WHERE ticker = $1) AS fetched_at,
            (SELECT json_agg(json_build_object('c', close) ORDER BY time) FROM recent) AS series
     FROM recent`,
    [ticker],
  );
  const row = rows[0];
  if (!row || row.last === null) return null;
  return {
    price: row.last,
    weekPct: ((row.last - (row.week_ago ?? row.oldest)) / (row.week_ago ?? row.oldest)) * 100,
    monthPct: ((row.last - (row.month_ago ?? row.oldest)) / (row.month_ago ?? row.oldest)) * 100,
    asOf: row.as_of.toISOString().slice(0, 10),
    fetchedAt: row.fetched_at,
    series: (row.series || []).map((p) => p.c),
  };
}

// Which of these tickers have not been refreshed in the last maxAgeHours.
export async function tickersNeedingRefresh(tickers, maxAgeHours) {
  const pool = db();
  if (!pool) return [];
  await ready;
  const { rows } = await pool.query(
    `SELECT ticker FROM price_refresh WHERE ticker = ANY($1) AND fetched_at > now() - make_interval(hours => $2)`,
    [tickers, maxAgeHours],
  );
  const fresh = new Set(rows.map((r) => r.ticker));
  return tickers.filter((t) => !fresh.has(t));
}

// ---- Last good copy of a feed ---------------------------------------------------------------
// Outside feeds go down sometimes. We keep the last good answer from each one so the page
// can show it, with its age, instead of going empty.

export async function saveFeed(name, payload) {
  const pool = db();
  if (!pool) return;
  try {
    await ready;
    await pool.query(
      `INSERT INTO feed_cache (name, fetched_at, payload) VALUES ($1, now(), $2)
       ON CONFLICT (name) DO UPDATE SET fetched_at = now(), payload = EXCLUDED.payload`,
      [name, JSON.stringify(payload)],
    );
  } catch (err) {
    console.error(`Could not save the ${name} feed:`, err.message);
  }
}

// Returns { fetchedAt, payload } or null.
export async function readFeed(name) {
  const pool = db();
  if (!pool) return null;
  try {
    await ready;
    const { rows } = await pool.query('SELECT fetched_at, payload FROM feed_cache WHERE name = $1', [name]);
    return rows[0] ? { fetchedAt: rows[0].fetched_at.toISOString(), payload: rows[0].payload } : null;
  } catch (err) {
    console.error(`Could not read the saved ${name} feed:`, err.message);
    return null;
  }
}

// The newest saved record of each storm from the last `hours` hours.
export async function readStoredStorms(hours = 48) {
  const pool = db();
  if (!pool) return [];
  try {
    await ready;
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (id) id, time, title, place, detail
       FROM signals
       WHERE kind = 'storm' AND time > now() - make_interval(hours => $1)
       ORDER BY id, time DESC`,
      [hours],
    );
    return rows;
  } catch (err) {
    console.error('Could not read saved storms:', err.message);
    return [];
  }
}

// ---- Planes near each storm, over time -------------------------------------------------------

// rows: [{ id, title, inside, ring }], all counted from the snapshot taken at `time`.
export async function savePlaneCounts(time, rows) {
  const pool = db();
  if (!pool || !rows.length) return;
  try {
    await ready;
    for (const row of rows) {
      await pool.query(
        'INSERT INTO plane_counts (time, event_id, title, inside, ring) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
        [time, row.id, row.title, row.inside, row.ring],
      );
    }
  } catch (err) {
    console.error('Could not save plane counts:', err.message);
  }
}

// For each storm: the average number of planes near it in earlier looks (at least an hour
// old, at most a day), and how many looks that is. Returns a Map of id to { average, looks }.
export async function readPlaneHistory() {
  const pool = db();
  const history = new Map();
  if (!pool) return history;
  try {
    await ready;
    const { rows } = await pool.query(`
      SELECT event_id, avg(inside)::float AS average, count(*)::int AS looks
      FROM plane_counts
      WHERE time < now() - interval '1 hour' AND time > now() - interval '24 hours'
      GROUP BY event_id`);
    for (const row of rows) history.set(row.event_id, { average: row.average, looks: row.looks });
  } catch (err) {
    console.error('Could not read plane history:', err.message);
  }
  return history;
}
