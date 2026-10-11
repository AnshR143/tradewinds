// Patterns in plane and ship traffic right now, with the likely reason for each.
import { getPatterns } from '@/lib/patterns';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await getPatterns());
  } catch (err) {
    console.error('Patterns failed:', err.message);
    return Response.json({ findings: [], ships: { asOf: null, points: [] }, airports: [], planes: { asOf: null, live: false, total: 0, nearStorms: [] }, failed: true });
  }
}
