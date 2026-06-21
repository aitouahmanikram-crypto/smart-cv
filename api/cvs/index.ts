import { getSupabase } from '../../lib/db.js';
import { runCors } from '../../lib/cors.js';
import { getAuthenticatedUser } from '../../lib/middleware.js';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    
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
