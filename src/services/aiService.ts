import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
export function getGemini(): GoogleGenAI {
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
        }
      }
    });
  }
  return aiClient;
}

export async function parseCVTextAndGenerateSummary(textContent: string) {
  const ai = getGemini();

  const promptMessage = `
    Please analyze the following CV text. Extract standard details and perform a detailed, rigorous assessment.
    Score the CV on CV Quality metric parameters between 0 and 100:
    - score (overall score)
    - grammarScore (correct layouts, readability, consistency)
    - impactScore (action-verb strength, measurable business metrics or bullet performance)
    - skillsScore (presence of key tools, structure of skills section)
    
    Calculate an ATS Detailed Score between 0 and 100 for these specific ATS metrics:
    - keywordMatching
    - formattingQuality
    - skillsCoverage
    - experienceRelevance
    - educationRelevance
    
    Based on the CV, generate targeted interview questions (minimum 5 per category):
    - hrQuestions
    - technicalQuestions
    - behavioralQuestions
    - situationalQuestions

    Provide:
    - summary: A brief elevator pitch of the candidate.
    - strengths: List of 3 to 5 core strengths.
    - weaknesses: List of 2 to 3 main weaknesses or missing components.
    - atsOptimizations: 3 actionable suggestions to improve ATS parsing.
    - grammarImprovements: 2 to 3 suggestions to fix typos or grammar nuances.
    - recommendations: 3 highly actionable professional recommendations to improve the resume.
    - skillsMatched: Explicit skills found.
    - skillsMissing: Highly standard skills missing based on their role level.
    - parsedDetails: Including name, email, phone, experience (array of items), education (array of items).

    Output must be strictly raw valid JSON. Use this structure exactly:
    {
      "score": number, "grammarScore": number, "impactScore": number, "skillsScore": number,
      "keywordMatching": number, "formattingQuality": number, "skillsCoverage": number, "experienceRelevance": number, "educationRelevance": number,
      "summary": "string", "strengths": ["string"], "weaknesses": ["string"], 
      "atsOptimizations": ["string"], "grammarImprovements": ["string"], "recommendations": ["string"],
      "skillsMatched": ["string"], "skillsMissing": ["string"],
      "hrQuestions": ["string"], "technicalQuestions": ["string"], "behavioralQuestions": ["string"], "situationalQuestions": ["string"],
      "parsedDetails": {
        "name": "string", "email": "string", "phone": "string",
        "skills": ["string"], "experience": ["string"], "education": ["string"]
      }
    }

    CV Context Text:
    ${textContent}
  `;

  // Fallback to gemini-2.5-flash as it's more stable for these generic tasks if 2.5 is unavailable
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: promptMessage,
    config: {
      systemInstruction: "You are an expert HR and ATS parser. Respond with JSON only.",
      responseMimeType: "application/json",
    }
  });

  const responseText = response.text || "{}";
  return JSON.parse(responseText.trim());
}

export async function generateCoverLetter(jobDescription: string, parsedCvText: string, companyName: string, jobTitle: string, experienceLevel: string, skills: string, recipientName: string) {
  const ai = getGemini();

  const promptMessage = `
    Write a highly compelling, professional, personalized cover letter for the position: "${jobTitle}" at "${companyName}".
    Recipient Name: "${recipientName || "Hiring Manager"}".
    Experience Level: "${experienceLevel || "Not specified"}".
    Key Skills: "${skills || "Not specified"}".
    Job context or description (if any): "${jobDescription || ""}".

    Candidate credentials details:
    ${parsedCvText || "Use the provided Experience Level and Key Skills above."}

    Return a JSON payload with a single key 'generatedText' containing the professionally formatted letter. Provide crisp paragraphs with a greeting, hooks emphasizing candidate strengths, and a call to action. Do not include placeholder text like [Your Name] for the candidate, just sign off professionally.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: promptMessage,
    config: {
      systemInstruction: "You are a master executive resume writer. Generate outstanding, custom cover letters. Output JSON only.",
      responseMimeType: "application/json",
    }
  });

  const payloadText = response.text || "{}";
  const payload = JSON.parse(payloadText.trim());
  return payload.generatedText || "Failed to auto-write letter. Please retry.";
}

export async function analyzeJobMatch(cvDetails: any, jobDetails: any) {
  const ai = getGemini();

  const promptMessage = `
    Compare the candidate CV with the target Job application profile:

    Job Title: ${jobDetails.title}
    Company: ${jobDetails.company || "Not specified"}
    Job Requirements: ${jobDetails.requirements ? JSON.stringify(jobDetails.requirements) : "Not specified"}
    Job Description: ${jobDetails.description}

    Candidate Resume Details:
    Skills: ${JSON.stringify(cvDetails.skills)}
    Experience Summary: ${JSON.stringify(cvDetails.experience)}

    Analyze carefully:
    1. What is the match percentage? (matchScore: 0-100)
    2. Sum physical gaps, missing tools / technologies, or design patterns ("gaps")
    3. Sum absolute strengths that map perfectly to the company requirements ("strengths")
    4. Create a concise fitSummary (2 sentences)
    5. Formulate a specific applicationStrategy for standard submissions.

    Strictly output valid JSON matching the schema.
  `;

  // @ts-ignore
  const { Type } = await import("@google/genai");
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: promptMessage,
    config: {
      systemInstruction: "You are SmartCV SaaS evaluation bot. Match candidate skills precisely with corporate reqs.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matchScore: { type: Type.INTEGER },
          fitSummary: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          applicationStrategy: { type: Type.STRING }
        },
        required: ["matchScore", "fitSummary", "strengths", "gaps", "applicationStrategy"]
      }
    }
  });

  return JSON.parse(result.text || "{}");
}
