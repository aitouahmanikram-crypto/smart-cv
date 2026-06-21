import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { extendUserWithVirtualFields } from '../lib/utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return; // Middleware handles 401
    
    const supabase = getSupabase();
    const { data: fullUser, error } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
    
    if (error || !fullUser) return res.status(404).json({ error: "User profile not found" });

    const userWithVirtuals = extendUserWithVirtualFields(fullUser);
    res.json(userWithVirtuals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
