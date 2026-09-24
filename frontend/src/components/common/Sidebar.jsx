import React from 'react';
import { MessageSquare, Layers, Globe, Compass, Activity, Home, User, Settings } from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'landing', label: 'Overview & Matrix', icon: Home, badge: 'Info' },
    { id: 'chat', label: 'Stateful Agent Chat', icon: MessageSquare, badge: 'LangGraph' },
    { id: 'rag', label: 'RAG & Hybrid Search', icon: Layers, badge: 'BM25 + RRF' },
    { id: 'tools', label: 'Web Tools Workbench', icon: Globe, badge: 'Tavily / ScrapeGraph' },
    { id: 'router', label: 'Smart Router Inspector', icon: Compass, badge: 'Classifier' },
    { id: 'profile', label: 'User Profile & Quotas', icon: User, badge: 'Account' },
    { id: 'settings', label: 'Settings & Key Vault', icon: Settings, badge: 'Vault' },
    { id: 'health', label: 'System Telemetry', icon: Activity, badge: 'Ping' },
  ];

  return (
    <aside className="w-64 glass-panel p-4 flex flex-col gap-2 shrink-0">
      <div className="px-3 py-2 text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider">
        Workspace Navigation
      </div>

      <nav className="flex flex-col gap-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600/30 to-indigo-600/30 text-white border border-purple-500/40 shadow-lg shadow-purple-500/10'
                  : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/50">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

