import { accountsAvailable, currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await currentUser(request);
  return Response.json({ user: user ? { email: user.email } : null, available: accountsAvailable() });
}
