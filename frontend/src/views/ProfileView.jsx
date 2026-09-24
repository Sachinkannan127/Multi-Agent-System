import React from 'react';
import { User, Shield, Key, HardDrive, Cpu, Activity, CheckCircle2 } from 'lucide-react';

export const ProfileView = () => {
  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-8">
      {/* Profile Banner */}
      <div className="glass-panel p-6 flex items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-purple-500/20 border-2 border-purple-400/40">
          SK
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">Sachinkannan</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold">
              Senior Architect
            </span>
          </div>
          <p className="text-xs text-slate-400">sachinkannan0515@example.com • Multi-Agent Organization</p>
          <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active Enterprise Workspace</span>
          </div>
        </div>
      </div>

      {/* Quota Usage Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium"><Cpu className="w-4 h-4 text-purple-400" /> API Requests Usage</span>
            <span className="font-mono font-bold text-purple-300">1,240 / 10,000</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full w-[12.4%] rounded-full"></div>
          </div>
          <p className="text-[10px] text-slate-500">12.4% of monthly query quota consumed</p>
        </div>

        <div className="glass-panel p-6 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium"><HardDrive className="w-4 h-4 text-indigo-400" /> Vector Storage</span>
            <span className="font-mono font-bold text-indigo-300">45 / 500 MB</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-full w-[9%] rounded-full"></div>
          </div>
          <p className="text-[10px] text-slate-500">9% of MongoDB vector storage used</p>
        </div>

        <div className="glass-panel p-6 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium"><Activity className="w-4 h-4 text-emerald-400" /> Token Consumption</span>
            <span className="font-mono font-bold text-emerald-300">84,500 Tokens</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full w-[25%] rounded-full"></div>
          </div>
          <p className="text-[10px] text-slate-500">FastAPI & LiteLLM completion tokens</p>
        </div>
      </div>
    </div>
  );
};
