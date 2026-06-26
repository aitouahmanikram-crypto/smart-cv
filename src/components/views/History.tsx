import React, { useEffect, useState } from "react";
import { FolderClock, FileText, Zap, ChevronRight, Activity, Trash2, ArrowRight } from "lucide-react";

export default function History({ token }: { token: string }) {
  const [history, setHistory] = useState<any>({ analyses: [], coverLetters: [], matches: [], interviewQuestions: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("analysis");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (type: string, id: string) => {
    if(!confirm("Delete this record permanently?")) return;
    try {
      await fetch(`/api/history/${type}/${id}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` }
      });
      fetchHistory();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'analysis', label: 'CV Analyses', icon: FileText, count: history.analyses.length },
    { id: 'coverLetter', label: 'Cover Letters', icon: Zap, count: history.coverLetters.length },
    { id: 'match', label: 'Job Matches', icon: TargetIcon, count: history.matches.length },
    { id: 'interview', label: 'Interview Prep', icon: Activity, count: history.interviewQuestions.length }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
         <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">History & Assets</h1>
         <p className="mt-2 text-slate-400">Review your past AI scans, generated letters, and matches.</p>
      </div>

      <div className="flex space-x-1 border-b border-slate-800 pb-px overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-start px-4 py-3 rounded-t-xl transition-colors min-w-[140px] ${
              activeTab === tab.id ? 'bg-slate-800 border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1 text-sm font-medium">
              <tab.icon className="h-4 w-4" /> {tab.label}
            </div>
            <span className="text-xs font-mono font-bold bg-slate-900 px-2 py-0.5 rounded">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="pt-4">
        {activeTab === 'analysis' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.analyses.length === 0 && <p className="text-slate-500 italic col-span-full">No CV Analyses yet.</p>}
              {history.analyses.map((item: any) => (
                 <div key={item.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col group hover:border-slate-700 transition">
                    <div className="flex justify-between items-start mb-4">
                       <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] uppercase font-bold tracking-wider rounded border border-indigo-500/20">{item.score || 0}/100</span>
                       <button onClick={() => deleteItem('analysis', item.id)} className="text-slate-500 hover:text-rose-400 transition"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <h3 className="text-white font-bold truncate">{item.fileName}</h3>
                    <p className="text-slate-400 text-xs mt-1 mb-4 flex-grow">{new Date(item.updatedAt).toLocaleDateString()}</p>
                 </div>
              ))}
           </div>
        )}

        {activeTab === 'coverLetter' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.coverLetters.length === 0 && <p className="text-slate-500 italic col-span-full">No Cover Letters generated yet.</p>}
              {history.coverLetters.map((item: any) => (
                 <div key={item.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col group hover:border-slate-700 transition">
                    <div className="flex justify-between items-start mb-4">
                       <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold tracking-wider rounded border border-emerald-500/20">Letter</span>
                       <button onClick={() => deleteItem('coverLetter', item.id)} className="text-slate-500 hover:text-rose-400 transition"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <h3 className="text-white font-bold truncate">{item.jobTitle}</h3>
                    <p className="text-slate-400 text-xs mt-1 mb-4 flex-grow">at {item.companyName} • {new Date(item.createdAt).toLocaleDateString()}</p>
                 </div>
              ))}
           </div>
        )}
        
        {activeTab === 'match' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.matches.length === 0 && <p className="text-slate-500 italic col-span-full">No Job Matches performed yet.</p>}
              {history.matches.map((item: any) => (
                 <div key={item.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col group hover:border-slate-700 transition">
                    <div className="flex justify-between items-start mb-4">
                       <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-[10px] uppercase font-bold tracking-wider rounded border border-amber-500/20">{item.matchScore}% Match</span>
                       <button onClick={() => deleteItem('match', item.id)} className="text-slate-500 hover:text-rose-400 transition"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <h3 className="text-white font-bold truncate">{item.customJob?.title || 'Unknown Job'}</h3>
                    <p className="text-slate-400 text-xs mt-1 mb-4 flex-grow">{new Date(item.createdAt).toLocaleDateString()}</p>
                 </div>
              ))}
           </div>
        )}

        {activeTab === 'interview' && (
           <div className="grid grid-cols-1 gap-4">
              {history.interviewQuestions.length === 0 && <p className="text-slate-500 italic col-span-full">No Interview Questions saved. These will appear when they are extracted from new CV Analysis uploads.</p>}
              {history.interviewQuestions.map((item: any) => (
                 <div key={item.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col group hover:border-slate-700 transition">
                    <div className="flex justify-between items-start mb-4">
                       <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] uppercase font-bold tracking-wider rounded border border-purple-500/20">{item.category}</span>
                       <button onClick={() => deleteItem('interview', item.id)} className="text-slate-500 hover:text-rose-400 transition"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <h3 className="text-white font-bold">{item.category} Prep</h3>
                    <p className="text-slate-400 text-xs mt-1 mb-4 flex-grow">{new Date(item.createdAt).toLocaleDateString()}</p>
                    <div className="space-y-2 mt-2">
                       {item.questions?.slice(0, 3).map((q: string, i: number) => (
                         <p key={i} className="text-sm text-slate-300">• {q}</p>
                       ))}
                       {item.questions?.length > 3 && <p className="text-xs text-slate-500 italic">+{item.questions.length - 3} more questions</p>}
                    </div>
                 </div>
              ))}
           </div>
        )}

      </div>
    </div>
  );
}

function TargetIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
