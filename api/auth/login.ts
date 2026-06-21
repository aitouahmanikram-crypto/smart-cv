import bcrypt from 'bcryptjs';
import { getSupabase } from '../lib/db';
import { generateToken } from '../lib/auth';
import { runCors } from '../lib/cors';
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

    const { email, password } = body;
    if (!email || !password) return sendError(res, "Email and password are required", 400);

    const supabase = getSupabase();
    
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (error || !user || !bcrypt.compareSync(password, user.passwordHash)) {
      return sendError(res, "Invalid email or password", 401);
    }

    const token = generateToken(user.id, user.tenantId);
    
    return sendSuccess(res, { token, user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId } });
  } catch (err: any) {
    return sendError(res, err);
  }
}
