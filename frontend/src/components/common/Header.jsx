import React, { useEffect, useState } from 'react';
import { Database, ShieldCheck, Cpu, RefreshCw } from 'lucide-react';
import { healthApi } from '../../api/healthApi';

export const Header = () => {
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
    const interval = setInterval(checkHealth, 15000); // Poll health every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glass-panel border-b border-[var(--border-glass)] px-6 py-3.5 flex items-center justify-between mb-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
          <Cpu className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
            Multi-Agent Intelligence System
          </h1>
          <p className="text-xs text-[var(--text-dim)]">LangGraph Stateful Workflows • Hybrid RAG • Tool Calling</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* MongoDB Health Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
          <Database className="w-4 h-4 text-purple-400" />
          <span className="text-[var(--text-muted)] font-medium">MongoDB:</span>
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
            className="ml-1 text-slate-400 hover:text-purple-400 transition"
            title="Refresh Connection"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* API Protection Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>v1.0.0 Active</span>
        </div>
      </div>
    </header>
  );
};
