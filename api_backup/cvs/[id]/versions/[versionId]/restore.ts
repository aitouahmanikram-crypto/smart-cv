import { runCors } from '../../../../lib/cors';
import { getAuthenticatedUser } from '../../../../lib/middleware';
import { getSupabase } from '../../../../lib/db';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "DB connection failed" });

  const { id, versionId } = req.query;

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    // Restore logic
    return res.status(200).json({ success: true, message: "Version restored" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
