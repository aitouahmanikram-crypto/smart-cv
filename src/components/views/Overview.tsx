import React, { useEffect, useState, useRef } from "react";
import { FileText, Target, Zap, Clock, ArrowRight, BookOpen, Upload, X, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { ViewType } from "../Dashboard";

interface OverviewProps {
  token: string;
  onNavigate: (view: ViewType) => void;
}

export default function Overview({ token, onNavigate }: OverviewProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Upload Component State
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/dashboard/stats", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error("Failed to load dashboard data");
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError("");
    setUploadSuccess(false);
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
      if (!validTypes.includes(selected.type) && !selected.name.endsWith(".docx")) {
        setUploadError("Currently, only PDF, DOCX, and TXT files are supported for best AI parsing.");
        return;
      }
      setFile(selected);
      handleUpload(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setUploadError("");
    setUploadSuccess(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
      if (!validTypes.includes(droppedFile.type) && !droppedFile.name.endsWith(".docx")) {
        setUploadError("Currently, only PDF, DOCX, and TXT files are supported for best AI parsing.");
        return;
      }
      setFile(droppedFile);
      handleUpload(droppedFile);
    }
  };

  const handleUpload = async (uploadFile: File) => {
    setIsUploading(true);
    setUploadError("");
    
    try {
      const formData = new FormData();
      formData.append("cvFile", uploadFile);
      
      const res = await fetch("/api/cvs/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload and parse CV");
      }
      
      setUploadSuccess(true);
      setTimeout(() => {
        onNavigate('analysis');
      }, 1500);
      
    } catch (err: any) {
      setUploadError(err.message);
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
        Failed to load dashboard: {error}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="font-display text-4xl font-bold text-white tracking-tight">Overview</h1>
        <p className="text-slate-400 mt-1">Check your application metrics and active AI processes.</p>
      </div>

      {/* Quick Upload Component */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4">Quick CV Upload</h3>
        
        {uploadError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-start gap-3 mb-4">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm">{uploadError}</p>
          </div>
        )}

        {uploadSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">CV successfully analyzed! Redirecting...</p>
            </div>
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
        )}

        {!isUploading && !uploadSuccess ? (
          <div 
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors rounded-xl p-8 text-center cursor-pointer flex flex-col items-center justify-center group"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="h-12 w-12 rounded-full bg-slate-800 group-hover:bg-indigo-500/20 flex items-center justify-center mb-3 transition-colors">
              <Upload className="h-6 w-6 text-slate-400 group-hover:text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Click or drag & drop to upload CV</h3>
            <p className="text-xs text-slate-500">PDF, DOCX, or TXT files supported</p>
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              accept=".txt,.pdf,.docx"
              onChange={handleFileSelect}
            />
          </div>
        ) : (
          <div className="p-8 text-center border-2 border-slate-800 rounded-xl bg-slate-900/50">
            {isUploading && (
              <div className="flex flex-col items-center justify-center">
                <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
                <p className="text-indigo-400 font-medium">Analyzing with AI...</p>
              </div>
            )}
            {uploadSuccess && (
              <p className="text-emerald-400 font-medium">Analysis complete!</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Resumes</p>
              <h3 className="text-2xl font-bold text-white">{stats?.cvsCount || 0}</h3>
            </div>
          </div>
          <button onClick={() => onNavigate('upload')} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors">
            Upload new <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Avg ATS Score</p>
              <h3 className="text-2xl font-bold text-white">{stats?.averageScore || 0}<span className="text-sm text-slate-500 font-normal">/100</span></h3>
            </div>
          </div>
          <button onClick={() => onNavigate('analysis')} className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 transition-colors">
            View Analysis <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Letters</p>
              <h3 className="text-2xl font-bold text-white">{stats?.lettersCount || 0}</h3>
            </div>
          </div>
          <button onClick={() => onNavigate('letters')} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors">
            Draft letter <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Matches</p>
              <h3 className="text-2xl font-bold text-white">{stats?.matchesCount || 0}</h3>
            </div>
          </div>
          <button onClick={() => onNavigate('matching')} className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors">
            Find jobs <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-white mb-6">Recent AI Activity</h3>
          
          <div className="space-y-4">
            {stats?.recentActivity?.length > 0 ? (
              stats.recentActivity.map((activity: any) => (
                <div key={activity.id} className="flex gap-4 p-4 rounded-xl bg-slate-950 border border-slate-900">
                  <div className="mt-1 shrink-0">
                    <Clock className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-300">{activity.message}</p>
                    <p className="text-xs text-slate-500 mt-1 font-mono">{new Date(activity.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No recent activity. Try uploading a CV!
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6 rounded-2xl bg-gradient-to-b from-indigo-500/10 to-slate-900/60 border border-indigo-500/20 backdrop-blur-sm shadow-xl shadow-indigo-500/5">
          <h3 className="text-lg font-bold text-white mb-2">Pro Tip</h3>
          <p className="text-sm text-indigo-200 mb-6 leading-relaxed">
            Did you know candidates who tailor their cover letter to specific JD keywords have a 45% higher interview conversion rate?
          </p>
          <button 
            onClick={() => onNavigate('matching')}
            className="w-full py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
          >
            Start Matching
          </button>
        </div>
      </div>
    </div>
  );
}
