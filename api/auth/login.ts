import bcrypt from 'bcryptjs';
import { getSupabase } from '../lib/db';
import { generateToken } from '../lib/auth';
import { runCors } from '../lib/cors';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { email, password } = body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const supabase = getSupabase();
    
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (error || !user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user.id, user.tenantId);
    
    res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
