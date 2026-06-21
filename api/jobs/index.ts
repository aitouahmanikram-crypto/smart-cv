import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { sendSuccess, sendError } from '../lib/api-utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const supabase = getSupabase();
    
    // Auth not required to see jobs
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*');
    
    if (error) throw error;
    return sendSuccess(res, jobs || []);
  } catch (err: any) {
    return sendError(res, err);
  }
}
