// Accounts and sessions. Runs on the server only.
// - Passwords are hashed with scrypt and a random salt. The password itself is never stored.
// - Logging in sets a random token in an http-only cookie. Only its SHA-256 hash is stored,
//   so reading the database does not let anyone log in.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { hasDatabase, query } from '@/lib/store';

const scryptAsync = promisify(scrypt);

export const COOKIE = 'tw_session';
const SESSION_DAYS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function accountsAvailable() {
  return hasDatabase();
}

// Returns the email in lower case, or null when it does not look like one.
export function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

// Returns what is wrong with a new password, or null when it is fine.
export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Use at least 8 characters for the password.';
  if (password.length > 200) return 'That password is too long.';
  return null;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function passwordMatches(password, stored) {
  const [, saltHex, keyHex] = String(stored).split('$');
  if (!saltHex || !keyHex) return false;
  const saved = Buffer.from(keyHex, 'hex');
  const key = await scryptAsync(password, Buffer.from(saltHex, 'hex'), saved.length);
  return timingSafeEqual(key, saved);
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Returns { id, email }, or null when that email already has an account.
export async function createUser(email, password) {
  try {
    const { rows } = await query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, await hashPassword(password)]);
    return rows[0];
  } catch (err) {
    if (err.code === '23505') return null; // unique_violation
    throw err;
  }
}

// A hash to compare against when the email is unknown, so a wrong email takes as long to
// reject as a wrong password and the timing does not reveal which emails have accounts.
let decoy = null;

// Returns { id, email } when the email and password match, otherwise null.
export async function checkLogin(email, password) {
  const { rows } = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
  decoy ||= await hashPassword(randomBytes(12).toString('hex'));
  const ok = await passwordMatches(password, rows[0]?.password_hash || decoy);
  return rows[0] && ok ? { id: rows[0].id, email: rows[0].email } : null;
}

// Starts a session and returns the token to put in the cookie.
export async function startSession(userId) {
  const token = randomBytes(32).toString('base64url');
  await query('DELETE FROM sessions WHERE expires_at < now()');
  await query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [hashToken(token), userId]);
  return token;
}

export async function endSession(token) {
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

// The signed-in reader for this request, as { id, email }, or null. Never throws.
export async function currentUser(request) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token || !hasDatabase()) return null;
  try {
    const { rows } = await query(
      'SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()',
      [hashToken(token)],
    );
    return rows[0] || null;
  } catch (err) {
    console.error('Could not read the session:', err.message);
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

// A form posted from another site is refused. Browsers send Origin on every POST.
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

// Slows down password guessing: at most `max` tries per key in `windowMs`.
const tries = new Map();
export function tooMany(key, max, windowMs) {
  const now = Date.now();
  const recent = (tries.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  tries.set(key, recent);
  if (tries.size > 5000) tries.clear();
  return recent.length > max;
}

export function clientKey(request) {
  return (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
}
