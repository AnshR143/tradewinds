// Signs in to an existing account.
import { NextResponse } from 'next/server';
import { accountsAvailable, checkLogin, cleanEmail, clientKey, COOKIE, cookieOptions, sameOrigin, startSession, tooMany } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MINUTE = 60 * 1000;

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'That request came from another site.' }, { status: 403 });
  if (!accountsAvailable()) return Response.json({ error: 'Accounts are not set up on this server. You can continue as a guest.' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  // The same message for a wrong email and a wrong password, so it does not reveal which emails have accounts.
  const wrong = Response.json({ error: 'That email and password do not match.' }, { status: 401 });
  if (!email || !password) return wrong;
  if (tooMany(`login|${clientKey(request)}|${email}`, 8, 10 * MINUTE)) return Response.json({ error: 'Too many tries. Wait ten minutes and try again.' }, { status: 429 });

  try {
    const user = await checkLogin(email, password);
    if (!user) return wrong;
    const res = NextResponse.json({ user: { email: user.email } });
    res.cookies.set(COOKIE, await startSession(user.id), cookieOptions);
    return res;
  } catch (err) {
    console.error('Login failed:', err.message);
    return Response.json({ error: 'Could not log in just now. Try again in a moment.' }, { status: 500 });
  }
}
