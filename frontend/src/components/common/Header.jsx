import React, { useEffect, useState } from 'react';
import { Database, ShieldCheck, RefreshCw, ChevronDown } from 'lucide-react';
import { GeminiSparkle } from './GeminiSparkle';
import { healthApi } from '../../api/healthApi';

export const Header = ({ onGoHome }) => {
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

  return (
    <header className="px-6 py-3.5 flex items-center justify-between mb-4 shrink-0 bg-[#1E1F20]/90 backdrop-blur-xl border border-white/10 rounded-2xl">
      {/* Brand & Gemini Logo */}
      <div 
        onClick={onGoHome} 
        className="flex items-center gap-3 cursor-pointer group hover:opacity-90 transition"
        title="Return to Gemini Landing Page"
      >
        <div className="p-2 rounded-2xl bg-slate-900 border border-white/10 shadow-lg group-hover:scale-105 transition-transform flex items-center justify-center">
          <GeminiSparkle className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold gemini-gradient-text tracking-tight">
            Multi-Agent System
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              Advanced 2.5
            </span>
          </div>
          <p className="text-xs text-slate-400">Stateful LangGraph Memory • Hybrid RAG • Tool Calling</p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* MongoDB Health Indicator Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs">
          <Database className="w-4 h-4 text-purple-400" />
          <span className="text-slate-400 font-medium">MongoDB:</span>
          {mongoStatus === 'connected' ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Connected ({dbName})
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              {mongoStatus === 'checking' ? 'Checking...' : 'Offline'}
            </span>
          )}
          <button 
            onClick={checkHealth}
            disabled={loading}
            className="ml-1 text-slate-400 hover:text-blue-400 transition cursor-pointer"
            title="Refresh Connection"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Gemini Active Badge */}
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 font-medium">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>v1.0.0 Active</span>
        </div>
      </div>
    </header>
  );
};
