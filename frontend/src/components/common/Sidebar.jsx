import React from 'react';
import { Plus, MessageSquare, Layers, Globe, Compass, Activity, User, Settings, Compass as ExploreIcon } from 'lucide-react';
import { PoeLogo } from './PoeLogo';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const botItems = [
    { id: 'chat', name: 'LangGraph-Agent', icon: '🤖', desc: 'Stateful conversation memory', badge: 'LangGraph' },
    { id: 'rag', name: 'RAG-Studio', icon: '🔍', desc: 'BM25 + Vector RRF search', badge: 'RRF' },
    { id: 'tools', name: 'Web-Tools', icon: '🌐', desc: 'ScrapeGraphAI & Tavily search', badge: 'Tools' },
    { id: 'router', name: 'Router-Inspector', icon: '🧭', desc: 'LLM intent classification', badge: 'Router' },
  ];

  const systemItems = [
    { id: 'landing', name: 'Explore Bots', icon: '✨', desc: 'Browse bot matrix' },
    { id: 'profile', name: 'User Profile', icon: '👤', desc: 'Quotas & meter logs' },
    { id: 'settings', name: 'Settings & Vault', icon: '⚙️', desc: 'API keys & model config' },
    { id: 'health', name: 'System Telemetry', icon: '📊', desc: 'Server uptime & latency' },
  ];

  return (
    <aside className="w-64 min-w-[256px] bg-[#18181A] border-r border-white/10 flex flex-col justify-between shrink-0 h-full min-h-0 select-none">
      <div className="flex flex-col gap-3 p-3 min-h-0 overflow-hidden">
        {/* Poe "+ New Chat" Button */}
        <button
          onClick={() => setActiveTab('chat')}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-purple-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>

        {/* Featured Bots Section */}
        <div className="space-y-1 pt-1 min-h-0 overflow-hidden flex flex-col">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Featured Multi-Agents
          </div>

          <nav className="flex flex-col gap-1 overflow-y-auto pr-1">
            {botItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#2B2D31] text-white border border-purple-500/40'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{item.icon}</span>
                    <div className="min-w-0 text-left">
                      <div className="font-semibold text-xs text-white truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* System & Account Section */}
        <div className="space-y-1 pt-2 border-t border-white/5">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Platform & Settings
          </div>
          <div className="flex flex-col gap-1">
            {systemItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-[#2B2D31] text-white border border-purple-500/40'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Poe Bottom User Profile Footer */}
      <div className="p-3 border-t border-white/10 bg-[#121214] flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          SA
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-white truncate">Sachin Architect</div>
          <div className="text-[10px] text-purple-400 font-medium">Pro Subscriber</div>
        </div>
      </div>
    </aside>
  );
};
