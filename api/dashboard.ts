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

  const { action } = req.query;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase environment variables are missing" });

    if (action === 'stats') {
      if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/dashboard', action, allowedMethods: ['GET'] });
      const [
        { count: cvCount },
        { count: matchCount },
        { count: letterCount },
        { data: cvs },
        { data: letters },
        { data: matches },
        { data: activities }
      ] = await Promise.all([
        supabase.from('cvs').select('*', { count: 'exact', head: true }).eq('userId', user.id),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('userId', user.id),
        supabase.from('cover_letters').select('*', { count: 'exact', head: true }).eq('userId', user.id),
        supabase.from('cvs').select('id, score, updatedAt, fileName').eq('userId', user.id).order('updatedAt', { ascending: true }),
        supabase.from('cover_letters').select('id, createdAt').eq('userId', user.id),
        supabase.from('matches').select('id, createdAt, matchScore').eq('userId', user.id),
        supabase.from('activities').select('*').eq('userId', user.id).order('timestamp', { ascending: false }).limit(15)
      ]);

      const averageScore = cvs && cvs.length > 0 
        ? Math.round(cvs.reduce((acc, curr) => acc + (curr.score || 0), 0) / cvs.length)
        : 0;

      return res.status(200).json({
        success: true,
        data: {
          cvsCount: cvCount || 0,
          lettersCount: letterCount || 0,
          matchesCount: matchCount || 0,
          interviewsCount: 0, 
          averageScore: averageScore || 75,
          cvs: cvs || [],
          letters: letters || [],
          matches: matches || [],
          recentActivity: activities || []
        }
      });
    }

    return res.status(400).json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
