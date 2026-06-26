import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";

import pdfParse from "pdf-parse/lib/pdf-parse.js";

import mammoth from "mammoth";
import OpenAI from "openai";
import { parseCVTextAndGenerateSummary, generateCoverLetter, analyzeJobMatch } from "./src/services/aiService.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_default_secret_for_dev_only";

// Configure multer for in-memory file uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const app = express();
const PORT = 3000;
import { supabase } from "./src/lib/supabase.js";

// Parse text/json payloads
app.use(express.json({ limit: "25mb" }));

// Initialize GoogleGenAI client lazily if key is available
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("⚠️ GEMINI_API_KEY environment variable is not defined or is empty!");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY_FOR_LINT",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      console.warn("⚠️ OPENAI_API_KEY environment variable is not defined or is empty!");
    }
    openaiClient = new OpenAI({
      apiKey: key || "MOCK_KEY_FOR_LINT",
    });
  }
  return openaiClient;
}

// Secure token mechanism using jsonwebtoken
function generateToken(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId }, JWT_SECRET, { expiresIn: "24h" });
}

function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

// Authentication Middleware
function authenticate(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization token" });
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Session expired or invalid token" });
  }
  req.user = decoded;
  next();
}

// Seed / Initial Database schema
interface DatabaseSchema {
  users: Array<{ id: string; email: string; passwordHash: string; name: string; tenantId: string; title?: string; bio?: string; createdAt: string }>;
  cvs: any[];
  coverLetters: any[];
  matches: any[];
  jobs: any[];
  activities: any[];
}


// Add global Activity Log Helper for event-driven telemetry (Issue #4, #6 resolved)
async function logActivity(userId: string, tenantId: string, type: 'upload' | 'analysis' | 'letter' | 'match', message: string) {
  try {
    await supabase.from('activities').insert([{
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId,
      tenantId,
      type,
      message,
      timestamp: new Date().toISOString()
    }]);
  } catch (err) {
    console.error("Failed to log activity to Supabase", err);
  }
}

// --- API ROUTES ---

// Health & Metadata check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString(), platform: "SmartCV AI" });
});

