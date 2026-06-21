import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { sendSuccess, sendError } from '../lib/api-utils';

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

    return sendSuccess(res, {
      cvs: cvsArr,
      coverLetters: lettersArr,
      matches: matchesArr,
      interviewQuestionsCount: interviewTableCount || 0
    });
  } catch (err: any) {
    return sendError(res, err);
  }
}
