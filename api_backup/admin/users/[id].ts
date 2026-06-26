import { getSupabase } from '../../lib/db';
import { runCors } from '../../lib/cors';
import { getAuthenticatedAdmin } from '../../lib/middleware';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const admin = await getAuthenticatedAdmin(req, res);
  if (!admin) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

  const { id } = req.query;

  try {
    if (req.method === 'PUT') {
      const updates = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { error } = await supabase.from('users').update(updates).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
