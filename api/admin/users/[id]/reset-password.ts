import { getSupabase } from '../../../lib/db';
import { runCors } from '../../../lib/cors';
import { getAuthenticatedAdmin } from '../../../lib/middleware';
import bcrypt from 'bcryptjs';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const admin = await getAuthenticatedAdmin(req, res);
    if (!admin) return;

    if (req.method !== 'POST') return res.status(405).json({ success: false, error: "Method not allowed" });

    const supabase = getSupabase();
    const { id } = req.query; // Assuming path param is available in query for /[id]/reset-password.ts
    const { password } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    
    if (!password) return res.status(400).json({ success: false, error: "Password is required" });

    const passwordHash = bcrypt.hashSync(password, 10);
    const { error } = await supabase.from('users').update({ passwordHash }).eq('id', id);
    if (error) throw error;
    
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
