// "Find more news": searches every news source for one question and returns what is new.
import { findMoreNews } from '@/lib/news';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const query = String(body.query || '').trim().slice(0, 120);
  if (!query) return Response.json({ items: [], searched: [] });
  const already = (Array.isArray(body.already) ? body.already : []).map(String).slice(0, 30);
  return Response.json(await findMoreNews(query, already));
}
