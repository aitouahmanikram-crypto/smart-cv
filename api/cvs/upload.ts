import { runCors } from '../lib/cors';
import { getAuthenticatedUser } from '../lib/middleware';
import { getSupabase } from '../lib/db';
import { logActivity } from '../lib/utils';
import { parseCVTextAndGenerateSummary } from '../../src/services/aiService';
import multer from 'multer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

// Configure multer for serverless memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for Vercel
});

// Helper to run multer in serverless context
const runMiddleware = (req: any, res: any, fn: any) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result: any) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
};

export const config = {
    api: {
        bodyParser: false, // Disable built-in body parser for multipart
    },
};

export default async function handler(req: any, res: any) {
    if (!runCors(req, res)) return;

    try {
        const user = await getAuthenticatedUser(req, res);
        if (!user) return;

        if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

        const supabase = getSupabase();
        if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

        // Parse local file
        await runMiddleware(req, res, upload.single('cvFile'));
        
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        let textContent = "";
        const fileName = file.originalname;

        if (file.mimetype === "application/pdf") {
            const pdfData = await pdfParse(file.buffer);
            textContent = pdfData.text;
        } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith(".docx")) {
            const docResult = await mammoth.extractRawText({ buffer: file.buffer });
            textContent = docResult.value;
        } else {
            textContent = file.buffer.toString("utf-8");
        }

        if (!textContent || textContent.trim().length < 50) {
            return res.status(400).json({ error: "Could not extract enough text from file. Please ensure it's a valid CV." });
        }

        // AI process
        const openaiPayload = await parseCVTextAndGenerateSummary(textContent);
        const score = openaiPayload.score || 72;
        const cvId = `cv-${Date.now()}`;
        const status = score >= 80 ? "VALIDATED" : (score >= 60 ? "ANALYSED" : "REJECTED");

        const analyzedCV = {
            id: cvId, 
            userId: user.id, 
            fileName: fileName || "Resume", 
            status,
            score,
            grammarScore: openaiPayload.grammarScore || 70, 
            impactScore: openaiPayload.impactScore || 65, 
            skillsScore: openaiPayload.skillsScore || 75,
            summary: openaiPayload.summary || "Parsed Resume", 
            suggestions: openaiPayload.recommendations || [],
            strengths: openaiPayload.strengths || [], 
            weaknesses: openaiPayload.weaknesses || [], 
            atsOptimizations: openaiPayload.atsOptimizations || [],
            grammarImprovements: openaiPayload.grammarImprovements || [], 
            recommendations: openaiPayload.recommendations || [],
            skillsMatched: openaiPayload.skillsMatched || [], 
            skillsMissing: openaiPayload.skillsMissing || [],
            parsedDetails: {
                ...(openaiPayload.parsedDetails || {}),
                keywordMatching: openaiPayload.keywordMatching || 70,
            }, 
            updatedAt: new Date().toISOString()
        };

        const { error: insertErr } = await supabase.from('cvs').insert([analyzedCV]);
        if (insertErr) throw insertErr;

        await logActivity(user.id, user.tenantId, "analysis", `CV "${fileName}" analyzed with score ${score}%. Status: ${status}.`);

        res.status(200).json(analyzedCV);
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Upload failure" });
    }
}
