import bcrypt from 'bcryptjs';
import { getSupabase } from '../lib/db';
import { generateToken } from '../lib/auth';
import { runCors } from '../lib/cors';
import { serializeUserBio } from '../lib/utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { email, password, name } = body;
    if (!email || !password || !name) return res.status(400).json({ error: "Name, email, and password are required fields" });

    const supabase = getSupabase();

    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (existing) return res.status(400).json({ error: "An account with this email address already exists" });

    const userId = `user-${Date.now()}`;
    const tenantId = `tenant-${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = bcrypt.hashSync(password, 10);
    
    // Serialization
    const virtualBio = serializeUserBio("user", "active", "");

    const { error } = await supabase.from('users').insert([{
      id: userId,
      email: email.toLowerCase(),
      passwordHash: passwordHash,
      name,
      tenantId: tenantId,
      title: "",
      bio: virtualBio,
      createdAt: new Date().toISOString()
    }]);

    if (error) throw error;

    const token = generateToken(userId, tenantId);
    
    res.status(201).json({ token, user: { id: userId, email, name, tenantId: tenantId, role: "user", status: "active" } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