// Authentication Routes
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: "Name, email, and password are required fields" });

  try {
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (existing) return res.status(400).json({ error: "An account with this email address already exists" });

    const userId = `user-${Date.now()}`;
    const tenantId = `tenant-${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    const { error } = await supabase.from('users').insert([{
      id: userId,
      email: email.toLowerCase(),
      passwordHash: passwordHash,
      name,
      tenantId: tenantId,
      createdAt: new Date().toISOString()
    }]);

    if (error) throw error;

    const token = generateToken(userId, tenantId);
    logActivity(userId, tenantId, "upload", `Account registered for ${name}`);

    res.status(201).json({ token, user: { id: userId, email, name, tenantId: tenantId } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (!user || error) return res.status(401).json({ error: "Invalid email or password" });

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

    const token = generateToken(user.id, user.tenantId);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, title: user.title, bio: user.bio } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authenticate, async (req: any, res) => {
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('id', req.user.userId).maybeSingle();
    if (!user || error) return res.status(404).json({ error: "User profile not found" });
    res.json({ id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, title: user.title || "", bio: user.bio || "", createdAt: user.createdAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/profile/update", authenticate, async (req: any, res) => {
  const { name, title, bio } = req.body;
  try {
    const updatePayload: any = {};
    if (name) updatePayload.name = name;
    if (title !== undefined) updatePayload.title = title;
    if (bio !== undefined) updatePayload.bio = bio;

    const { error } = await supabase.from('users').update(updatePayload).eq('id', req.user.userId);
    if (error) throw error;
    res.json({ success: true, user: updatePayload });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/jobs", async (req, res) => {
  try {
    const { data, error } = await supabase.from('jobs').select('*').order('postedAt', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/create", authenticate, async (req: any, res) => {
  const { title, company, location, category, type, description, requirements, salary } = req.body;
  if (!title || !company || !description) return res.status(400).json({ error: "Title, company, and description are required" });

  try {
    const reqArray = Array.isArray(requirements) ? requirements : [requirements];
    const newJob = {
      id: `job-${Date.now()}`,
      title, company, location: location || "Remote", category: category || "General", type: type || "Full-time",
      description, requirements: reqArray.filter(Boolean), salary: salary || "Undisclosed", postedAt: new Date().toISOString()
    };
    const { error } = await supabase.from('jobs').insert([newJob]);
    if (error) throw error;
    logActivity(req.user.userId, req.user.tenantId, "match", `Added new job posting: ${title} at ${company}`);
    res.status(201).json(newJob);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cvs", authenticate, async (req: any, res) => {
  try {
    const { data, error } = await supabase.from('cvs').select('*').eq('userId', req.user.userId);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cvs/upload", authenticate, upload.single("cvFile"), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No CV file was uploaded." });
  const fileName = req.file.originalname;
  let textContent = "";

  try {
    if (req.file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(req.file.buffer);
      textContent = pdfData.text;
    } else if (req.file.mimetype.includes("wordprocessingml") || fileName.toLowerCase().endsWith(".docx")) {
      const docxData = await mammoth.extractRawText({ buffer: req.file.buffer });
      textContent = docxData.value;
    } else if (req.file.mimetype === "text/plain" || fileName.toLowerCase().endsWith(".txt")) {
      textContent = req.file.buffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type." });
    }
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to read file: " + err.message });
  }

  if (!textContent || textContent.trim().length < 50) return res.status(400).json({ error: "Not enough text found." });

  logActivity(req.user.userId, req.user.tenantId, "upload", `Initiated CV upload parsing: ${fileName}`);

  try {
    const openaiPayload = await parseCVTextAndGenerateSummary(textContent);
    const score = openaiPayload.score || 72;
    const cvId = `cv-${Date.now()}`;

    const analyzedCV = {
      id: cvId, userId: req.user.userId, fileName: fileName || "Resume", status: "ANALYSED", score,
      grammarScore: openaiPayload.grammarScore || 70, impactScore: openaiPayload.impactScore || 65, skillsScore: openaiPayload.skillsScore || 75,
      summary: openaiPayload.summary || "Parsed Resume", suggestions: openaiPayload.recommendations || [],
      strengths: openaiPayload.strengths || [], weaknesses: openaiPayload.weaknesses || [], atsOptimizations: openaiPayload.atsOptimizations || [],
      grammarImprovements: openaiPayload.grammarImprovements || [], recommendations: openaiPayload.recommendations || [],
      skillsMatched: openaiPayload.skillsMatched || [], skillsMissing: openaiPayload.skillsMissing || [],
      parsedDetails: {
        ...(openaiPayload.parsedDetails || {}),
        keywordMatching: openaiPayload.keywordMatching || 70,
        formattingQuality: openaiPayload.formattingQuality || 70,
        skillsCoverage: openaiPayload.skillsCoverage || 70,
        experienceRelevance: openaiPayload.experienceRelevance || 70,
        educationRelevance: openaiPayload.educationRelevance || 70,
        hrQuestions: openaiPayload.hrQuestions || [],
        technicalQuestions: openaiPayload.technicalQuestions || [],
        behavioralQuestions: openaiPayload.behavioralQuestions || [],
        situationalQuestions: openaiPayload.situationalQuestions || []
      }, updatedAt: new Date().toISOString()
    };

    const { error } = await supabase.from('cvs').insert([analyzedCV]);
    if (error) throw error;

    logActivity(req.user.userId, req.user.tenantId, "analysis", `CV Analyzed: ${fileName}. Score: ${score}/100.`);
    res.json(analyzedCV);
  } catch (error: any) {
    res.status(500).json({ error: "Gemini parser failure: " + error.message });
  }
});

app.get("/api/cover-letters", authenticate, async (req: any, res) => {
  try {
    const { data, error } = await supabase.from('cover_letters').select('*').eq('userId', req.user.userId);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cover-letters/generate", authenticate, async (req: any, res) => {
  const { cvId, companyName, jobTitle, recipientName, jobDescription, experienceLevel, skills } = req.body;
  if (!companyName || !jobTitle) return res.status(400).json({ error: "companyName and jobTitle required" });

  let parsedText = "";
  if (cvId) {
    const { data: cv } = await supabase.from('cvs').select('parsedDetails').eq('id', cvId).eq('userId', req.user.userId).maybeSingle();
    if (cv) { parsedText = JSON.stringify(cv.parsedDetails); }
    else if (!experienceLevel && !skills) return res.status(404).json({ error: "CV not found" });
  }

  try {
    const letterText = await generateCoverLetter(jobDescription || "", parsedText, companyName, jobTitle, experienceLevel || "", skills || "", recipientName || "");
    const newLetter = {
      id: `letter-${Date.now()}`, cvId: cvId || null, userId: req.user.userId, recipientName: recipientName || "Hiring Manager",
      companyName, jobTitle, jobDescription, generatedText: letterText, status: "COMPLETED", createdAt: new Date().toISOString()
    };

    const { error } = await supabase.from('cover_letters').insert([newLetter]);
    if (error) throw error;

    logActivity(req.user.userId, req.user.tenantId, "letter", `Generated Cover Letter for ${jobTitle}`);
    res.json(newLetter);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/matches", authenticate, async (req: any, res) => {
  try {
    const { data: cvs } = await supabase.from('cvs').select('id').eq('userId', req.user.userId);
    if (!cvs || cvs.length === 0) return res.json([]);
    const cvIds = cvs.map((c: any) => c.id);
    const { data } = await supabase.from('matches').select('*').in('cvId', cvIds);
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/matches/analyze", authenticate, async (req: any, res) => {
  const { cvId, jobId } = req.body;
  if (!cvId || !jobId) return res.status(400).json({ error: "Missing params" });

  try {
    const { data: cv } = await supabase.from('cvs').select('parsedDetails').eq('id', cvId).eq('userId', req.user.userId).maybeSingle();
    const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();

    if (!cv || !job) return res.status(404).json({ error: "CV or Job not found" });

    const payload = await analyzeJobMatch(cv.parsedDetails, job);
    const matchResult = {
      id: `match-${Date.now()}`, cvId, jobId, matchScore: payload.matchScore || 50,
      fitSummary: payload.fitSummary || "", strengths: payload.strengths || [], gaps: payload.gaps || [],
      applicationStrategy: payload.applicationStrategy || "", createdAt: new Date().toISOString()
    };

    await supabase.from('matches').insert([matchResult]);
    res.json(matchResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/matches/custom", authenticate, async (req: any, res) => {
  const { cvId, jobTitle, companyName, jobDescription } = req.body;
  if (!cvId || !jobTitle || !jobDescription) return res.status(400).json({ error: "Missing params" });

  try {
    const { data: cv } = await supabase.from('cvs').select('parsedDetails').eq('id', cvId).eq('userId', req.user.userId).maybeSingle();
    if (!cv) return res.status(404).json({ error: "CV not found" });

    const customJob = {
      id: `custom-job-${Date.now()}`, title: jobTitle, company: companyName || "Custom Job", location: "Remote",
      salary: "Negotiable", type: "Custom", requirements: [], description: jobDescription
    };

    const payload = await analyzeJobMatch(cv.parsedDetails, customJob);
    const matchResult = {
      id: `match-${Date.now()}`, cvId, jobId: customJob.id, customJob: customJob, matchScore: payload.matchScore || 50,
      fitSummary: payload.fitSummary || "", strengths: payload.strengths || [], gaps: payload.gaps || [],
      applicationStrategy: payload.applicationStrategy || "", createdAt: new Date().toISOString()
    };

    await supabase.from('matches').insert([matchResult]);
    res.json(matchResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cvs/rewrite", authenticate, async (req: any, res) => {
  const { text, type } = req.body;
  if (!text) return res.status(400).json({ error: "Text required" });
  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Focus: Rewrite this ${type}\nText:\n${text}`,
      config: { systemInstruction: "You are an executive CV writer. Rewrite professionally." }
    });
    res.json({ result: (response.text || "").trim() });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/api/chat/message", authenticate, async (req: any, res) => {
  const { cvId, message, history } = req.body;
  try {
    let context = "Candidate is browsing.";
    if (cvId) {
      const { data: cv } = await supabase.from('cvs').select('*').eq('id', cvId).maybeSingle();
      if (cv) context = `Skills: ${cv.parsedDetails?.skills?.join(", ")}`;
    }
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: { systemInstruction: "Career Coach guidelines. Context: " + context }
    });
    res.json({ reply: response.text });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get("/api/dashboard/stats", authenticate, async (req: any, res) => {
  try {
    const { data: cvs } = await supabase.from('cvs').select('id, score').eq('userId', req.user.userId);
    const cvsArr = cvs || [];
    const { count: coverLetters } = await supabase.from('cover_letters').select('*', { count: 'exact', head: true }).eq('userId', req.user.userId);
    let matchesCount = 0;
    if (cvsArr.length > 0) {
      const { count } = await supabase.from('matches').select('*', { count: 'exact', head: true }).in('cvId', cvsArr.map(c => c.id));
      matchesCount = count || 0;
    }
    const { data: activities } = await supabase.from('activities').select('*').eq('userId', req.user.userId).order('timestamp', { ascending: false }).limit(5);

    const averageScore = cvsArr.length > 0 
        ? Math.round(cvsArr.reduce((acc, curr) => acc + (curr.score || 0), 0) / cvsArr.length)
        : 0;

    const stats = {
      cvsCount: cvsArr.length,
      averageScore: averageScore,
      latestScore: cvsArr.length > 0 ? Math.max(...cvsArr.map(c => c.score || 0)) : 0,
      lettersCount: coverLetters || 0,
      matchesCount,
      recentActivity: activities || []
    };
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/interview-questions", authenticate, async (req: any, res) => {
  const { cvId, category, questions } = req.body;
  if (!cvId || !category || !questions) return res.status(400).json({ error: "Missing params" });

  try {
    const newRecord = {
      id: `iq-${Date.now()}`,
      userId: req.user.userId,
      tenantId: req.user.tenantId || '',
      type: 'interview_questions',
      message: JSON.stringify({ cvId, category, questions }),
      timestamp: new Date().toISOString()
    };
    
    // Store in activities table as fallback because interview_questions table cannot be created dynamically
    const { error } = await supabase.from('activities').insert([newRecord]);
    if (error) {
      throw error;
    }
    res.json({
       id: newRecord.id,
       userId: newRecord.userId,
       cvId,
       category,
       questions,
       createdAt: newRecord.timestamp
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/history", authenticate, async (req: any, res) => {
  try {
    const { data: cvs } = await supabase.from('cvs').select('*').eq('userId', req.user.userId).order('updatedAt', { ascending: false });
    const { data: coverLetters } = await supabase.from('cover_letters').select('*').eq('userId', req.user.userId).order('createdAt', { ascending: false });
    
    // Collect cv ids to get matches
    const cvIds = cvs ? cvs.map(c => c.id) : [];
    let matches: any[] = [];
    if (cvIds.length > 0) {
      const { data } = await supabase.from('matches').select('*').in('cvId', cvIds).order('createdAt', { ascending: false });
      matches = data || [];
    }

    let interviewQuestions: any[] = [];
    try {
      const { data, error } = await supabase.from('activities').select('*').eq('userId', req.user.userId).eq('type', 'interview_questions').order('timestamp', { ascending: false });
      if (!error && data) {
         interviewQuestions = data.map(act => {
            const parsed = JSON.parse(act.message || '{}');
            return {
               id: act.id,
               userId: act.userId,
               cvId: parsed.cvId,
               category: parsed.category,
               questions: parsed.questions,
               createdAt: act.timestamp
            };
         });
      }
    } catch (e) {
      // ignore
    }

    res.json({
      analyses: cvs || [],
      coverLetters: coverLetters || [],
      matches: matches,
      interviewQuestions: interviewQuestions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/history/:type/:id", authenticate, async (req: any, res) => {
  const { type, id } = req.params;
  try {
    let tableName = "";
    if (type === "analysis") tableName = "cvs";
    else if (type === "coverLetter") tableName = "cover_letters";
    else if (type === "match") tableName = "matches";
    else if (type === "interview") tableName = "activities";
    else return res.status(400).json({ error: "Invalid type" });

    // Ensure they own it. For 'cvs', 'cover_letters', 'activities', userId exists. For 'matches', need to check via cvs.
    if (tableName === 'matches') {
       const { data: match } = await supabase.from('matches').select('cvId').eq('id', id).maybeSingle();
       if (match) {
         const { data: cv } = await supabase.from('cvs').select('userId').eq('id', match.cvId).maybeSingle();
         if (cv && cv.userId === req.user.userId) {
            await supabase.from('matches').delete().eq('id', id);
         } else return res.status(403).json({ error: "Unauthorized" });
       }
    } else {
       await supabase.from(tableName).delete().eq('id', id).eq('userId', req.user.userId);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- VITE MIDDLEWARE AND SPA STATIC ROUTER ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development server integration
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 SmartCV AI running at http://localhost:${PORT}`);
    console.log(`Connected to Supabase PostgreSQL`);
  });
}

startServer();
