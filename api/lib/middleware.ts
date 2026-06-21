import { verifyToken } from './auth';
import { getSupabase } from './db';
import { sendError } from './api-utils';

// Simplified for brevity, you should implement full logic from server.ts
export async function getAuthenticatedUser(req: any, res: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, "Missing or invalid authorization token", 401);
    return null;
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    sendError(res, "Session expired or invalid token", 401);
    return null;
  }
  
  const supabase = getSupabase();
  const { data: rawUser } = await supabase.from('users').select('*').eq('id', decoded.userId).maybeSingle();
  if (!rawUser) {
    sendError(res, "User session is invalid", 401);
    return null;
  }
  
  return rawUser; // Minimal version
}

export async function getAuthenticatedAdmin(req: any, res: any) {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return null;

  if (user.role !== 'super_admin') {
    sendError(res, "Unauthorized. Super Admin access only.", 403);
    return null;
  }
  return user;
}
