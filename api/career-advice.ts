import { runCors } from '../server/lib/cors';
import { getAuthenticatedUser } from '../server/lib/middleware';
import { getSupabase } from '../server/lib/db';
import { generateCareerAdvice } from '../src/services/aiService';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const { action, cvId: cvIdQuery } = req.query;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase environment variables are missing" });

    if (action === 'list') {
      const { data, error } = await supabase.from('career_advice').select('*').eq('userId', user.id).order('createdAt', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, data: data || [] });
    }

    if (action === 'generate') {
      if (req.method !== 'POST') return res.status(405).json({ success: false, error: "Method not allowed" });
      const { cvId } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!cvId) return res.status(400).json({ success: false, error: "cvId is required" });
      const { data: cv, error: cvErr } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
      if (cvErr || !cv) return res.status(404).json({ success: false, error: "CV not found" });
      const advice = await generateCareerAdvice(cv);
      const row = { id: `adv-${Date.now()}`, cvId, userId: user.id, ...advice, createdAt: new Date().toISOString() };
      const { error: insertErr } = await supabase.from('career_advice').insert([row]);
      if (insertErr) throw insertErr;
      return res.status(200).json({ success: true, data: row });
    }

    if (action === 'get') {
      const cvId = cvIdQuery;
      if (!cvId) return res.status(400).json({ success: false, error: "cvId is required" });
      const { data, error } = await supabase.from('career_advice').select('*').eq('cvId', cvId).maybeSingle();
      if (error) throw error;
      return res.status(200).json({ success: true, data: data || {} });
    }

    return res.status(400).json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
