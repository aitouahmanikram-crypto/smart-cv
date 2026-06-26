import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });
    
    // Auth not required to see jobs
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*');
    
    if (error) throw error;
    res.status(200).json(jobs || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
