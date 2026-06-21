import { getSupabase } from '../lib/db.js';
import { runCors } from '../lib/cors.js';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const supabase = getSupabase();
    
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
