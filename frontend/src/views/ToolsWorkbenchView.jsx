import React, { useState } from 'react';
import { Globe, Search, Code, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { toolsApi } from '../api/toolsApi';
import { Loader } from '../components/common/Loader';

export const ToolsWorkbenchView = () => {
  const [activeTool, setActiveTool] = useState('tavily');

  // Tavily State
  const [tavilyQuery, setTavilyQuery] = useState('Latest developments in AI multi-agent systems 2026');
  const [tavilyDepth, setTavilyDepth] = useState('basic');
  const [tavilyLoading, setTavilyLoading] = useState(false);
  const [tavilyResult, setTavilyResult] = useState(null);

  // ScrapeGraph State
  const [scrapeUrl, setScrapeUrl] = useState('https://news.ycombinator.com');
  const [scrapePrompt, setScrapePrompt] = useState('Extract top 3 trending technology stories with links');
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState(null);

  const handleTavilySearch = async (e) => {
    e.preventDefault();
    if (!tavilyQuery.trim() || tavilyLoading) return;

    setTavilyLoading(true);
    try {
      const res = await toolsApi.tavilySearch(tavilyQuery, tavilyDepth);
      setTavilyResult(res);
    } catch (err) {
      alert(`Tavily Error: ${err.message}`);
    } finally {
      setTavilyLoading(false);
    }
  };

  const handleScrapeGraph = async (e) => {
    e.preventDefault();
    if (!scrapeUrl.trim() || scrapeLoading) return;

    setScrapeLoading(true);
    try {
      const res = await toolsApi.scrapegraphScrape(scrapeUrl, scrapePrompt);
      setScrapeResult(res);
    } catch (err) {
      alert(`ScrapeGraph Error: ${err.message}`);
    } finally {
      setScrapeLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-8 pr-2">
      {/* View Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            Web Tools Workbench & Live Scraping
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Test Tavily Search API and ScrapeGraphAI LLM-powered Web Scrapers independently.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTool('tavily')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTool === 'tavily'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Tavily Web Search
          </button>
          <button
            onClick={() => setActiveTool('scrapegraph')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTool === 'scrapegraph'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            ScrapeGraphAI Scraper
          </button>
        </div>
      </div>

      {activeTool === 'tavily' ? (
        /* Tavily Tool Panel */
        <div className="glass-panel p-6 space-y-6">
          <form onSubmit={handleTavilySearch} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                value={tavilyQuery}
                onChange={(e) => setTavilyQuery(e.target.value)}
                placeholder="Enter query for Tavily Web Search..."
                className="flex-1 glass-input text-sm"
              />
              <select
                value={tavilyDepth}
                onChange={(e) => setTavilyDepth(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200"
              >
                <option value="basic">Basic Search Depth</option>
                <option value="advanced">Advanced Deep Search</option>
              </select>
              <button type="submit" disabled={tavilyLoading} className="btn-primary">
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
            </div>
          </form>

          {tavilyLoading && <Loader label="Searching live web via Tavily AI Search API..." />}

          {tavilyResult && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                <span>Query: <span className="font-bold text-white">"{tavilyResult.query}"</span></span>
                <span>Found <span className="font-bold text-purple-400">{tavilyResult.results?.length || 0}</span> web pages</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tavilyResult.results?.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 flex flex-col justify-between">
                    <div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-sm text-purple-300 hover:text-purple-200 flex items-center gap-1.5"
                      >
                        <span className="truncate">{item.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-3">
                        {item.content}
                      </p>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate pt-2 border-t border-slate-800/60">
                      Score: {item.score} • {item.url}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ScrapeGraph Tool Panel */
        <div className="glass-panel p-6 space-y-6">
          <form onSubmit={handleScrapeGraph} className="space-y-4">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300">Target Website URL to Scrape</label>
              <input
                type="text"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full glass-input text-sm"
              />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300">Extraction Prompt / Instruct Graph</label>
              <input
                type="text"
                value={scrapePrompt}
                onChange={(e) => setScrapePrompt(e.target.value)}
                placeholder="Extract key summary and headlines"
                className="w-full glass-input text-sm"
              />
            </div>
            <button type="submit" disabled={scrapeLoading} className="btn-primary">
              <Globe className="w-4 h-4" />
              <span>Scrape Web Content</span>
            </button>
          </form>

          {scrapeLoading && <Loader label="ScrapeGraphAI parsing DOM & extracting structured content..." />}

          {scrapeResult && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  ScrapeGraph AI Output Result:
                </div>
                <pre className="text-xs font-mono text-slate-300 bg-slate-950/80 p-4 rounded-lg overflow-x-auto border border-slate-900">
                  {JSON.stringify(scrapeResult.result || scrapeResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
