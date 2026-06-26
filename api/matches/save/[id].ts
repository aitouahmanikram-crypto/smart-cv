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
    if (req.method === 'POST') {
      const { error } = await supabase
        .from('activities')
        .insert([{ 
          id: `save-${Date.now()}`, 
          userId: user.id, 
          tenantId: user.tenantId,
          type: 'saved_job',
          message: id, // matchId
          timestamp: new Date().toISOString() 
        }]);
      
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('type', 'saved_job')
        .eq('message', id)
        .eq('userId', user.id);
      
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
