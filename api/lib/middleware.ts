import { verifyToken } from './auth.js';
import { getSupabase } from './db.js';

// Simplified for brevity, you should implement full logic from server.ts
export async function getAuthenticatedUser(req: any, res: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization token" });
    return null;
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Session expired or invalid token" });
    return null;
  }
  
  const supabase = getSupabase();
  const { data: rawUser } = await supabase.from('users').select('*').eq('id', decoded.userId).maybeSingle();
  if (!rawUser) {
    res.status(401).json({ error: "User session is invalid" });
    return null;
  }
  
  return rawUser; // Minimal version
}

export async function getAuthenticatedAdmin(req: any, res: any) {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return null;

  if (user.role !== 'super_admin') {
    res.status(403).json({ error: "Unauthorized. Super Admin access only." });
    return null;
  }
  return user;
}
