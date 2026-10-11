// Prediction market odds on world affairs, elections and the economy.
import { getPoliticalMarkets } from '@/lib/markets';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ groups: await getPoliticalMarkets() });
}
