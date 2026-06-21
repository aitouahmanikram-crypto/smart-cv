import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { sendSuccess, sendError } from '../lib/api-utils';
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return; // Middleware handles 401

    const busboy = Busboy({ headers: req.headers });
    let fileBuffer: Buffer = Buffer.alloc(0);
    let fileName = '';

    const promise = new Promise((resolve, reject) => {
      busboy.on('file', (fieldname, file, info) => {
        const { filename } = info;
        fileName = filename;
        file.on('data', (data) => {
          fileBuffer = Buffer.concat([fileBuffer, data]);
        });
        file.on('end', () => {});
      });

      busboy.on('finish', resolve);
      busboy.on('error', reject);
      req.pipe(busboy);
    });

    await promise;

    if (!fileBuffer || fileBuffer.length === 0) {
      return sendError(res, "No file uploaded", 400);
    }

    const supabase = getSupabase();
    const filePath = `cvs/${user.id}/${Date.now()}-${fileName}`;
    
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('cvs')
      .upload(filePath, fileBuffer, {
        contentType: 'application/octet-stream',
      });

    if (uploadErr) throw uploadErr;

    // Persist CV record
    const cv = {
      userId: user.id,
      fileName,
      filePath,
      score: 0, // Placeholder until parsed/analyzed
      updatedAt: new Date().toISOString()
    };

    const { data: dbData, error: dbErr } = await supabase.from('cvs').insert([cv]).select().single();
    if (dbErr) throw dbErr;

    // TODO: Trigger parsing here (Tier 1 requirement)
    
    return sendSuccess(res, { cv: dbData });

  } catch (err: any) {
    return sendError(res, err, 500);
  }
}
