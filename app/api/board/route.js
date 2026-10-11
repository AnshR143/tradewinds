import { listEvents, signalBoard } from '@/lib/board';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const board = await signalBoard();
    const row = (e) => ({ ...e, mapped: true, reason: `From ${listEvents(e.events)}.` });
    return Response.json({ bullish: board.bullish.map(row), bearish: board.bearish.map(row) });
  } catch (err) {
    console.error('Signal board failed:', err.message);
    return Response.json({ bullish: [], bearish: [] });
  }
}
