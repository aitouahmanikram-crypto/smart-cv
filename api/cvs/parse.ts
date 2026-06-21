import { getSupabase } from '../lib/db';
import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { sendSuccess, sendError } from '../lib/api-utils';
import { parseCVTextAndGenerateSummary } from '../../src/services/aiService';

// Fallback for pdf extraction if pdf-parse fails or needs dynamic import (ESM issues)
async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdf = await import('pdf-parse');
    const data = await pdf.default(buffer);
    return data.text;
  } catch (e) {
    console.error("PDF Parsing failed:", e);
    return "Error: Could not extract text from file.";
  }
}

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return; // 401 handled

    const { cvId } = req.query;
    if (!cvId) return sendError(res, "CV ID required", 400);

    const supabase = getSupabase();
    const { data: cv, error: cvErr } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
    
    if (cvErr || !cv) return sendError(res, "CV not found", 404);

    const { data: fileData, error: fileErr } = await supabase.storage
      .from('cvs')
      .download(cv.filePath);

    if (fileErr) throw fileErr;

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const text = await extractTextFromBuffer(buffer);

    if (text.startsWith("Error:")) {
      return sendError(res, text, 422);
    }

    const aiResult = await parseCVTextAndGenerateSummary(text);

    return sendSuccess(res, aiResult);
  } catch (err: any) {
    return sendError(res, err);
  }
}
