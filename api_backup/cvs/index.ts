import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });
    
    const { data: cvs, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('userId', user.id)
      .order('updatedAt', { ascending: false });
    
    if (error) throw error;
    res.status(200).json(cvs || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
