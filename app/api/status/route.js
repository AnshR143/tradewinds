import { hasAiKey } from '@/lib/ai';
import { hasWallet } from '@/lib/solana';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ai: hasAiKey(),
    prices: Boolean(process.env.TWELVEDATA_API_KEY),
    liveNews: Boolean(process.env.PERPLEXITY_API_KEY),
    database: Boolean(process.env.DATABASE_URL),
    solana: hasWallet(),
  });
}
