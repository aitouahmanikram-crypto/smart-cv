import { runCors } from '../../lib/cors';
import { getAuthenticatedUser } from '../../lib/middleware';
import { getSupabase } from '../../lib/db';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

  const { type, id } = req.query;

  try {
    if (req.method === 'DELETE') {
      const typeStr = String(type);
      const table = (typeStr === 'cvs' || typeStr === 'analysis') ? 'cvs' : 
                    (typeStr === 'letters' || typeStr === 'coverLetter') ? 'cover_letters' : 
                    (typeStr === 'matches' || typeStr === 'match') ? 'matches' : null;
      
      if (!table) return res.status(400).json({ error: `Invalid type: ${typeStr}` });
      
      const { error } = await supabase.from(table).delete().eq('id', id).eq('userId', user.id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
