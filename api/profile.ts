import { getSupabase } from '../server/lib/db';
import { runCors } from '../server/lib/cors';
import { getAuthenticatedUser } from '../server/lib/middleware';
import { extendUserWithVirtualFields, serializeUserBio } from '../server/lib/utils';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).json({ success: true });
  }

  if (!runCors(req, res)) return;

  const { action } = req.query;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase environment variables are missing" });

    if (action === 'update') {
      if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
        return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/profile', action, allowedMethods: ['POST', 'PUT', 'PATCH'] });
      }
      
      const { name, title, bio } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { data: rawUser, error: uErr } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      
      if (uErr || !rawUser) return res.status(404).json({ success: false, error: "User profile not found" });

      const userWithR = extendUserWithVirtualFields(rawUser);
      const updatePayload: any = {};
      if (name) updatePayload.name = name;
      if (title !== undefined) updatePayload.title = title;
      updatePayload.bio = serializeUserBio(userWithR.role, userWithR.status, bio !== undefined ? bio : userWithR.bio);

      const { error } = await supabase.from('users').update(updatePayload).eq('id', user.id);
      if (error) throw error;
      
      return res.status(200).json({ success: true, data: { name, title, bio } });
    }

    return res.status(400).json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
