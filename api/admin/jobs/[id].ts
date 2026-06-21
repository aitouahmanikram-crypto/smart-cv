import { getSupabase } from '../../lib/db';
import { runCors } from '../../lib/cors';
import { getAuthenticatedAdmin } from '../../lib/middleware';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const admin = await getAuthenticatedAdmin(req, res);
    if (!admin) return;

    const supabase = getSupabase();
    const { id } = req.query; // Assuming Vercel provides req.query[param]

    if (req.method === 'PUT') {
      const { title, company, location, category, type, description, requirements, salary } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const updatePayload: any = {};
      if (title !== undefined) updatePayload.title = title;
      if (company !== undefined) updatePayload.company = company;
      if (location !== undefined) updatePayload.location = location;
      if (category !== undefined) updatePayload.category = category;
      if (type !== undefined) updatePayload.type = type;
      if (description !== undefined) updatePayload.description = description;
      if (requirements !== undefined) updatePayload.requirements = Array.isArray(requirements) ? requirements : (typeof requirements === 'string' ? [requirements] : []);
      if (salary !== undefined) updatePayload.salary = salary;

      const { error } = await supabase.from('jobs').update(updatePayload).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
