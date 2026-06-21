import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { sendSuccess, sendError } from '../lib/api-utils';
import { analyzeJobMatch } from '../../src/services/aiService';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, "Method not allowed", 405);

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return; // Middleware handles 401
    
    const { cvId, jobId } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!cvId || !jobId) return sendError(res, "CV ID and Job ID required", 400);

    const supabase = getSupabase();
    const { data: cv, error: cvErr } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
    const { data: job, error: jobErr } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();

    if (cvErr || !cv) return sendError(res, "CV not found", 404);
    if (jobErr || !job) return sendError(res, "Job not found", 404);

    // Analyze using AI service
    const matchResult = await analyzeJobMatch(cv, job);
    
    // Persist result record
    const matchRecord = {
      userId: user.id,
      cvId,
      jobId,
      matchScore: matchResult.matchScore,
      analysisJson: JSON.stringify(matchResult),
      createdAt: new Date().toISOString()
    };
    
    const { error: matchErr } = await supabase.from('matches').insert([matchRecord]);
    if (matchErr) throw matchErr;
    
    return sendSuccess(res, matchResult);
  } catch (err: any) {
    return sendError(res, err);
  }
}
