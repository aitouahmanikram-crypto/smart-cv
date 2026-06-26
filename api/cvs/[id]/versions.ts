import { runCors } from '../../lib/cors';
import { getAuthenticatedUser } from '../../lib/middleware';
import { getSupabase } from '../../lib/db';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "DB connection failed" });

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('cv_versions')
        .select('*')
        .eq('cvId', id)
        .order('versionNumber', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        // Logic to create a version
        return res.status(201).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
