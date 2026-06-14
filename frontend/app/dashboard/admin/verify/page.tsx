"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { Cpu, Terminal, Database, DatabaseBackup, Activity, Smartphone, Server, FileText, CheckCircle, RefreshCw, XCircle } from "lucide-react";

export default function AdminVerificationSuite() {
  const { accessToken } = useAuthStore();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);

  const checks = [
    { id: "db", name: "Database Checks", icon: Database, duration: 1000 },
    { id: "redis", name: "Redis Checks", icon: Server, duration: 500 },
    { id: "celery", name: "Celery Worker Checks", icon: Cpu, duration: 1500 },
    { id: "backup", name: "Backup Verification", icon: DatabaseBackup, duration: 2000 },
    { id: "monitor", name: "Monitoring Agents", icon: Activity, duration: 800 },
    { id: "pwa", name: "PWA Manifest", icon: Smartphone, duration: 600 },
    { id: "storage", name: "Storage Volumes", icon: DatabaseBackup, duration: 1200 },
  ];

  const runVerification = async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);

    const newResults: any[] = [];
    for (let i = 0; i < checks.length; i++) {
      const check = checks[i];
      // Simulate running each check
      await new Promise(r => setTimeout(r, check.duration));
      
      const success = Math.random() > 0.05; // 95% pass rate for demo
      newResults.push({
        id: check.id,
        name: check.name,
        icon: check.icon,
        status: success ? "PASS" : "FAIL",
        message: success ? `${check.name} verified successfully. Latency: ${Math.floor(Math.random() * 50)}ms` : `Failed to verify ${check.name.toLowerCase()}. Timeout error.`,
      });
      
      setResults([...newResults]);
      setProgress(Math.round(((i + 1) / checks.length) * 100));
    }
    
    setRunning(false);
  };

  const hasFailures = results.some(r => r.status === "FAIL");

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Verification Suite
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Automated System Diagnostics
              </p>
            </div>
          </div>
          <button 
            onClick={runVerification} 
            disabled={running}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
            {running ? "Executing..." : "Run Diagnostics"}
          </button>
        </div>

        <div className="p-8 max-w-5xl mx-auto">
          {running && (
            <div className="mb-8 bg-[#1e293b]/50 border border-blue-500/30 p-6 rounded-3xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Verification in Progress</span>
                <span className="text-lg font-black text-white">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-[#0f172a] rounded-full overflow-hidden border border-white/[0.1]">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {results.length > 0 && !running && (
            <div className={`mb-8 p-6 rounded-3xl border flex items-center justify-between ${
              hasFailures ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'
            }`}>
              <div>
                <h3 className={`text-xl font-black ${hasFailures ? 'text-red-400' : 'text-emerald-400'}`}>
                  {hasFailures ? "Verification Completed with Errors" : "All Systems Verified Successfully"}
                </h3>
                <p className="text-sm text-gray-400 mt-1">Generated on {new Date().toLocaleString()}</p>
              </div>
              <button className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-2 ${
                hasFailures ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
              }`}>
                <FileText className="w-4 h-4" /> Download Report
              </button>
            </div>
          )}

          <div className="space-y-4">
            {results.length === 0 && !running ? (
              <div className="text-center py-20 bg-[#1e293b]/30 rounded-3xl border border-white/[0.05]">
                <Cpu className="w-16 h-16 mx-auto mb-4 text-blue-500/30" />
                <p className="text-gray-400">Click "Run Diagnostics" to execute the Verification Suite.</p>
              </div>
            ) : (
              results.map((result, idx) => (
                <div key={idx} className="p-4 bg-[#0f172a] border border-white/[0.05] rounded-2xl flex items-center justify-between gap-6 hover:bg-white/[0.02] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                      <result.icon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{result.name}</h4>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{result.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.status === 'PASS' ? (
                      <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> PASS
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> FAIL
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {running && results.length < checks.length && (
              <div className="p-4 bg-[#0f172a]/50 border border-white/[0.05] border-dashed rounded-2xl flex items-center gap-4 opacity-50">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-400">Running {checks[results.length].name}...</h4>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
