import React from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Zap, Server, Database, Layers, Cpu, Globe, Compass } from 'lucide-react';
import { PoeLogo } from '../components/common/PoeLogo';

export const LandingView = ({ onSelectTab, onExplore, onLaunch }) => {
  const handleDefaultClick = (tab = 'chat') => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else if (onExplore) {
      onExplore(tab);
    } else if (onLaunch) {
      onLaunch(tab);
    }
  };

  const bots = [
    {
      id: 'chat',
      icon: <Cpu className="w-6 h-6 text-purple-400" />,
      badgeColor: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
      name: 'LangGraph Stateful Agent',
      author: '@Sachin • LangGraph Memory',
      desc: 'Stateful conversation graph workflow backed by MemorySaver checkpointer. Preserves full context and thread history per session ID.',
      tags: ['LangGraph', 'MemorySaver', 'Thread Memory'],
      route: 'chat',
    },
    {
      id: 'rag',
      icon: <Layers className="w-6 h-6 text-indigo-400" />,
      badgeColor: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
      name: 'Hybrid RAG Search Engine',
      author: '@Sachin • BM25 + Vector RRF',
      desc: 'Blends dense Gemini vector embeddings with sparse BM25 term frequency matching using Reciprocal Rank Fusion (RRF formula 1/(60+r)).',
      tags: ['RAG Studio', 'BM25 Sparse', 'RRF Re-ranker'],
      route: 'rag',
    },
    {
      id: 'tools',
      icon: <Globe className="w-6 h-6 text-emerald-400" />,
      badgeColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      name: 'Web Tools & ScrapeGraphAI',
      author: '@Sachin • Live Internet Tools',
      desc: 'Executes real-time multi-page web scraping via ScrapeGraphAI and live internet search queries via Tavily AI Search API.',
      tags: ['ScrapeGraphAI', 'Tavily Search', 'Live Scraping'],
      route: 'tools',
    },
    {
      id: 'router',
      icon: <Compass className="w-6 h-6 text-amber-400" />,
      badgeColor: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      name: 'Smart Intent Classifier Router',
      author: '@Sachin • Automated Classifier',
      desc: 'Zero-latency prompt intent classifier that dynamically evaluates incoming requests and routes to RAG, Tool Calling, or Direct LLM.',
      tags: ['Intent Classifier', 'Dynamic Router', 'Zero-Latency'],
      route: 'router',
    },
  ];

  const stats = [
    { label: 'Unit Test Coverage', value: '36/36', desc: '100% Passed Test Suites', icon: ShieldCheck, color: 'text-emerald-400' },
    { label: 'Backend Application Server', value: 'Port 8990', desc: 'FastAPI Async Engine', icon: Server, color: 'text-purple-400' },
    { label: 'Vector Index Dimension', value: '768-D', desc: 'Gemini Dense Embeddings', icon: Database, color: 'text-cyan-400' },
    { label: 'Re-Ranking Precision', value: 'RRF k=60', desc: 'Reciprocal Rank Fusion', icon: Zap, color: 'text-amber-400' },
  ];

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 pb-8 max-w-6xl mx-auto w-full">
      {/* Enterprise AI Hero Header */}
      <section className="poe-card p-8 md:p-12 relative overflow-hidden text-center flex flex-col items-center justify-center space-y-6">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-white/10 text-slate-300 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          Multi-Agent System v1.0 • Stateful LangGraph & RRF Search
        </div>

        <div className="space-y-3 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Stateful Multi-Agent Workflows & Real-Time AI Intelligence
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed pt-1">
            Orchestrate automated prompt intent classification, real-time web scraping with ScrapeGraphAI, live internet search with Tavily, and dense vector + BM25 keyword search with Reciprocal Rank Fusion.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => handleDefaultClick('chat')}
            className="btn-poe-primary text-sm px-8 py-3.5 shadow-xl shadow-purple-900/30 cursor-pointer"
          >
            <span>Launch Agent Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDefaultClick('tools')}
            className="btn-poe-pill text-sm px-6 py-3 cursor-pointer"
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Explore Web Tools</span>
          </button>
        </div>
      </section>

      {/* Stats Counter Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className="poe-card p-4 flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-[#121214] border border-white/10 shrink-0">
                <Icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-white font-mono leading-none">{s.value}</div>
                <div className="text-xs font-medium text-slate-300 mt-1 truncate">{s.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{s.desc}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Featured Bot Showcase Gallery */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <PoeLogo className="w-5 h-5" />
            Multi-Agent Capability Matrix
          </h2>
          <span className="text-xs text-slate-400">Select any agent bot to start workspace</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bots.map((bot) => (
            <div key={bot.id} className="poe-card p-6 flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#121214] border border-white/10 flex items-center justify-center shrink-0 shadow-md">
                      {bot.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white leading-tight">{bot.name}</h3>
                      <span className="text-xs text-slate-400 font-medium">{bot.author}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {bot.desc}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {bot.tags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#121214] text-slate-300 border border-white/10 font-mono">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleDefaultClick(bot.route)}
                className="btn-poe-pill text-xs w-full justify-center font-semibold py-2.5 cursor-pointer"
              >
                <span>Launch {bot.name}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
