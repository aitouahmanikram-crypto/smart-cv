import { getSupabase } from '../../lib/db';
import { runCors } from '../../lib/cors';
import { getAuthenticatedAdmin } from '../../lib/middleware';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const admin = await getAuthenticatedAdmin(req, res);
    if (!admin) return;

    const supabase = getSupabase();
    
    // List users
    if (req.method === 'GET') {
      const { data: users, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return res.status(200).json({ success: true, data: users });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
