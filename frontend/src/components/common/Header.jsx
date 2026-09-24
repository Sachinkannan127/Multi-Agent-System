import React, { useEffect, useState } from 'react';
import { Database, ShieldCheck, RefreshCw, Sparkles, Share2, MoreHorizontal } from 'lucide-react';
import { PoeLogo } from './PoeLogo';
import { healthApi } from '../../api/healthApi';

export const Header = ({ onGoHome, activeTab }) => {
  const [mongoStatus, setMongoStatus] = useState('checking');
  const [dbName, setDbName] = useState('');
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await healthApi.getMongoPing();
      if (res.status === 'connected') {
        setMongoStatus('connected');
        setDbName(res.db_name || 'multiagent_db');
      } else {
        setMongoStatus('disconnected');
      }
    } catch {
      setMongoStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const getBotTitle = () => {
    switch (activeTab) {
      case 'landing':
        return { name: 'Explore Bots', author: '@PoeSystem', icon: '✨' };
      case 'chat':
        return { name: 'LangGraph-Agent', author: '@Sachin', icon: '🤖' };
      case 'rag':
        return { name: 'RAG-Hybrid-Search', author: '@Sachin', icon: '🔍' };
      case 'tools':
        return { name: 'Web-Tools-Workbench', author: '@Sachin', icon: '🌐' };
      case 'router':
        return { name: 'Smart-Intent-Router', author: '@Sachin', icon: '🧭' };
      case 'profile':
        return { name: 'User Account & Quotas', author: '@Sachin', icon: '👤' };
      case 'settings':
        return { name: 'API Key Vault', author: '@Sachin', icon: '⚙️' };
      case 'health':
        return { name: 'System Telemetry', author: '@Sachin', icon: '📊' };
      default:
        return { name: 'LangGraph-Agent', author: '@Sachin', icon: '🤖' };
    }
  };

  const currentBot = getBotTitle();

  return (
    <header className="px-5 py-3 flex items-center justify-between bg-[#18181A] border-b border-white/10 shrink-0">
      {/* Bot Info Header (Poe Style) */}
      <div className="flex items-center gap-3">
        <div 
          onClick={onGoHome}
          className="cursor-pointer flex items-center gap-2 hover:opacity-90 transition"
          title="Return to Poe Explore"
        >
          <PoeLogo className="w-7 h-7" />
          <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">Poe</span>
        </div>

        <div className="h-4 w-px bg-white/10 mx-1"></div>

        <div className="flex items-center gap-2">
          <span className="text-lg">{currentBot.icon}</span>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5 leading-none">
              {currentBot.name}
              <span className="text-[10px] text-slate-400 font-normal">{currentBot.author}</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* MongoDB Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#1E1E22] border border-white/10 text-xs">
          <Database className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-slate-400 text-[11px]">DB:</span>
          {mongoStatus === 'connected' ? (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {dbName}
            </span>
          ) : (
            <span className="text-rose-400 text-[11px] font-semibold">
              {mongoStatus === 'checking' ? 'Checking...' : 'Offline'}
            </span>
          )}
          <button 
            onClick={checkHealth}
            disabled={loading}
            className="ml-1 text-slate-400 hover:text-purple-400 transition cursor-pointer"
            title="Refresh Connection"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Share & Actions */}
        <button 
          onClick={onGoHome}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          title="Explore Bots"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
