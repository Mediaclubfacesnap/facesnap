"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { PlayCircle, ShieldCheck, Server, DatabaseBackup, Activity, Smartphone, Rocket, CheckCircle, AlertTriangle } from "lucide-react";

export default function AdminLaunchDashboard() {
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Simulated Launch Readiness Scores based on Phase 6 Metrics
  const scores = [
    { name: "QA Score", value: 96, icon: ShieldCheck, status: "READY", weight: 0.25 },
    { name: "Security Score", value: 100, icon: ShieldCheck, status: "READY", weight: 0.25 },
    { name: "Performance Score", value: 92, icon: Activity, status: "READY", weight: 0.20 },
    { name: "Recovery Score", value: 100, icon: DatabaseBackup, status: "READY", weight: 0.20 },
    { name: "Operations Score", value: 100, icon: Rocket, status: "READY", weight: 0.10 },
  ];

  const checks: { label: string; passed: boolean; message?: string }[] = [
    { label: "QA Pass Rate >= 95%", passed: true },
    { label: "No Critical Bugs", passed: true },
    { label: "No High Vulnerabilities", passed: true },
    { label: "Load Testing Passed", passed: true },
    { label: "Recovery Testing Passed", passed: true },
    { label: "Monitoring Verified", passed: true },
    { label: "Backups Verified", passed: true },
    { label: "Workers Healthy", passed: true },
  ];

  useEffect(() => {
    // Simulate API fetch delay
    setTimeout(() => setLoading(false), 1500);
  }, []);

  // Compute weighted total score
  const totalScore = Math.round(
    scores.reduce((acc, curr) => acc + (curr.value * curr.weight), 0)
  );

  const overallStatus = checks.every(c => c.passed) ? "READY" : checks.some(c => !c.passed && c.label === "PWA Installed") ? "WARNING" : "BLOCKED";

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen relative">
        {/* Background ambient glow for Launch Page */}
        <div className={`absolute inset-0 pointer-events-none opacity-20 transition-all duration-1000 ${
          overallStatus === 'READY' ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900 via-[#030712] to-[#030712]' :
          overallStatus === 'WARNING' ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900 via-[#030712] to-[#030712]' :
          'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900 via-[#030712] to-[#030712]'
        }`}></div>

        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <PlayCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Launch Readiness Dashboard
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Pre-Flight Operations Check
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-5xl mx-auto space-y-8 relative z-10">
          
          {/* Main Status Banner */}
          <div className={`p-10 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-8 ${
            overallStatus === 'READY' ? 'bg-emerald-500/10 border-emerald-500/20' :
            overallStatus === 'WARNING' ? 'bg-orange-500/10 border-orange-500/20' :
            'bg-red-500/10 border-red-500/20'
          }`}>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Overall Platform Status</h2>
              <div className="flex items-center gap-4">
                <h1 className={`text-6xl font-black ${
                  overallStatus === 'READY' ? 'text-emerald-400' :
                  overallStatus === 'WARNING' ? 'text-orange-400' : 'text-red-400'
                }`}>{overallStatus}</h1>
                <div className="w-16 h-16 rounded-full border-4 border-current flex items-center justify-center text-xl font-bold opacity-50">
                  {totalScore}%
                </div>
              </div>
            </div>
            <button 
              disabled={overallStatus === 'BLOCKED'}
              className={`px-12 py-5 rounded-2xl text-xl font-black tracking-widest uppercase transition-all shadow-xl ${
                overallStatus === 'READY' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' :
                overallStatus === 'WARNING' ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20' :
                'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
              }`}
            >
              Initiate Launch Sequence
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Readiness Scores */}
            <div className="bg-[#1e293b]/30 border border-white/[0.05] rounded-3xl p-8">
              <h3 className="text-lg font-bold text-white mb-6">Subsystem Scores</h3>
              <div className="space-y-6">
                {scores.map((score, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="flex items-center gap-2 text-gray-300"><score.icon className="w-4 h-4 text-gray-500" /> {score.name}</span>
                      <span className={score.value === 100 ? 'text-emerald-400' : score.value > 90 ? 'text-blue-400' : 'text-orange-400'}>{score.value}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#0f172a] rounded-full overflow-hidden border border-white/[0.05]">
                      <div className={`h-full ${score.value === 100 ? 'bg-emerald-500' : score.value > 90 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${score.value}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Automated Checks */}
            <div className="bg-[#1e293b]/30 border border-white/[0.05] rounded-3xl p-8">
              <h3 className="text-lg font-bold text-white mb-6">Automated Verification</h3>
              <div className="space-y-3">
                {loading ? (
                  <div className="py-10 text-center"><Activity className="w-6 h-6 mx-auto animate-spin text-gray-500" /></div>
                ) : (
                  checks.map((check, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#0f172a] border border-white/[0.05] rounded-xl">
                      <span className="text-sm font-bold text-gray-300">{check.label}</span>
                      {check.passed ? (
                        <span className="flex items-center gap-1 text-[10px] font-black tracking-widest uppercase text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> PASS
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-orange-400">{check.message}</span>
                          <span className="flex items-center gap-1 text-[10px] font-black tracking-widest uppercase text-orange-400 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">
                            <AlertTriangle className="w-3 h-3" /> WARN
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
