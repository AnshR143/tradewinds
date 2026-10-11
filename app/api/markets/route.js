import { getPoliticalMarkets } from '@/lib/markets';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ groups: await getPoliticalMarkets() });
}
