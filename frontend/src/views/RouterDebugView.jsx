import React, { useState } from 'react';
import { Compass, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { routerApi } from '../api/routerApi';
import { Badge } from '../components/common/Badge';
import { Loader } from '../components/common/Loader';

export const RouterDebugView = () => {
  const [testPrompt, setTestPrompt] = useState('');
  const [classification, setClassification] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleClassify = async (e) => {
    e?.preventDefault();
    if (!testPrompt.trim() || loading) return;

    setLoading(true);
    try {
      // 1. Get Classification
      const classRes = await routerApi.classifyPrompt(testPrompt);
      setClassification(classRes);

      // 2. Execute Orchestrated Route
      const execRes = await routerApi.sendRouterChat(testPrompt);
      setExecutionResult(execRes);
    } catch (err) {
      alert(`Router Classification Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    { type: 'RAG Document Question', prompt: 'What candidate experience is detailed in the uploaded PDF resume?' },
    { type: 'Web Search / Scraper', prompt: 'Scrape https://news.ycombinator.com for latest AI headlines using ScrapeGraphAI.' },
    { type: 'Direct LLM Question', prompt: 'Explain the difference between synchronous and asynchronous code.' },
  ];

  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-8">
      {/* Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            Smart Intent Router Debugger
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Test and inspect prompt intent classification decision making ('rag' vs 'toolcalling' vs 'direct').
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Testbench Form Card */}
        <div className="glass-panel p-6 space-y-4">
          <h3 className="font-semibold text-sm text-slate-200 border-b border-slate-800 pb-3">
            Prompt Classifier Testbench
          </h3>

          <form onSubmit={handleClassify} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Enter Test Prompt:</label>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                rows={3}
                placeholder="Enter prompt to classify and route..."
                className="w-full glass-input text-sm"
              />
            </div>

            <button type="submit" disabled={loading || !testPrompt.trim()} className="btn-primary w-full justify-center">
              <Sparkles className="w-4 h-4" />
              <span>Classify & Execute Route</span>
            </button>
          </form>

          {/* Sample Test Cases */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="text-xs font-medium text-slate-400">Sample Test Prompts:</div>
            {samplePrompts.map((sp, idx) => (
              <button
                key={idx}
                onClick={() => setTestPrompt(sp.prompt)}
                className="w-full text-left p-2.5 rounded-xl bg-slate-900/60 hover:bg-amber-900/20 border border-slate-800 hover:border-amber-500/30 text-xs transition"
              >
                <div className="font-semibold text-amber-300 text-[11px] mb-0.5">{sp.type}</div>
                <div className="text-slate-400 text-[10px] truncate">{sp.prompt}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Classification & Execution Results Panel */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-4">
          <h3 className="font-semibold text-sm text-slate-200 border-b border-slate-800 pb-3">
            Classification & Route Decision Output
          </h3>

          {loading && <Loader label="Evaluating prompt intent with Smart Classifier Router..." />}

          {!loading && !classification && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs text-center">
              <Compass className="w-10 h-10 mb-2 opacity-40 text-amber-400" />
              Enter a prompt or click a sample to see live classification and routing output.
            </div>
          )}

          {classification && (
            <div className="space-y-4">
              {/* Classification Decision Summary */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Classified Route:</span>
                  <Badge route={classification.intent} />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Confidence Score:</span>
                  <span className="font-mono font-bold text-emerald-400">{classification.confidence * 100}%</span>
                </div>

                <div className="text-xs text-slate-300 border-l-2 border-amber-500/50 pl-3 italic">
                  "{classification.reasoning}"
                </div>
              </div>

              {/* Execution Result */}
              {executionResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-purple-400 border-b border-slate-800 pb-2">
                    Orchestrated Answer:
                  </div>
                  <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {executionResult.response}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
