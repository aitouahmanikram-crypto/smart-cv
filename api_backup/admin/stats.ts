import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedAdmin } from '../lib/middleware';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const admin = await getAuthenticatedAdmin(req, res);
    if (!admin) return;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });
    
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
      summary: {
        totalUsers: totalUsers || 0,
        totalCvs: totalCvs || 0,
        totalCoverLetters: totalLetters || 0,
        totalJobOffers: totalJobs || 0,
        totalMatches: totalMatches || 0,
        totalInterviews: (totalInterviewsActs || 0) + (totalInterviewsTable || 0),
        averageScore: 74
      },
      charts: {
        newUsers: [
          { month: 'Jan', count: 12 },
          { month: 'Feb', count: 19 },
          { month: 'Mar', count: 25 },
          { month: 'Apr', count: 32 },
          { month: 'May', count: 48 },
          { month: 'Jun', count: totalUsers || 60 }
        ],
        atsDistribution: [
          { range: '0-20', count: 5 },
          { range: '21-40', count: 12 },
          { range: '41-60', count: 25 },
          { range: '61-80', count: 45 },
          { range: '81-100', count: 30 }
        ],
        mostUsedFeatures: [
          { feature: 'CV Analysis', count: totalCvs || 0 },
          { feature: 'Job Match', count: totalMatches || 0 },
          { feature: 'Cover Letter', count: totalLetters || 0 },
          { feature: 'Interviews', count: (totalInterviewsActs || 0) + (totalInterviewsTable || 0) }
        ]
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
