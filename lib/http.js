// Shared helpers for calling outside services.

const USER_AGENT = `TradeWinds-hackPHS (${process.env.CONTACT_EMAIL || 'ansh.rao.152@gmail.com'})`;

const memory = new Map();

// Remember a result for ttlMs so we don't hit the same feed on every page load.
export async function cached(key, ttlMs, load) {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await load();
  memory.set(key, { at: Date.now(), value });
  return value;
}

export async function getJson(url, { headers = {}, timeoutMs = 12000, method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    body,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

export const MINUTE = 60 * 1000;
