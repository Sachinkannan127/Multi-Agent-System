import React from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { PoeLogo } from '../components/common/PoeLogo';

export const LandingView = ({ onExplore, onLaunch }) => {
  const handleClick = onExplore || onLaunch;

  const bots = [
    {
      id: 'chat',
      icon: '🤖',
      name: 'LangGraph-Agent',
      author: '@Sachin',
      desc: 'Stateful conversation graph workflow with MemorySaver checkpointer. Maintains multi-turn memory per thread.',
      tags: ['LangGraph', 'MemorySaver', 'Stateful'],
      route: 'chat',
    },
    {
      id: 'rag',
      icon: '🔍',
      name: 'RAG-Studio',
      author: '@Sachin',
      desc: 'Combines dense Gemini vector embeddings, sparse BM25 term frequency, and Reciprocal Rank Fusion (RRF).',
      tags: ['RAG', 'BM25', 'RRF Re-ranker'],
      route: 'rag',
    },
    {
      id: 'tools',
      icon: '🌐',
      name: 'Web-Tools',
      author: '@Sachin',
      desc: 'Real-time multi-page web scrapers powered by ScrapeGraphAI and live internet search with Tavily AI.',
      tags: ['ScrapeGraphAI', 'Tavily', 'Scraper'],
      route: 'tools',
    },
    {
      id: 'router',
      icon: '🧭',
      name: 'Router-Inspector',
      author: '@Sachin',
      desc: 'Automated LLM prompt classifier that routes requests dynamically to RAG, Tool Calling, or Direct completion.',
      tags: ['Intent Classifier', 'Router', 'LLM'],
      route: 'router',
    },
  ];

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 pb-6 max-w-6xl mx-auto w-full">
      {/* Poe Explore Header */}
      <section className="poe-card p-8 relative overflow-hidden text-center flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center gap-3">
          <PoeLogo className="w-10 h-10" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Explore Multi-Agent Bots
          </h1>
        </div>

        <p className="text-xs md:text-sm text-slate-400 max-w-xl leading-relaxed">
          Poe-inspired multi-agent workspace. Run stateful graph memory chats, hybrid RAG document search, live web scrapers, and automated intent classifiers.
        </p>

        <button onClick={handleClick} className="btn-poe-primary text-sm px-6 py-2.5 shadow-lg">
          <span>Start Agent Session</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* Poe Bot Gallery Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bots.map((bot) => (
          <div key={bot.id} className="poe-card p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#2B2D31] border border-white/10 flex items-center justify-center text-2xl shadow-md">
                    {bot.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">{bot.name}</h3>
                    <span className="text-xs text-purple-400 font-medium">{bot.author}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {bot.desc}
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {bot.tags.map((tag, idx) => (
                  <span key={idx} className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={handleClick}
              className="btn-poe-pill text-xs w-full justify-center font-semibold py-2"
            >
              <span>Chat with {bot.name}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </section>

      {/* System Telemetry Banner */}
      <section className="poe-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white">Enterprise Poe Architecture</h3>
          <p className="text-xs text-slate-400">
            Backed by FastAPI, MongoDB Atlas Vector Search, LiteLLM provider fallback sequences, and 36 passing unit tests.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            36/36 Tests Verified
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            FastAPI 8990 Server
          </div>
        </div>
      </section>
    </div>
  );
};
