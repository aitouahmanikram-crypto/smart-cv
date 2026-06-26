import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { getSupabase } from '../lib/db';
import { analyzeJobMatch } from '../../src/services/aiService';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    const { cvId, jobId } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!cvId || !jobId) return res.status(400).json({ error: "cvId and jobId are required" });

    const { data: cv } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
    const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();

    if (!cv || !job) return res.status(404).json({ error: "CV or Job not found" });

    const analysis = await analyzeJobMatch(cv.summary, job.description);

    const matchResult = {
      id: `match-${Date.now()}`,
      userId: user.id,
      cvId,
      jobId,
      ...analysis,
      createdAt: new Date().toISOString()
    };

    const { error } = await supabase.from('matches').insert([matchResult]);
    if (error) throw error;

    res.status(200).json(matchResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
