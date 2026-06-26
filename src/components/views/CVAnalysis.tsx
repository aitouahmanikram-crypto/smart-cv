import React, { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, Target, Edit3, ShieldCheck, Zap, Activity, Download, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import jsPDF from "jspdf";
import CVPreview from "../CVPreview";

export default function CVAnalysis({ token }: { token: string }) {
  const [cvs, setCvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCv, setSelectedCv] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const fetchCVs = async () => {
      try {
        const res = await fetch("/api/cvs", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error("Failed to load analyzed CVs");
        const data = await res.json();
        setCvs(data);
        if (data.length > 0) {
          setSelectedCv(data[0]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCVs();
  }, [token]);

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
        {error}
      </div>
    );
  }

  if (cvs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
          <Edit3 className="h-8 w-8 text-slate-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">No CVs Analyzed</h3>
          <p className="text-slate-400 mt-2 max-w-md">Upload a plain text version of your resume to see your complete technical analysis.</p>
        </div>
      </div>
    );
  }

  const getChartData = (cv: any) => {
    return [
      { name: 'Grammar', score: cv.grammarScore || 0, color: '#8b5cf6' }, // Purple
      { name: 'Impact', score: cv.impactScore || 0, color: '#ec4899' },  // Pink
      { name: 'Skills', score: cv.skillsScore || 0, color: '#10b981' }   // Emerald
    ];
  };

  const handleDownloadPDF = () => {
    if (!selectedCv) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const textAreaWidth = pageWidth - margin * 2;

    // Header styling
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("CV Analysis Report", margin, 25);
    
    // Sub-header details
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Candidate: ${selectedCv.parsedDetails?.name || "Unknown"}`, margin, 55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`File: ${selectedCv.fileName}`, margin, 63);
    doc.text(`Date Evaluated: ${new Date(selectedCv.updatedAt).toLocaleDateString()}`, margin, 71);
    
    // Line separator
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(margin, 78, pageWidth - margin, 78);

    // Overall Score
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Overall Strength Score: ${selectedCv.score}/100`, margin, 90);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const summaryLines = doc.splitTextToSize(String(selectedCv.summary || "No summary available"), textAreaWidth);
    doc.text(summaryLines, margin, 100);
    
    let currentY = 100 + (summaryLines.length * 6) + 10;
    
    const writeSection = (title: string, items: any[], bulletColor = [79, 70, 229]) => {
      if (!items || !Array.isArray(items) || items.length === 0) return;
      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(title, margin, currentY);
      currentY += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      
      items.forEach(item => {
        if (currentY > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          currentY = margin;
        }
        
        doc.setFillColor(bulletColor[0], bulletColor[1], bulletColor[2]);
        doc.circle(margin + 2, currentY - 1, 1.5, "F");
        
        const textLines = doc.splitTextToSize(String(item), textAreaWidth - 8);
        doc.text(textLines, margin + 8, currentY);
        currentY += textLines.length * 6 + 4;
      });
      currentY += 4;
    };
    
    writeSection("Core Strengths", selectedCv.strengths || [], [16, 185, 129]); // emerald
    writeSection("Key Weaknesses", selectedCv.weaknesses || [], [244, 63, 94]); // rose
    writeSection("Matched Skills", selectedCv.skillsMatched || [], [59, 130, 246]); // blue
    writeSection("Missing Standards", selectedCv.skillsMissing || [], [245, 158, 11]); // amber
    writeSection("ATS Optimizations", selectedCv.atsOptimizations || [], [168, 85, 247]); // purple
    writeSection("Recommendations", selectedCv.recommendations || selectedCv.suggestions || [], [99, 102, 241]); // indigo

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Generated by AI CV Coach • ${new Date().getFullYear()}`, margin, pageHeight - 15);

    doc.save(`CV_Analysis_${selectedCv.parsedDetails?.name?.replace(/\s+/g, '_') || 'Report'}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-white tracking-tight">AI CV Analysis Engine</h1>
          <p className="text-slate-400 mt-1">Review the OpenAI-generated metrics, gaps, and extracted skills.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {cvs.length > 1 && (
            <select 
              className="bg-slate-900 border border-slate-800 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              onChange={(e) => setSelectedCv(cvs.find(c => c.id === e.target.value))}
              value={selectedCv?.id}
            >
              {cvs.map(c => (
                <option key={c.id} value={c.id}>{c.fileName} - {new Date(c.updatedAt).toLocaleDateString()}</option>
              ))}
            </select>
          )}
          {selectedCv && (
            <div className="flex gap-2">
              <button 
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors border border-slate-700 shadow-lg"
              >
                <Eye className="h-4 w-4" /> View Parsed Data
              </button>
              <button 
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors border border-indigo-500 hover:border-indigo-400 shadow-lg"
              >
                <Download className="h-4 w-4" /> Export Report PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedCv && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            {/* Score Card */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm flex flex-col items-center py-10">
              <div className="relative h-32 w-32 rounded-full flex items-center justify-center mb-4">
                <svg className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="64" cy="64" r="56" fill="transparent" stroke="rgba(15, 23, 42, 1)" strokeWidth="12" />
                  <circle 
                    cx="64" cy="64" r="56" 
                    fill="transparent" 
                    stroke="url(#gradient)" 
                    strokeWidth="12" 
                    strokeDasharray="351.86" 
                    strokeDashoffset={351.86 - (351.86 * selectedCv.score) / 100}
                    className="transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="text-center absolute">
                  <span className="text-4xl font-bold text-white">{selectedCv.score}</span>
                  <span className="text-xs font-mono text-slate-500 block">/100</span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-white text-center">Overall Strength</h3>
              <p className="text-xs text-slate-400 text-center mt-1 max-w-[200px]">{selectedCv.summary}</p>
            </div>

            {/* Metrics Breakdown Chart */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-4">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2 font-mono">Score Breakdown</h4>
              <div className="h-48 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData(selectedCv)} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={60} />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', borderRadius: '8px' }} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                      {
                        getChartData(selectedCv).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Strengths & Weaknesses */}
            <div className="space-y-4">
               {selectedCv.strengths?.length > 0 && (
                 <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                   <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2"><CheckCircle className="h-4 w-4"/> Core Strengths</h4>
                   <ul className="space-y-2">
                     {selectedCv.strengths.map((str: string, i: number) => (
                       <li key={i} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                         <span className="text-emerald-500 mt-0.5">•</span> {str}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
               {selectedCv.weaknesses?.length > 0 && (
                 <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                   <h4 className="text-sm font-bold text-rose-400 mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4"/> Key Weaknesses</h4>
                   <ul className="space-y-2">
                     {selectedCv.weaknesses.map((wk: string, i: number) => (
                       <li key={i} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                         <span className="text-rose-500 mt-0.5">•</span> {wk}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            
            {/* Detailed ATS Score */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm lg:col-span-3">
               <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-400" /> Detailed ATS Score
               </h3>
               
               <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: "Keyword Match", score: selectedCv.parsedDetails?.keywordMatching || 0 },
                    { label: "Format Quality", score: selectedCv.parsedDetails?.formattingQuality || 0 },
                    { label: "Skills Coverage", score: selectedCv.parsedDetails?.skillsCoverage || 0 },
                    { label: "Exp. Relevance", score: selectedCv.parsedDetails?.experienceRelevance || 0 },
                    { label: "Edu. Relevance", score: selectedCv.parsedDetails?.educationRelevance || 0 }
                  ].map((stat, i) => (
                    <div key={i} className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center flex flex-col items-center justify-center">
                       <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">{stat.label}</span>
                       <div className="relative h-12 w-12 flex flex-col items-center justify-center rounded-full border-2 border-indigo-500/30">
                          <span className="text-white font-bold text-sm">{stat.score}%</span>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ATS Optimization */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-400" /> ATS Recommendations
                </h3>
                <ul className="space-y-4">
                  {selectedCv.atsOptimizations?.length > 0 ? selectedCv.atsOptimizations.map((s: string, idx: number) => (
                    <li key={idx} className="flex gap-3 items-start p-3 bg-slate-950 rounded-xl border border-slate-900">
                      <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed">{s}</p>
                    </li>
                  )) : (
                    <p className="text-xs text-slate-500 italic">No ATS improvements flagged.</p>
                  )}
                </ul>
              </div>

              {/* Professional Recommendations */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-400" /> Professional Recs
                </h3>
                <ul className="space-y-4">
                  {selectedCv.recommendations?.length > 0 ? selectedCv.recommendations.map((s: string, idx: number) => (
                    <li key={idx} className="flex gap-3 items-start p-3 bg-slate-950 rounded-xl border border-slate-900">
                      <Target className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed">{s}</p>
                    </li>
                  )) : selectedCv.suggestions?.map((s: string, idx: number) => (
                    <li key={idx} className="flex gap-3 items-start p-3 bg-slate-950 rounded-xl border border-slate-900">
                      <Target className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed">{s}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Grammar Improvements */}
            {selectedCv.grammarImprovements?.length > 0 && (
              <div className="p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                <h4 className="text-sm font-bold text-indigo-400 mb-3 flex items-center gap-2"><Edit3 className="h-4 w-4"/> Grammar & Wording Fixes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedCv.grammarImprovements.map((fix: string, i: number) => (
                    <div key={i} className="text-xs text-slate-300 leading-relaxed p-3 bg-slate-900/50 rounded-lg border border-slate-800 border-l-4 border-l-indigo-500">
                      {fix}
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* Extracted Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 font-mono flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" /> Active Skills Found
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCv.skillsMatched?.length > 0 ? selectedCv.skillsMatched.map((skill: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-1 text-xs font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
                      {skill}
                    </span>
                  )) : (
                    <span className="text-xs text-slate-500 italic">No explicit skills mapped.</span>
                  )}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 font-mono flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" /> Missing Industry Standards
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCv.skillsMissing?.length > 0 ? selectedCv.skillsMissing.map((skill: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-1 text-xs font-mono bg-rose-500/10 text-rose-400 rounded border border-rose-500/20">
                      {skill}
                    </span>
                  )) : (
                    <span className="text-xs text-slate-500 italic">No critical gaps identified!</span>
                  )}
                </div>
              </div>
            </div>

            {/* Parsed Profile Info (Read Only) */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
               <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 font-mono">Parsed Identity Data</h3>
               <div className="grid grid-cols-2 gap-y-4 text-sm">
                 <div>
                   <span className="text-slate-500 block text-xs">Name recognized</span>
                   <span className="text-slate-200 font-medium">{selectedCv.parsedDetails?.name || "Not Found"}</span>
                 </div>
                 <div>
                   <span className="text-slate-500 block text-xs">Email mapped</span>
                   <span className="text-slate-200 font-medium">{selectedCv.parsedDetails?.email || "Not Found"}</span>
                 </div>
                 <div>
                   <span className="text-slate-500 block text-xs">Experience Entries</span>
                   <span className="text-slate-200 font-medium">{selectedCv.parsedDetails?.experience?.length || 0} Block(s) detected</span>
                 </div>
                 <div>
                   <span className="text-slate-500 block text-xs">Education Entries</span>
                   <span className="text-slate-200 font-medium">{selectedCv.parsedDetails?.education?.length || 0} Block(s) detected</span>
                 </div>
               </div>
            </div>

            {/* AI Generated Interview Questions */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-400" /> AI Interview Prep
                 </h3>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const allQ = [
                          ...(selectedCv.parsedDetails?.hrQuestions || []),
                          ...(selectedCv.parsedDetails?.technicalQuestions || []),
                          ...(selectedCv.parsedDetails?.behavioralQuestions || [])
                        ].join("\\n");
                        navigator.clipboard.writeText(allQ);
                        alert("Copied to clipboard");
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors border border-slate-700 whitespace-nowrap"
                    >
                      Copy All
                    </button>
                    <button 
                      onClick={() => {
                         const doc = new jsPDF();
                         doc.setFont("helvetica", "bold");
                         doc.setFontSize(16);
                         doc.text("Interview Prep Questions", 20, 20);
                         doc.setFontSize(12);
                         doc.setFont("helvetica", "normal");
                         
                         let y = 30;
                         const addSection = (title: string, qs: string[]) => {
                           if (!qs || !qs.length) return;
                           doc.setFont("helvetica", "bold");
                           doc.text(title, 20, y);
                           y += 10;
                           doc.setFont("helvetica", "normal");
                           qs.forEach(q => {
                             const splitted = doc.splitTextToSize(`• ${q}`, 170);
                             doc.text(splitted, 20, y);
                             y += 5 * splitted.length;
                             if (y > 280) { doc.addPage(); y = 20; }
                           });
                           y += 10;
                         };
                         
                         addSection("HR Questions", selectedCv.parsedDetails?.hrQuestions);
                         addSection("Technical Questions", selectedCv.parsedDetails?.technicalQuestions);
                         addSection("Behavioral Questions", selectedCv.parsedDetails?.behavioralQuestions);
                         doc.save(`Interview_Prep_${selectedCv.id}.pdf`);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors border border-indigo-500 whitespace-nowrap"
                    >
                      Export PDF
                    </button>
                 </div>
               </div>
               {(selectedCv.parsedDetails?.hrQuestions?.length > 0 || selectedCv.parsedDetails?.technicalQuestions?.length > 0) ? (
                 <div className="space-y-6">
                    {selectedCv.parsedDetails?.hrQuestions?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-emerald-400 mb-3 border-b border-slate-800 pb-2">HR & Cultural Fit</h4>
                        <ul className="space-y-2">
                           {selectedCv.parsedDetails.hrQuestions.map((q: string, i: number) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <span className="text-emerald-500">•</span> {q}
                              </li>
                           ))}
                        </ul>
                      </div>
                    )}
                    {selectedCv.parsedDetails?.technicalQuestions?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-blue-400 mb-3 border-b border-slate-800 pb-2">Technical Deep-Dive</h4>
                        <ul className="space-y-2">
                           {selectedCv.parsedDetails.technicalQuestions.map((q: string, i: number) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <span className="text-blue-500">•</span> {q}
                              </li>
                           ))}
                        </ul>
                      </div>
                    )}
                    {selectedCv.parsedDetails?.behavioralQuestions?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-purple-400 mb-3 border-b border-slate-800 pb-2">Behavioral & Past Scenarios</h4>
                        <ul className="space-y-2">
                           {selectedCv.parsedDetails.behavioralQuestions.map((q: string, i: number) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <span className="text-purple-500">•</span> {q}
                              </li>
                           ))}
                        </ul>
                      </div>
                    )}
                 </div>
               ) : (
                 <p className="text-slate-500 italic text-sm">No interview questions generated. Upload a new version to enable this feature.</p>
               )}
            </div>
            
          </div>
        </div>
      )}

      {previewOpen && selectedCv?.parsedDetails && (
        <CVPreview 
          parsedDetails={selectedCv.parsedDetails} 
          onClose={() => setPreviewOpen(false)} 
        />
      )}
    </div>
  );
}
