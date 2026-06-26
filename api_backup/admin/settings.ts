import { runCors } from '../lib/cors';
import { getAuthenticatedAdmin } from '../lib/middleware';
import fs from 'fs';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const admin = await getAuthenticatedAdmin(req, res);
  if (!admin) return;

  const settingsPath = './system_settings.json';

  try {
    if (req.method === 'GET') {
      if (!fs.existsSync(settingsPath)) {
        return res.status(200).json({ appName: "SmartCV AI", logo: "Zap", maintenanceMode: false });
      }
      const data = fs.readFileSync(settingsPath, 'utf8');
      return res.status(200).json(JSON.parse(data));
    }

    if (req.method === 'PUT') {
      const settings = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      return res.status(200).json({ success: true, settings });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
