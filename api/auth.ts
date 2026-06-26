import bcrypt from 'bcryptjs';
import { getSupabase } from '../server/lib/db';
import { generateToken } from '../server/lib/auth';
import { runCors } from '../server/lib/cors';
import { getAuthenticatedUser } from '../server/lib/middleware';
import { extendUserWithVirtualFields, serializeUserBio } from '../server/lib/utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const { action } = req.query;

  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase environment variables are missing" });

    // Public actions
    if (action === 'login') {
      if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { email, password } = body;
      if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });
      
      const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
      if (error || !user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ success: false, error: "Invalid email or password" });
      }

      const token = generateToken(user.id, user.tenantId);
      return res.status(200).json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId } } });
    }

    if (action === 'register') {
      if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { email, password, name } = body;
      if (!email || !password || !name) return res.status(400).json({ success: false, error: "Name, email, and password are required fields" });

      const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
      if (existing) return res.status(400).json({ success: false, error: "An account with this email address already exists" });

      const userId = `user-${Date.now()}`;
      const tenantId = `tenant-${Math.random().toString(36).substring(2, 7)}`;
      const passwordHash = bcrypt.hashSync(password, 10);
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
      return res.status(201).json({ success: true, data: { token, user: { id: userId, email, name, tenantId: tenantId, role: "user", status: "active" } } });
    }

    // Protected actions
    const user = await getAuthenticatedUser(req, res);
    if (!user) return; // Middleware handles 401

    if (action === 'me') {
      const { data: fullUser, error } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      if (error || !fullUser) return res.status(404).json({ success: false, error: "User profile not found" });

      const userWithVirtuals = extendUserWithVirtualFields(fullUser);
      return res.json({ success: true, data: userWithVirtuals });
    }

    if (action === 'logout') {
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
