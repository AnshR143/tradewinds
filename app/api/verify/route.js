import { getAnalysis } from '@/lib/store';
import { explorerLink, fingerprint, readStamp } from '@/lib/solana';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const time = new URL(request.url).searchParams.get('time');
  const row = time && !Number.isNaN(Date.parse(time)) ? await getAnalysis(time) : null;
  if (!row) return Response.json({ status: 'not-found' }, { status: 404 });
  if (!row.proof) return Response.json({ status: 'not-stamped' });

  try {
    const onChain = await readStamp(row.proof);
    if (!onChain?.hash) return Response.json({ status: 'not-found-on-chain', link: explorerLink(row.proof) });
    const now = fingerprint({ observation: row.observation, summary: row.summary, ideas: row.ideas });
    return Response.json({
      status: now === onChain.hash ? 'matches' : 'changed',
      stampedAt: onChain.time,
      link: explorerLink(row.proof),
    });
  } catch (err) {
    console.error('Could not check the stamp:', err.message.slice(0, 160));
    return Response.json({ status: 'error' }, { status: 502 });
  }
}
