import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { getSupabase } from '../lib/db';
import { generateCoverLetter } from '../../src/services/aiService';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    const { cvId, jobTitle, companyName, jobDescription } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!cvId || !jobTitle) return res.status(400).json({ error: "cvId and jobTitle are required" });

    const { data: cv } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
    const content = await generateCoverLetter({
      parsedCvText: cv?.summary || "", 
      jobTitle, 
      companyName, 
      jobDescription
    });
    
    const newLetter = {
      id: `cl-${Date.now()}`,
      userId: user.id,
      cvId,
      jobTitle,
      companyName: companyName || "Prospective Employer",
      content,
      createdAt: new Date().toISOString()
    };

    const { error } = await supabase.from('cover_letters').insert([newLetter]);
    if (error) throw error;

    return res.status(200).json(newLetter);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
