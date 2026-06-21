import bcrypt from 'bcryptjs';
import { getSupabase } from '../lib/db';
import { generateToken } from '../lib/auth';
import { runCors } from '../lib/cors';
import { serializeUserBio } from '../lib/utils';
import { sendSuccess, sendError } from '../lib/api-utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    if (req.method !== 'POST') {
      return sendError(res, "Method not allowed", 405);
    }

    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    } catch (e) {
        return sendError(res, "Invalid JSON payload", 400);
    }
    const { email, password, name } = body;
    if (!email || !password || !name) return sendError(res, "Name, email, and password are required fields", 400);

    const supabase = getSupabase();

    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (existing) return sendError(res, "An account with this email address already exists", 400);

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
    
    return sendSuccess(res, { token, user: { id: userId, email, name, tenantId: tenantId, role: "user", status: "active" } }, 201);
  } catch (err: any) {
    return sendError(res, err);
  }
}
