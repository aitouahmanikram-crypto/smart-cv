import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { getSupabase } from '../lib/db';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

  const { cvId } = req.query;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('career_advice')
        .select('*')
        .eq('cvId', cvId)
        .maybeSingle();

      if (error) throw error;
      return res.status(200).json(data || {});
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
