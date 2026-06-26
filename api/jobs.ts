import { getSupabase } from '../server/lib/db';
import { runCors } from '../server/lib/cors';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).json({ success: true });
  }

  if (!runCors(req, res)) return;

  const { action } = req.query;

  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase environment variables are missing" });

    if (action === 'list') {
      if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/jobs', action, allowedMethods: ['GET'] });
      const { data: jobs, error } = await supabase.from('jobs').select('*').order('postedAt', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, data: jobs || [] });
    }

    if (action === 'search') {
      if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/jobs', action, allowedMethods: ['GET'] });
      const { q } = req.query;
      const { data: jobs, error } = await supabase.from('jobs').select('*');
      if (error) throw error;
      
      let filtered = jobs || [];
      if (q) {
        const searchLower = String(q).toLowerCase();
        filtered = filtered.filter((j: any) =>
          (j.title && j.title.toLowerCase().includes(searchLower)) ||
          (j.company && j.company.toLowerCase().includes(searchLower)) ||
          (j.location && j.location.toLowerCase().includes(searchLower))
        );
      }
      return res.status(200).json({ success: true, data: filtered });
    }

    return res.status(400).json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
