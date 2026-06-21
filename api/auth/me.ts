import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { extendUserWithVirtualFields } from '../lib/utils';
import { sendSuccess, sendError } from '../lib/api-utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return; // Middleware handles 401
    
    const supabase = getSupabase();
    const { data: fullUser, error } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
    
    if (error || !fullUser) return sendError(res, "User profile not found", 404);

    const userWithVirtuals = extendUserWithVirtualFields(fullUser);
    return sendSuccess(res, userWithVirtuals);
  } catch (err: any) {
    return sendError(res, err);
  }
}
