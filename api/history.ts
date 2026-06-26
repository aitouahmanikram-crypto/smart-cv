import { runCors } from '../server/lib/cors';
import { getAuthenticatedUser } from '../server/lib/middleware';
import { getSupabase } from '../server/lib/db';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).json({ success: true });
  }

  if (!runCors(req, res)) return;

  const { action, type, id } = req.query;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase environment variables are missing" });

    if (action === 'list') {
      if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/history', action, allowedMethods: ['GET'] });
      const [{ data: cvs }, { data: letters }, { data: matches }] = await Promise.all([
        supabase.from('cvs').select('*').eq('userId', user.id).order('updatedAt', { ascending: false }),
        supabase.from('cover_letters').select('*').eq('userId', user.id).order('createdAt', { ascending: false }),
        supabase.from('matches').select('*').eq('userId', user.id).order('createdAt', { ascending: false })
      ]);
      return res.status(200).json({ success: true, data: { analyses: cvs || [], coverLetters: letters || [], matches: matches || [], interviewQuestions: [] } });
    }

    if (action === 'delete') {
      if (req.method !== 'DELETE' && req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/history', action, allowedMethods: ['DELETE', 'POST'] });
      const typeStr = String(type);
      const table = (typeStr === 'cvs' || typeStr === 'analysis') ? 'cvs' : 
                    (typeStr === 'letters' || typeStr === 'coverLetter') ? 'cover_letters' : 
                    (typeStr === 'matches' || typeStr === 'match') ? 'matches' : null;
      if (!table) return res.status(400).json({ success: false, error: `Invalid type: ${typeStr}` });
      const { error } = await supabase.from(table).delete().eq('id', id).eq('userId', user.id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
