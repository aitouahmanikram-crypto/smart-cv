import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { getSupabase } from '../lib/db';
import { generateCareerAdvice } from '../../src/services/aiService';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    const { cvId } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!cvId) return res.status(400).json({ error: "cvId is required" });

    const { data: cv, error: cvErr } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
    if (cvErr || !cv) return res.status(404).json({ error: "CV not found" });

    const advice = await generateCareerAdvice(cv);
    
    const careerAdviceRow = {
      id: `adv-${Date.now()}`,
      cvId,
      userId: user.id,
      ...advice,
      createdAt: new Date().toISOString()
    };

    const { error: insertErr } = await supabase.from('career_advice').insert([careerAdviceRow]);
    if (insertErr) throw insertErr;

    return res.status(200).json(careerAdviceRow);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
