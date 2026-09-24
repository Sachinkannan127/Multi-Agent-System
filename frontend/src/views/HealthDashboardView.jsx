import React, { useState, useEffect } from 'react';
import { Activity, Database, CheckCircle, Server, RefreshCw, Cpu } from 'lucide-react';
import { healthApi } from '../api/healthApi';
import { Loader } from '../components/common/Loader';

export const HealthDashboardView = () => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const data = await healthApi.getHealthStatus();
      setHealthData(data);
    } catch (err) {
      setHealthData({ status: 'offline', message: err.message, mongodb: { status: 'disconnected' } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-8">
      {/* Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            System Health & Telemetry Dashboard
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Real-time status of FastAPI application server and MongoDB cluster database connections.
          </p>
        </div>

        <button onClick={fetchTelemetry} disabled={loading} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {loading && <Loader label="Fetching live telemetry from backend server..." />}

      {healthData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FastAPI Server Health Card */}
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-200">
                <Server className="w-4 h-4 text-purple-400" />
                FastAPI Application Server
              </h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                healthData.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {healthData.status.toUpperCase()}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Server Message:</span>
                <span className="text-slate-200 font-medium">{healthData.message}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Host Port:</span>
                <span className="font-mono text-purple-300">127.0.0.1:8990</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Framework:</span>
                <span className="font-mono text-indigo-300">FastAPI + Uvicorn</span>
              </div>
            </div>
          </div>

          {/* MongoDB Cluster Health Card */}
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-200">
                <Database className="w-4 h-4 text-cyan-400" />
                MongoDB Atlas Vector Store Cluster
              </h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                healthData.mongodb?.status === 'connected' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {healthData.mongodb?.status?.toUpperCase() || 'OFFLINE'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Cluster URI:</span>
                <span className="font-mono text-cyan-300 truncate max-w-[200px]">{healthData.mongodb?.uri || 'cluster0.mongodb.net'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Database Name:</span>
                <span className="font-mono text-emerald-300">{healthData.mongodb?.db_name || 'multiagent_db'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Ping Result:</span>
                <span className="font-mono text-purple-300">{JSON.stringify(healthData.mongodb?.ping || { ok: 0 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
