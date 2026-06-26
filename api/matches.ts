import { runCors } from '../server/lib/cors';
import { getAuthenticatedUser } from '../server/lib/middleware';
import { getSupabase } from '../server/lib/db';
import { analyzeJobMatch } from '../src/services/aiService';

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
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase environment variables are missing" });

    if (action === 'list') {
      if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/matches', action, allowedMethods: ['GET'] });
      const { data, error } = await supabase.from('matches').select('*').eq('userId', user.id);
      if (error) throw error;
      return res.status(200).json({ success: true, data: data || [] });
    }

    if (action === 'analyze') {
      if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/matches', action, allowedMethods: ['POST'] });
      const { cvId, jobId } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!cvId || !jobId) return res.status(400).json({ success: false, error: "cvId and jobId are required" });

      const { data: cv } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
      const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
      if (!cv || !job) return res.status(404).json({ success: false, error: "CV or Job not found" });

      const analysis = await analyzeJobMatch(cv.summary, job.description);
      const matchResult = { id: `match-${Date.now()}`, userId: user.id, cvId, jobId, ...analysis, createdAt: new Date().toISOString() };
      const { error } = await supabase.from('matches').insert([matchResult]);
      if (error) throw error;
      return res.status(200).json({ success: true, data: matchResult });
    }

    if (action === 'custom') {
      if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/matches', action, allowedMethods: ['POST'] });
      const { cvId, jobTitle, companyName, jobDescription } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!cvId || !jobTitle || !jobDescription) return res.status(400).json({ success: false, error: "cvId, jobTitle, and jobDescription are required" });

      const { data: cv } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
      if (!cv) return res.status(404).json({ success: false, error: "CV not found" });

      const analysis = await analyzeJobMatch(cv.summary, jobDescription);
      const matchResult = { id: `match-c-${Date.now()}`, userId: user.id, cvId, customJob: { title: jobTitle, company: companyName || "Custom" }, ...analysis, createdAt: new Date().toISOString() };
      const { error } = await supabase.from('matches').insert([matchResult]);
      if (error) throw error;
      return res.status(200).json({ success: true, data: matchResult });
    }

    if (action === 'saved') {
      if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/matches', action, allowedMethods: ['GET'] });
      const { data: savedActivities, error: actErr } = await supabase.from('activities').select('*').eq('userId', user.id).eq('type', 'saved_job');
      if (actErr) throw actErr;
      if (!savedActivities || savedActivities.length === 0) return res.status(200).json({ success: true, data: [] });
      const matchIds = savedActivities.map((act: any) => act.message);
      const { data: matches, error: matchErr } = await supabase.from('matches').select('*').in('id', matchIds);
      if (matchErr) throw matchErr;
      return res.status(200).json({ success: true, data: matches || [] });
    }

    if (action === 'save') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: "id is required" });
      if (req.method === 'POST') {
        const { error } = await supabase.from('activities').insert([{ id: `save-${Date.now()}`, userId: user.id, tenantId: user.tenantId, type: 'saved_job', message: id, timestamp: new Date().toISOString() }]);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }
      if (req.method === 'DELETE') {
        const { error } = await supabase.from('activities').delete().eq('type', 'saved_job').eq('message', id).eq('userId', user.id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }
      return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/matches', action, allowedMethods: ['POST', 'DELETE'] });
    }

    return res.status(400).json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
