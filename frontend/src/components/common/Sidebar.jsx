import React from 'react';
import { MessageSquare, Layers, Globe, Compass, Activity, Home, User, Settings, Plus, Server } from 'lucide-react';
import { GeminiSparkle } from './GeminiSparkle';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'landing', label: 'Overview & Matrix', icon: Home, badge: 'Gemini' },
    { id: 'chat', label: 'Stateful Agent Chat', icon: MessageSquare, badge: 'LangGraph' },
    { id: 'rag', label: 'RAG & Hybrid Search', icon: Layers, badge: 'BM25 + RRF' },
    { id: 'tools', label: 'Web Tools Workbench', icon: Globe, badge: 'Tools' },
    { id: 'router', label: 'Smart Router Inspector', icon: Compass, badge: 'Classifier' },
    { id: 'profile', label: 'User Profile & Quotas', icon: User, badge: 'Account' },
    { id: 'settings', label: 'Settings & Key Vault', icon: Settings, badge: 'Vault' },
    { id: 'health', label: 'System Telemetry', icon: Activity, badge: 'Ping' },
  ];

  return (
    <aside className="w-72 min-w-[280px] bg-[#1E1F20] border border-white/10 rounded-2xl p-4 flex flex-col justify-between shrink-0 h-full min-h-0 select-none">
      <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
        {/* Gemini "New Chat" Pill Button */}
        <button
          onClick={() => setActiveTab('chat')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-full bg-[#282A2C] hover:bg-[#333537] border border-white/10 text-white font-semibold text-xs transition cursor-pointer shadow-lg group"
        >
          <div className="p-1 rounded-full bg-slate-900 group-hover:scale-110 transition-transform">
            <GeminiSparkle className="w-4 h-4" />
          </div>
          <span>New Agent Session</span>
          <Plus className="w-4 h-4 ml-auto text-slate-400 group-hover:text-white" />
        </button>

        <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2">
          <span>Gemini Navigation</span>
        </div>

        <nav className="flex flex-col gap-1.5 overflow-y-auto pr-1 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-full font-medium text-xs transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#282A2C] text-white border border-blue-500/40 shadow-lg shadow-blue-500/10'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="truncate whitespace-nowrap font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-700/60 font-mono shrink-0 ml-1">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Gemini System Status Footnote Widget */}
      <div className="mt-4 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3 shrink-0">
        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <Server className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Gemini Engine Active
          </div>
          <div className="text-[10px] text-slate-400 truncate">FastAPI 8990 • LangGraph</div>
        </div>
      </div>
    </aside>
  );
};
