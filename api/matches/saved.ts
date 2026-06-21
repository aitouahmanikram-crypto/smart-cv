import { getSupabase } from '../../lib/db.js';
import { runCors } from '../../lib/cors.js';
import { getAuthenticatedUser } from '../../lib/middleware.js';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const supabase = getSupabase();
    
    const { data: savedActivities, error: actErr } = await supabase
      .from('activities')
      .select('*')
      .eq('userId', user.id)
      .eq('type', 'saved_job');

    if (actErr) throw actErr;
    if (!savedActivities || savedActivities.length === 0) return res.status(200).json([]);

    const matchIds = savedActivities.map((act: any) => act.message);

    const { data: matches, error: matchErr } = await supabase
      .from('matches')
      .select('*')
      .in('id', matchIds);

    if (matchErr) throw matchErr;
    res.status(200).json(matches || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
