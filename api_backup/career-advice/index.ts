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
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('userId', user.id)
        .eq('type', 'career_advice')
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      const advice = (data || []).map(a => {
        try {
          const msg = JSON.parse(a.message);
          return {
            id: a.id,
            cvId: msg.cvId,
            advice: msg.advice,
            createdAt: a.timestamp
          };
        } catch (e) {
          return {
            id: a.id,
            advice: a.message,
            createdAt: a.timestamp
          };
        }
      });
      
      return res.status(200).json(advice);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
