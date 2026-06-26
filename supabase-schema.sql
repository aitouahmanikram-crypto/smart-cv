-- Run these commands in the Supabase SQL Editor to create the required tables

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  name TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cvs (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id),
  "fileName" TEXT NOT NULL,
  status TEXT,
  score INTEGER,
  "grammarScore" INTEGER,
  "impactScore" INTEGER,
  "skillsScore" INTEGER,
  summary TEXT,
  suggestions JSONB,
  strengths JSONB,
  weaknesses JSONB,
  "atsOptimizations" JSONB,
  "grammarImprovements" JSONB,
  recommendations JSONB,
  "skillsMatched" JSONB,
  "skillsMissing" JSONB,
  "parsedDetails" JSONB,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cover_letters (
  id TEXT PRIMARY KEY,
  "cvId" TEXT REFERENCES cvs(id),
  "userId" TEXT NOT NULL REFERENCES users(id),
  "recipientName" TEXT,
  "companyName" TEXT NOT NULL,
  "jobTitle" TEXT NOT NULL,
  "jobDescription" TEXT,
  "generatedText" TEXT,
  status TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  category TEXT,
  type TEXT,
  description TEXT,
  requirements JSONB,
  salary TEXT,
  "postedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  "cvId" TEXT NOT NULL REFERENCES cvs(id),
  "jobId" TEXT NOT NULL, -- Could reference jobs(id), but "custom" jobs don't exist in jobs table
  "customJob" JSONB,
  "matchScore" INTEGER,
  "fitSummary" TEXT,
  strengths JSONB,
  gaps JSONB,
  "applicationStrategy" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id),
  "tenantId" TEXT,
  type TEXT,
  message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_questions (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id),
  "cvId" TEXT NOT NULL REFERENCES cvs(id),
  category TEXT NOT NULL,
  questions JSONB NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
