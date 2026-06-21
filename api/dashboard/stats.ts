import { getSupabase } from '../lib/db.js';
import { runCors } from '../lib/cors.js';
import { getAuthenticatedUser } from '../lib/middleware.js';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    
    const { data: cvs } = await supabase
      .from('cvs')
      .select('id, score, "updatedAt", "fileName"')
      .eq('userId', user.id)
      .order('updatedAt', { ascending: true });
    
    const cvsArr = cvs || [];
    
    const { data: letters } = await supabase
      .from('cover_letters')
      .select('id, "createdAt"')
      .eq('userId', user.id);
    const lettersArr = letters || [];

    let matchesArr: any[] = [];
    if (cvsArr.length > 0) {
      const { data: matches } = await supabase
        .from('matches')
        .select('id, "createdAt", "matchScore"')
        .in('cvId', cvsArr.map(c => c.id));
      matchesArr = matches || [];
    }

    const { count: interviewTableCount } = await supabase
      .from('interview_questions')
      .select('*', { count: 'exact', head: true });

    res.status(200).json({
      cvs: cvsArr,
      coverLetters: lettersArr,
      matches: matchesArr,
      interviewQuestionsCount: interviewTableCount || 0
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
