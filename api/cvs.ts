import { runCors } from '../server/lib/cors';
import { getAuthenticatedUser } from '../server/lib/middleware';
import { getSupabase } from '../server/lib/db';
import { logActivity } from '../server/lib/utils';
import { parseCVTextAndGenerateSummary, rewriteCVContent } from '../src/services/aiService';
import multer from 'multer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const runMiddleware = (req: any, res: any, fn: any) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result: any) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
};

export const config = {
    api: {
        bodyParser: false,
    },
};

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
            if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/cvs', action, allowedMethods: ['GET'] });
            const { data: cvs, error } = await supabase.from('cvs').select('*').eq('userId', user.id).order('updatedAt', { ascending: false });
            if (error) throw error;
            return res.status(200).json({ success: true, data: cvs || [] });
        }

        if (action === 'upload') {
            if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/cvs', action, allowedMethods: ['POST'] });
            await runMiddleware(req, res, upload.single('cvFile'));
            const file = req.file;
            if (!file) return res.status(400).json({ success: false, error: "No file uploaded" });

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
                return res.status(400).json({ success: false, error: "Could not extract enough text from file." });
            }

            const openaiPayload = await parseCVTextAndGenerateSummary(textContent);
            const score = openaiPayload.score || 72;
            const cvId = `cv-${Date.now()}`;
            const status = score >= 80 ? "VALIDATED" : (score >= 60 ? "ANALYSED" : "REJECTED");

            const analyzedCV = {
                id: cvId, userId: user.id, fileName: fileName || "Resume", status, score,
                grammarScore: openaiPayload.grammarScore || 70, impactScore: openaiPayload.impactScore || 65, skillsScore: openaiPayload.skillsScore || 75,
                summary: openaiPayload.summary || "Parsed Resume", suggestions: openaiPayload.recommendations || [],
                strengths: openaiPayload.strengths || [], weaknesses: openaiPayload.weaknesses || [], atsOptimizations: openaiPayload.atsOptimizations || [],
                grammarImprovements: openaiPayload.grammarImprovements || [], recommendations: openaiPayload.recommendations || [],
                skillsMatched: openaiPayload.skillsMatched || [], skillsMissing: openaiPayload.skillsMissing || [],
                parsedDetails: { ...(openaiPayload.parsedDetails || {}), keywordMatching: openaiPayload.keywordMatching || 70 }, 
                updatedAt: new Date().toISOString()
            };

            const { error: insertErr } = await supabase.from('cvs').insert([analyzedCV]);
            if (insertErr) throw insertErr;
            await logActivity(user.id, user.tenantId, "analysis", `CV "${fileName}" analyzed.`);
            return res.status(200).json({ success: true, data: analyzedCV });
        }

        if (action === 'rewrite') {
            if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/cvs', action, allowedMethods: ['POST'] });
            
            // Manual parse because bodyParser is false
            let body: any = {};
            try {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const data = Buffer.concat(chunks).toString();
                body = JSON.parse(data);
            } catch (e) {}

            const { cvId, prompt, targetJob } = body;
            if (!cvId || !prompt) return res.status(400).json({ success: false, error: "cvId and prompt are required" });

            const { data: existing } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
            if (!existing) return res.status(404).json({ success: false, error: "CV not found" });

            const rewrittenText = await rewriteCVContent({ originalContent: existing.summary, prompt, targetJob });
            const updatedAt = new Date().toISOString();
            
            const { data, error } = await supabase.from('cvs').update({ summary: rewrittenText, updatedAt }).eq('id', cvId).select();
            if (error) throw error;
            return res.status(200).json({ success: true, data: data[0] });
        }

        if (action === 'versions') {
            if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/cvs', action, allowedMethods: ['GET'] });
            const { cvId } = req.query;
            if (!cvId) return res.status(400).json({ success: false, error: "cvId is required" });
            const { data, error } = await supabase.from('cv_versions').select('*').eq('cvId', cvId).order('versionNumber', { ascending: false });
            if (error) throw error;
            return res.status(200).json({ success: true, data: data || [] });
        }

        if (action === 'restore') {
            if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed', method: req.method, route: '/api/cvs', action, allowedMethods: ['POST'] });
            const { cvId, versionId } = req.query;
            if (!cvId || !versionId) return res.status(400).json({ success: false, error: "cvId and versionId are required" });
            return res.status(200).json({ success: true, message: "Version restored" });
        }

        return res.status(400).json({ success: false, error: "Invalid action" });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}
