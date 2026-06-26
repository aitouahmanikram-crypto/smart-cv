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
      const { data: cvs } = await supabase.from('cvs').select('*').eq('userId', user.id).order('updatedAt', { ascending: false });
      const { data: letters } = await supabase.from('cover_letters').select('*').eq('userId', user.id).order('createdAt', { ascending: false });
      const { data: matches } = await supabase.from('matches').select('*').eq('userId', user.id).order('createdAt', { ascending: false });
      
      // Extraction of questions from cvs if they were saved separately or just returning them from the cv objects
      // For now, based on History.tsx, it expects analyses, coverLetters, matches, interviewQuestions
      return res.status(200).json({ 
        analyses: cvs || [], 
        coverLetters: letters || [], 
        matches: matches || [],
        interviewQuestions: [] // Placeholder or derived from cvs
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
