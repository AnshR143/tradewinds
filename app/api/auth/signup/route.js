// Creates an account and signs it in.
import { NextResponse } from 'next/server';
import { accountsAvailable, cleanEmail, clientKey, COOKIE, cookieOptions, createUser, passwordProblem, sameOrigin, startSession, tooMany } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MINUTE = 60 * 1000;

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'That request came from another site.' }, { status: 403 });
  if (!accountsAvailable()) return Response.json({ error: 'Accounts are not set up on this server. You can continue as a guest.' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  if (!email) return Response.json({ error: 'That does not look like an email address.' }, { status: 400 });
  const problem = passwordProblem(body.password);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  // Counted only once the form is valid, so typos do not use it up. A whole room can share
  // one address at an event, so the limit is generous.
  if (tooMany(`signup|${clientKey(request)}`, 30, 60 * MINUTE)) return Response.json({ error: 'Too many new accounts from here. Try again in an hour.' }, { status: 429 });

  try {
    const user = await createUser(email, body.password);
    if (!user) return Response.json({ error: 'That email already has an account. Log in instead.' }, { status: 409 });
    const res = NextResponse.json({ user: { email: user.email } });
    res.cookies.set(COOKIE, await startSession(user.id), cookieOptions);
    return res;
  } catch (err) {
    console.error('Sign-up failed:', err.message);
    return Response.json({ error: 'Could not create the account just now. Try again in a moment.' }, { status: 500 });
  }
}
