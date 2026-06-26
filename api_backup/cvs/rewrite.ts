import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { getSupabase } from '../lib/db';
import { rewriteCVContent } from '../../src/services/aiService';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    const { cvId, prompt, targetJob } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!cvId || !prompt) return res.status(400).json({ error: "cvId and prompt are required" });

    const { data: existing } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
    if (!existing) return res.status(404).json({ error: "CV not found" });

    const rewrittenText = await rewriteCVContent({
      originalContent: existing.summary,
      prompt,
      targetJob
    });

    // Logic to update existing or create version
    const versionNumber = (existing.parsedDetails?.versions?.length || 0) + 1;
    const updatedAt = new Date().toISOString();
    
    // Simplification for now: update the summary directly as a 'rewrite'
    const { data, error } = await supabase.from('cvs').update({
        summary: rewrittenText,
        updatedAt
    }).eq('id', cvId).select();

    if (error) throw error;
    res.status(200).json(data[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
