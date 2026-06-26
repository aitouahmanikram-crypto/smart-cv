import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { extendUserWithVirtualFields, serializeUserBio } from '../lib/utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return; // Middleware handles 401
    
    const { name, title, bio } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });
    const { data: rawUser, error: uErr } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
    
    if (uErr || !rawUser) return res.status(404).json({ error: "User profile not found" });

    const userWithR = extendUserWithVirtualFields(rawUser);

    const updatePayload: any = {};
    if (name) updatePayload.name = name;
    if (title !== undefined) updatePayload.title = title;
    
    // Maintain role & status when updating bios
    updatePayload.bio = serializeUserBio(userWithR.role, userWithR.status, bio !== undefined ? bio : userWithR.bio);

    const { error } = await supabase.from('users').update(updatePayload).eq('id', user.id);
    if (error) throw error;
    
    res.status(200).json({ success: true, user: { name, title, bio } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
