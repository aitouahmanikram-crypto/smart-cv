import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedAdmin } from '../lib/middleware';
import { sendSuccess, sendError } from '../lib/api-utils';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const admin = await getAuthenticatedAdmin(req, res);
    if (!admin) return;

    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { q } = req.query;
      const { data: jobs, error } = await supabase.from('jobs').select('*').order('postedAt', { ascending: false });
      if (error) throw error;
      
      let filtered = jobs || [];
      if (q) {
        const searchLower = String(q).toLowerCase();
        filtered = filtered.filter((j: any) =>
          (j.title && j.title.toLowerCase().includes(searchLower)) ||
          (j.company && j.company.toLowerCase().includes(searchLower)) ||
          (j.location && j.location.toLowerCase().includes(searchLower)) ||
          (j.description && j.description.toLowerCase().includes(searchLower))
        );
      }
      return sendSuccess(res, filtered);
    }

    if (req.method === 'POST') {
      const { title, company, location, category, type, description, requirements, salary } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!title || !company || !description) {
        return sendError(res, "Title, company, and description are required fields", 400);
      }
      const newJob = {
        id: `job-${Date.now()}`,
        title,
        company,
        location: location || "",
        category: category || "Other",
        type: type || "Full-Time",
        description,
        requirements: Array.isArray(requirements) ? requirements : (typeof requirements === 'string' ? [requirements] : []),
        salary: salary || "",
        postedAt: new Date().toISOString()
      };

      const { error } = await supabase.from('jobs').insert([newJob]);
      if (error) throw error;
      return sendSuccess(res, newJob, 201);
    }

    return sendError(res, "Method not allowed", 405);
  } catch (err: any) {
    return sendError(res, err);
  }
}
