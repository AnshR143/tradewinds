import { stocksFromNews } from '@/lib/newsStocks';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await stocksFromNews());
  } catch (err) {
    console.error('News to stocks failed:', err.message);
    return Response.json({ stocks: [], markets: [], failed: true });
  }
}
