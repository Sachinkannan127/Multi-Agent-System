import React from 'react';
import { Cpu, Layers, Globe, Compass, ArrowRight, ShieldCheck, Zap, Sparkles } from 'lucide-react';

export const LandingView = ({ onExplore, onLaunch }) => {
  const handleClick = onExplore || onLaunch;

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 pb-6 max-w-7xl mx-auto w-full">
      {/* Hero Section */}
      <section className="glass-panel p-8 md:p-10 relative overflow-hidden text-center flex flex-col items-center justify-center space-y-5">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Multi-Agent System v1.0 • Stateful LangGraph & RRF Search
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold max-w-3xl leading-tight bg-gradient-to-r from-white via-slate-200 to-purple-300 bg-clip-text text-transparent">
          Stateful Multi-Agent Workflows & Hybrid RAG Intelligence
        </h1>

        <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
          Orchestrate automated prompt intent routing, real-time web scraping with ScrapeGraphAI, live internet search with Tavily, and dense vector + BM25 keyword search with Reciprocal Rank Fusion.
        </p>

        <div className="flex items-center gap-4 pt-1">
          <button onClick={handleClick} className="btn-primary text-sm px-7 py-3 cursor-pointer shadow-xl shadow-purple-500/25">
            <span>Launch Agent Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 flex flex-col space-y-3 justify-between hover:border-purple-500/40 transition">
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 w-fit">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">LangGraph Memory</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Stateful graph execution with MemorySaver checkpointer. Maintains multi-turn conversation memory per thread.
            </p>
          </div>
        </div>

        <div className="glass-panel p-5 flex flex-col space-y-3 justify-between hover:border-indigo-500/40 transition">
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 w-fit">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Hybrid Search RRF</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Combines Gemini vector embeddings, BM25 term frequency search, and Reciprocal Rank Fusion re-ranking.
            </p>
          </div>
        </div>

        <div className="glass-panel p-5 flex flex-col space-y-3 justify-between hover:border-emerald-500/40 transition">
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 w-fit">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Web Tools Workbench</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Real-time multi-page web scrapers with ScrapeGraphAI and live internet search with Tavily AI.
            </p>
          </div>
        </div>

        <div className="glass-panel p-5 flex flex-col space-y-3 justify-between hover:border-amber-500/40 transition">
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-400 w-fit">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Smart Intent Router</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Automated LLM prompt classifier that routes requests dynamically to RAG, Tool Calling, or Direct completion.
            </p>
          </div>
        </div>
      </section>

      {/* Capabilities Comparison Banner */}
      <section className="glass-panel p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-100">Enterprise Ready Architecture</h3>
          <p className="text-xs text-slate-400">
            Backed by FastAPI, MongoDB Atlas Vector Search, LiteLLM provider fallback sequences, and 36 passing unit tests.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            36/36 Tests Verified
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            FastAPI 8990 Server
          </div>
        </div>
      </section>
    </div>
  );
};
