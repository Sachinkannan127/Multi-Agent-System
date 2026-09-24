import React from 'react';
import { MessageSquare, Layers, Globe, Compass, Activity, Home, User, Settings, Sparkles, Server } from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'landing', label: 'Overview & Matrix', icon: Home, badge: 'System' },
    { id: 'chat', label: 'Stateful Agent Chat', icon: MessageSquare, badge: 'LangGraph' },
    { id: 'rag', label: 'RAG & Hybrid Search', icon: Layers, badge: 'BM25 + RRF' },
    { id: 'tools', label: 'Web Tools Workbench', icon: Globe, badge: 'Tools' },
    { id: 'router', label: 'Smart Router Inspector', icon: Compass, badge: 'Classifier' },
    { id: 'profile', label: 'User Profile & Quotas', icon: User, badge: 'Account' },
    { id: 'settings', label: 'Settings & Key Vault', icon: Settings, badge: 'Vault' },
    { id: 'health', label: 'System Telemetry', icon: Activity, badge: 'Ping' },
  ];

  return (
    <aside className="w-72 min-w-[280px] glass-panel p-4 flex flex-col justify-between shrink-0 h-full min-h-0 select-none">
      <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
        <div className="px-3 py-2 text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2.5">
          <span>Workspace Navigation</span>
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        </div>

        <nav className="flex flex-col gap-1.5 overflow-y-auto pr-1 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600/30 to-indigo-600/30 text-white border border-purple-500/40 shadow-lg shadow-purple-500/10'
                    : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                  <span className="truncate whitespace-nowrap font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-400 border border-slate-700/60 font-mono shrink-0 ml-1">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footnote Widget */}
      <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3 shrink-0">
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Server className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            FastAPI Engine Active
          </div>
          <div className="text-[10px] text-slate-400 truncate">Port 8990 • Thread Memory</div>
        </div>
      </div>
    </aside>
  );
};
