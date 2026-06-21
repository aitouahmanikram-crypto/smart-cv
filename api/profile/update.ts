import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { extendUserWithVirtualFields, serializeUserBio } from '../lib/utils';
import { sendSuccess, sendError } from '../lib/api-utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return; // Middleware handles 401
    
    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    } catch (e) {
        return sendError(res, "Invalid JSON payload", 400);
    }
    const { name, title, bio } = body;

    const supabase = getSupabase();
    const { data: rawUser, error: uErr } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
    
    if (uErr || !rawUser) return sendError(res, "User profile not found", 404);

    const userWithR = extendUserWithVirtualFields(rawUser);

    const updatePayload: any = {};
    if (name) updatePayload.name = name;
    if (title !== undefined) updatePayload.title = title;
    
    // Maintain role & status when updating bios
    updatePayload.bio = serializeUserBio(userWithR.role, userWithR.status, bio !== undefined ? bio : userWithR.bio);

    const { error } = await supabase.from('users').update(updatePayload).eq('id', user.id);
    if (error) throw error;
    
    return sendSuccess(res, { name, title, bio });
  } catch (err: any) {
    return sendError(res, err);
  }
}
