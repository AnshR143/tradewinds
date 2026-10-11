// Ends the session and clears the cookie.
import { NextResponse } from 'next/server';
import { COOKIE, cookieOptions, endSession, sameOrigin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'That request came from another site.' }, { status: 403 });
  await endSession(request.cookies.get(COOKIE)?.value).catch((err) => console.error('Logout failed:', err.message));
  const res = NextResponse.json({ user: null });
  res.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return res;
}
