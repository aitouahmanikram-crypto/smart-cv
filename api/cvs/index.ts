import { getSupabase } from '../../lib/db';
import { runCors } from '../../lib/cors';
import { getAuthenticatedUser } from '../../lib/middleware';
import { sendSuccess, sendError } from '../../lib/api-utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    
    const { data: cvs, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('userId', user.id)
      .order('updatedAt', { ascending: false });
    
    if (error) throw error;
    return sendSuccess(res, cvs || []);
  } catch (err: any) {
    return sendError(res, err);
  }
}
