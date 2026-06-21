import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from './auth';
import { supabase } from './db';

// Simplified for brevity, you should implement full logic from server.ts
export async function getAuthenticatedUser(req: VercelRequest, res: VercelResponse) {
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
  
  const { data: rawUser } = await supabase.from('users').select('*').eq('id', decoded.userId).maybeSingle();
  if (!rawUser) {
    res.status(401).json({ error: "User session is invalid" });
    return null;
  }
  
  return rawUser; // Minimal version
}
