import React from 'react';
import { Cpu, Layers, Globe, Compass, ArrowRight, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { GeminiSparkle } from '../components/common/GeminiSparkle';

export const LandingView = ({ onExplore, onLaunch }) => {
  const handleClick = onExplore || onLaunch;

  const samplePills = [
    "Stateful LangGraph Memory",
    "BM25 + Dense RRF Hybrid Search",
    "Live Web Scraping with ScrapeGraphAI",
    "Tavily Internet Search",
    "Automated Intent Classification"
  ];

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 pb-6 max-w-7xl mx-auto w-full">
      {/* Gemini Hero Greeting Section */}
      <section className="gemini-card p-8 md:p-10 relative overflow-hidden text-center flex flex-col items-center justify-center space-y-6">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-white/10 text-slate-300 text-xs font-medium">
          <GeminiSparkle className="w-4 h-4" />
          Powered by Gemini 2.5 & LangGraph Multi-Agent Architecture
        </div>

        <div className="space-y-3 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-extrabold gemini-gradient-text tracking-tight leading-tight">
            Hello, Sachin
          </h1>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-200">
            What multi-agent task can I orchestrate for you today?
          </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed pt-1">
            Orchestrate automated prompt intent routing, real-time web scraping with ScrapeGraphAI, live search with Tavily, and dense vector + BM25 keyword search with Reciprocal Rank Fusion.
          </p>
        </div>

        {/* Gemini Sample Suggestion Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {samplePills.map((pill, idx) => (
            <button
              key={idx}
              onClick={handleClick}
              className="btn-gemini-pill text-xs text-slate-300 hover:text-white"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>{pill}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 pt-3">
          <button onClick={handleClick} className="btn-gemini text-sm px-8 py-3.5 shadow-xl shadow-blue-500/25">
            <span>Launch Gemini Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="gemini-card p-5 flex flex-col space-y-3 justify-between hover:border-blue-500/40 transition">
          <div className="space-y-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 w-fit">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">LangGraph Memory</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Stateful graph execution with MemorySaver checkpointer. Maintains multi-turn conversation memory per thread.
            </p>
          </div>
        </div>

        <div className="gemini-card p-5 flex flex-col space-y-3 justify-between hover:border-purple-500/40 transition">
          <div className="space-y-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 w-fit">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Hybrid Search RRF</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Combines Gemini vector embeddings, BM25 term frequency search, and Reciprocal Rank Fusion re-ranking.
            </p>
          </div>
        </div>

        <div className="gemini-card p-5 flex flex-col space-y-3 justify-between hover:border-green-500/40 transition">
          <div className="space-y-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 w-fit">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Web Tools Workbench</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time multi-page web scrapers with ScrapeGraphAI and live internet search with Tavily AI.
            </p>
          </div>
        </div>

        <div className="gemini-card p-5 flex flex-col space-y-3 justify-between hover:border-amber-500/40 transition">
          <div className="space-y-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 w-fit">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Smart Intent Router</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated LLM prompt classifier that routes requests dynamically to RAG, Tool Calling, or Direct completion.
            </p>
          </div>
        </div>
      </section>

      {/* Capabilities Comparison Banner */}
      <section className="gemini-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-100">Google Gemini & Enterprise Architecture</h3>
          <p className="text-xs text-slate-400">
            Backed by FastAPI, MongoDB Atlas Vector Search, LiteLLM provider fallback sequences, and 36 passing unit tests.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            36/36 Tests Verified
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            FastAPI 8990 Server
          </div>
        </div>
      </section>
    </div>
  );
};
