import { getRecentAnalyses } from '@/lib/store';
import { explorerLink } from '@/lib/solana';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await currentUser(request);
  const rows = await getRecentAnalyses(40, user?.id ?? null);
  return Response.json({
    items: rows.map((row) => ({
      time: row.time,
      observation: row.observation,
      summary: row.summary,
      proof: row.proof ? explorerLink(row.proof) : null,
      ideas: (row.ideas || []).map((idea) => ({ name: idea.name, ticker: idea.ticker, direction: idea.direction })),
    })),
  });
}
