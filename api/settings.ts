import { runCors } from './lib/cors';
import { getAuthenticatedUser } from './lib/middleware';
import { getSupabase } from './lib/db';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const { action } = req.query;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase environment variables are missing" });

    if (action === 'language') {
      if (req.method === 'GET') return res.status(200).json({ success: true, data: { language: "en" } });
      if (req.method === 'PUT' || req.method === 'POST') return res.status(200).json({ success: true, data: { language: "en" } });
    }

    return res.status(400).json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
