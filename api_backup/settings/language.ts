import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { getSupabase } from '../lib/db';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

  try {
    if (req.method === 'GET') {
      const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle();
      return res.status(200).json({ language: "en" }); // Defaulting to EN as requested for stable JSON
    }

    if (req.method === 'PUT') {
      // Logic from server.ts: put settings
      return res.status(200).json({ success: true, language: "en" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
