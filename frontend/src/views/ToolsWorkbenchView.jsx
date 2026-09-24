import React, { useState } from 'react';
import { Globe, Search, Code, ExternalLink, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';
import { toolsApi } from '../api/toolsApi';
import { Loader } from '../components/common/Loader';

export const ToolsWorkbenchView = () => {
  const [activeTool, setActiveTool] = useState('tavily'); // 'tavily' | 'scrapegraph'

  // Tavily Search State
  const [tavilyQuery, setTavilyQuery] = useState('');
  const [tavilyResults, setTavilyResults] = useState(null);
  const [searchingTavily, setSearchingTavily] = useState(false);

  // ScrapeGraphAI State
  const [scrapeUrl, setScrapeUrl] = useState('https://news.ycombinator.com');
  const [scrapePrompt, setScrapePrompt] = useState('Extract top 3 story titles and submitter names');
  const [scrapeResult, setScrapeResult] = useState(null);
  const [scraping, setScraping] = useState(false);

  const handleTavilySearch = async (e) => {
    e?.preventDefault();
    if (!tavilyQuery.trim() || searchingTavily) return;

    setSearchingTavily(true);
    try {
      const res = await toolsApi.tavilySearch(tavilyQuery);
      setTavilyResults(res);
    } catch (err) {
      alert(`Tavily Search Error: ${err.message}`);
    } finally {
      setSearchingTavily(false);
    }
  };

  const handleScrapeGraph = async (e) => {
    e?.preventDefault();
    if (!scrapeUrl.trim() || !scrapePrompt.trim() || scraping) return;

    setScraping(true);
    try {
      const res = await toolsApi.realtimeScrape([scrapeUrl], scrapePrompt);
      setScrapeResult(res);
    } catch (err) {
      alert(`ScrapeGraphAI Error: ${err.message}`);
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-8">
      {/* Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            Web Tools Workbench
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Test real-time Tavily AI internet search and ScrapeGraphAI multi-URL web scrapers directly.
          </p>
        </div>

        {/* Tool Selector Tabs */}
        <div className="flex gap-2 p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setActiveTool('tavily')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTool === 'tavily'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tavily AI Search
          </button>
          <button
            onClick={() => setActiveTool('scrapegraph')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTool === 'scrapegraph'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ScrapeGraphAI Scraper
          </button>
        </div>
      </div>

      {/* Tavily Tool Panel */}
      {activeTool === 'tavily' && (
        <div className="glass-panel p-6 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-emerald-400 border-b border-slate-800 pb-3">
            <Search className="w-4 h-4" />
            Tavily AI Real-Time Web Search Tool
          </h3>

          <form onSubmit={handleTavilySearch} className="flex gap-3">
            <input
              type="text"
              value={tavilyQuery}
              onChange={(e) => setTavilyQuery(e.target.value)}
              placeholder="Search live internet news or events (e.g. latest AI news)..."
              className="flex-1 glass-input text-sm"
            />
            <button type="submit" disabled={searchingTavily || !tavilyQuery.trim()} className="btn-primary">
              <Search className="w-4 h-4" />
              <span>Search Tavily</span>
            </button>
          </form>

          {searchingTavily && <Loader label="Querying Tavily AI Search API for real-time web results..." />}

          {tavilyResults && tavilyResults.status === 'success' && (
            <div className="space-y-3 pt-2">
              <div className="text-xs text-slate-400">
                Found <span className="font-bold text-emerald-400">{tavilyResults.results?.length || 0}</span> live search results
              </div>

              {tavilyResults.results?.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-sm text-emerald-300 hover:underline flex items-center gap-1.5">
                      {item.title}
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.content}</p>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{item.url}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ScrapeGraphAI Tool Panel */}
      {activeTool === 'scrapegraph' && (
        <div className="glass-panel p-6 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-purple-400 border-b border-slate-800 pb-3">
            <Code className="w-4 h-4" />
            ScrapeGraphAI Live Real-Time Web Scraper
          </h3>

          <form onSubmit={handleScrapeGraph} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Target Webpage URL:</label>
              <input
                type="url"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full glass-input text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Extraction Prompt / Instruction:</label>
              <textarea
                value={scrapePrompt}
                onChange={(e) => setScrapePrompt(e.target.value)}
                rows={2}
                placeholder="Describe what information to extract from the webpage..."
                className="w-full glass-input text-sm"
              />
            </div>

            <button type="submit" disabled={scraping || !scrapeUrl.trim() || !scrapePrompt.trim()} className="btn-primary">
              <Sparkles className="w-4 h-4" />
              <span>Run ScrapeGraphAI Scraper</span>
            </button>
          </form>

          {scraping && <Loader label="Executing ScrapeGraphAI SmartScraperGraph on target URL..." />}

          {scrapeResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="font-mono text-purple-400 font-bold">Extraction Result:</span>
                <span className="text-slate-400">Source: {scrapeResult.source || 'smart_scraper'}</span>
              </div>
              <pre className="text-xs font-mono text-slate-200 bg-slate-900 p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(scrapeResult.result || scrapeResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
