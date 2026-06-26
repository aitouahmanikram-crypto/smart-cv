import { runCors } from './lib/cors';
import { getAuthenticatedUser } from './lib/middleware';
import { getSupabase } from './lib/db';
import { generateCoverLetter } from '../src/services/aiService';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const { action } = req.query;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase environment variables are missing" });

    if (action === 'list') {
      const { data, error } = await supabase.from('cover_letters').select('*').eq('userId', user.id).order('createdAt', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, data: data || [] });
    }

    if (action === 'generate') {
      if (req.method !== 'POST') return res.status(405).json({ success: false, error: "Method not allowed" });
      const { cvId, jobTitle, companyName, jobDescription } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!cvId || !jobTitle) return res.status(400).json({ success: false, error: "cvId and jobTitle are required" });
      const { data: cv } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
      const content = await generateCoverLetter({ parsedCvText: cv?.summary || "", jobTitle, companyName, jobDescription });
      const newLetter = { id: `cl-${Date.now()}`, userId: user.id, cvId, jobTitle, companyName: companyName || "Prospective Employer", content, createdAt: new Date().toISOString() };
      const { error } = await supabase.from('cover_letters').insert([newLetter]);
      if (error) throw error;
      return res.status(200).json({ success: true, data: newLetter });
    }

    return res.status(400).json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
