export default async function handler(req: any, res: any) {import bcrypt from 'bcryptjs';
import { supabase } from '../lib/db.js';
import { generateToken } from '../lib/auth.js';
import { runCors } from '../lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!runCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (error || !user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user.id, user.tenantId);
    
    // In production, extend user with virtual fields
    res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
