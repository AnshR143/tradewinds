// Every plane in the air right now, for the map's plane layer.
import { getPlanes } from '@/lib/feeds/planes';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getPlanes());
}
