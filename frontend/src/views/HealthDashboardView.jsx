import React, { useState, useEffect } from 'react';
import { Activity, Database, Server, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { healthApi } from '../api/healthApi';

export const HealthDashboardView = () => {
  const [healthData, setHealthData] = useState(null);
  const [mongoData, setMongoData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const [hRes, mRes] = await Promise.all([
        healthApi.getHealth().catch(() => null),
        healthApi.getMongoPing().catch(() => null),
      ]);
      setHealthData(hRes);
      setMongoData(mRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-8 pr-2">
      {/* Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            System Health & Telemetry Dashboard
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Real-time status monitoring for FastAPI 8990 server and MongoDB Vector Cluster.
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="btn-secondary"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FastAPI Server Diagnostics Card */}
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              FastAPI 8990 Application Server
            </h3>
            {healthData ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                <XCircle className="w-3.5 h-3.5" /> Unreachable
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Server Endpoint:</span>
              <span className="font-mono text-purple-300">http://127.0.0.1:8990</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Application Version:</span>
              <span className="font-mono text-slate-200">v1.0.0</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">LangGraph Checkpointer:</span>
              <span className="font-mono text-emerald-400">MemorySaver Active</span>
            </div>
          </div>
        </div>

        {/* MongoDB Vector Cluster Diagnostics Card */}
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              MongoDB Vector Storage Cluster
            </h3>
            {mongoData?.status === 'connected' ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                <XCircle className="w-3.5 h-3.5" /> Offline
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Database Name:</span>
              <span className="font-mono text-emerald-300">{mongoData?.db_name || 'multiagent_db'}</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Vector Collection:</span>
              <span className="font-mono text-slate-200">documents</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Dense Index Dimension:</span>
              <span className="font-mono text-cyan-400">768 (Gemini Embedding)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
