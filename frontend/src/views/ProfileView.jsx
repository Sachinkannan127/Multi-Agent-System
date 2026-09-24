import React from 'react';
import { User, Shield, Key, Zap, CheckCircle2, Server, Database } from 'lucide-react';

export const ProfileView = () => {
  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-8 pr-2">
      {/* Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-purple-500/20">
            SA
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Sachin Architect
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Enterprise Admin
              </span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">sachin@multiagent-system.io</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
          <Shield className="w-4 h-4 text-emerald-400" />
          Active Subscription
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quota & Meter Metrics */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-6">
          <h3 className="font-semibold text-sm text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            API Usage & Quota Meters
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Tavily Web Search Requests</span>
                <span className="font-mono text-purple-400 font-bold">142 / 1,000</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full w-[14%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">ScrapeGraphAI Live Scrapes</span>
                <span className="font-mono text-emerald-400 font-bold">88 / 500</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full w-[17.6%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">MongoDB Atlas Vector Embeddings</span>
                <span className="font-mono text-cyan-400 font-bold">1,240 / 10,000</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full w-[12.4%]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Credentials Card */}
        <div className="glass-panel p-6 space-y-4">
          <h3 className="font-semibold text-sm text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" />
            Configured Integrations
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-slate-300">FastAPI Backend (8990)</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-slate-300">MongoDB Atlas Cluster</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-slate-300">LangGraph MemorySaver</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
