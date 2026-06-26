import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedAdmin } from '../lib/middleware';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const admin = await getAuthenticatedAdmin(req, res);
    if (!admin) return;

    const supabase = getSupabase();
    
    const [
      { count: totalUsers },
      { count: totalCvs },
      { count: totalLetters },
      { count: totalMatches },
      { count: totalInterviewsActs },
      { count: totalJobs }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('cvs').select('*', { count: 'exact', head: true }),
      supabase.from('cover_letters').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('activities').select('*', { count: 'exact', head: true }).eq('type', 'interview_questions'),
      supabase.from('jobs').select('*', { count: 'exact', head: true })
    ]);

    let totalInterviewsTable = 0;
    try {
      const { count } = await supabase.from('interview_questions').select('*', { count: 'exact', head: true });
      totalInterviewsTable = count || 0;
    } catch (e) {}

    res.status(200).json({
      totalUsers,
      totalCvs,
      totalLetters,
      totalMatches,
      totalInterviewsActs,
      totalJobs,
      totalInterviewsTable
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
